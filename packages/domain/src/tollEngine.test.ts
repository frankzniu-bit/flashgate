import { describe, expect, it } from 'vitest';
import type { SelectableCard } from './cardSelection';
import { createNewCardSchedule, scheduleReview, type CardSchedule } from './scheduler';
import {
  answerGateCard,
  currentGateCardId,
  isGateSessionComplete,
  isGrantActive,
  planGateSession,
  resolveTollSource,
  rolloverDayKey,
  shouldExpireAllGrantsForClockJump,
  startGateSession,
  tollSizeForUnlock,
  type GateSessionState,
} from './tollEngine';

const NOW = new Date('2026-01-01T12:00:00Z');

function newCard(id: string): SelectableCard {
  return { id, schedule: createNewCardSchedule(NOW) };
}

function reviewCard(id: string, due: Date, stability: number): SelectableCard {
  const base = scheduleReview(createNewCardSchedule(NOW), 'Good', NOW).schedule;
  const schedule: CardSchedule = { ...base, state: 'Review', due, lastReview: due, stability };
  return { id, schedule };
}

function learningCard(id: string, due: Date): SelectableCard {
  const base = scheduleReview(createNewCardSchedule(NOW), 'Again', NOW).schedule;
  const schedule: CardSchedule = { ...base, state: 'Learning', due };
  return { id, schedule };
}

const baseOptions = { now: NOW, newCardsIntroducedToday: 0, newCardsPerDayCap: 10 };

describe('planGateSession — §4.3 ordering and §3.5 edge cases', () => {
  it('fills the toll from due cards in priority order when enough are due', () => {
    const due = new Date(NOW.getTime() - 1000);
    const cards = [learningCard('l1', due), reviewCard('r1', due, 5), newCard('n1')];

    const plan = planGateSession(cards, 2, baseOptions);

    expect(plan.tollSize).toBe(2);
    expect(plan.cardIds).toEqual(['l1', 'r1']);
  });

  it('"deck has fewer cards than the toll": shrinks the toll to the deck size', () => {
    const cards = [newCard('a'), newCard('b')];

    const plan = planGateSession(cards, 5, baseOptions);

    expect(plan.tollSize).toBe(2);
    expect(plan.cardIds).toHaveLength(2);
  });

  it('"no cards due": pads with New cards beyond the daily cap rather than coming up short', () => {
    // Cap is exhausted, but the gate must still fill the toll from New cards.
    const cards = [newCard('n1'), newCard('n2'), newCard('n3')];
    const options = { ...baseOptions, newCardsIntroducedToday: 10, newCardsPerDayCap: 10 };

    const plan = planGateSession(cards, 3, options);

    expect(plan.tollSize).toBe(3);
    expect(plan.cardIds).toHaveLength(3);
  });

  it('"no cards due": falls back to ahead-of-schedule Review cards, lowest stability first', () => {
    const notDue = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
    const cards = [
      { id: 'high-stability', schedule: { ...reviewCard('x', notDue, 50).schedule } },
      { id: 'low-stability', schedule: { ...reviewCard('y', notDue, 5).schedule } },
    ];

    const plan = planGateSession(cards, 2, baseOptions);

    expect(plan.tollSize).toBe(2);
    expect(plan.cardIds).toEqual(['low-stability', 'high-stability']);
  });

  it('never returns fewer cards than the toll when the deck can supply them, even with nothing due and cap exhausted', () => {
    const notDue = new Date(NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
    const cards = [reviewCard('a', notDue, 10), reviewCard('b', notDue, 20)];
    const options = { ...baseOptions, newCardsIntroducedToday: 10, newCardsPerDayCap: 10 };

    const plan = planGateSession(cards, 2, options);

    expect(plan.cardIds).toHaveLength(2);
  });

  it('an empty deck plans an empty, zero-size session (caller must fall back per resolveTollSource)', () => {
    const plan = planGateSession([], 5, baseOptions);
    expect(plan).toEqual({ cardIds: [], tollSize: 0 });
  });
});

describe('gate session grading — §4.4', () => {
  function sessionFor(cardIds: string[]): GateSessionState {
    return startGateSession({ cardIds, tollSize: cardIds.length });
  }

  it('rates Good and counts toward the toll on first-try correct', () => {
    let state = sessionFor(['a']);
    const result = answerGateCard(state, true);

    expect(result.rating).toBe('Good');
    expect(result.countedTowardToll).toBe(true);
    expect(result.state.correctCount).toBe(1);
  });

  it('rates Again and does not count on incorrect, and re-queues the card', () => {
    const state = sessionFor(['a', 'b']);
    const result = answerGateCard(state, false);

    expect(result.rating).toBe('Again');
    expect(result.countedTowardToll).toBe(false);
    expect(result.state.correctCount).toBe(0);
    // 'a' goes to the back of the queue, 'b' comes up next.
    expect(currentGateCardId(result.state)).toBe('b');
  });

  it('rates Hard (never Easy) on a correct retry after a miss, and it counts toward the toll', () => {
    let state = sessionFor(['a']);
    const missed = answerGateCard(state, false);
    state = missed.state;
    expect(currentGateCardId(state)).toBe('a'); // only one card, comes right back

    const retried = answerGateCard(state, true);
    expect(retried.rating).toBe('Hard');
    expect(retried.countedTowardToll).toBe(true);
    expect(retried.state.correctCount).toBe(1);
  });

  it('a session always terminates: repeated misses keep re-queuing until eventually correct', () => {
    let state = sessionFor(['a', 'b']);
    // Miss 'a' three times before finally getting it right.
    for (let i = 0; i < 3; i++) {
      const result = answerGateCard(state, false);
      state = result.state;
    }
    // 'b' should have been presented and answered correctly at least once by now
    // to keep the test simple, resolve both cards correctly and confirm completion.
    while (!isGateSessionComplete(state)) {
      const result = answerGateCard(state, true);
      state = result.state;
    }
    expect(isGateSessionComplete(state)).toBe(true);
    expect(state.correctCount).toBe(2);
  });

  it('is "5 correct", not "5 attempts": total answers can exceed the toll size', () => {
    let state = sessionFor(['a', 'b']);
    let totalAnswers = 0;

    const miss = answerGateCard(state, false); // miss 'a'
    state = miss.state;
    totalAnswers++;

    while (!isGateSessionComplete(state)) {
      const result = answerGateCard(state, true);
      state = result.state;
      totalAnswers++;
    }

    expect(state.correctCount).toBe(2);
    expect(totalAnswers).toBe(3); // 1 miss + 2 correct, but only 2 counted
  });
});

describe('toll escalation — §3.4', () => {
  it('holds at the base toll when escalation is off', () => {
    expect(tollSizeForUnlock(5, 4, false)).toBe(5);
  });

  it('holds at the base toll for the first unlock of the day', () => {
    expect(tollSizeForUnlock(5, 1, true)).toBe(5);
  });

  it('increases by 2 per subsequent unlock: 5, 7, 9, ...', () => {
    expect(tollSizeForUnlock(5, 2, true)).toBe(7);
    expect(tollSizeForUnlock(5, 3, true)).toBe(9);
    expect(tollSizeForUnlock(5, 4, true)).toBe(11);
  });

  it('caps at 15', () => {
    expect(tollSizeForUnlock(5, 20, true)).toBe(15);
  });
});

describe('rollover day key — §3.4 (4am boundary, not midnight)', () => {
  it('groups times before the rollover hour with the previous calendar day', () => {
    const beforeRollover = new Date('2026-01-02T03:59:00');
    const afterMidnightSameSession = new Date('2026-01-01T23:00:00');

    expect(rolloverDayKey(beforeRollover, 4)).toBe(rolloverDayKey(afterMidnightSameSession, 4));
  });

  it('treats the rollover hour itself as the start of the new day', () => {
    const atRollover = new Date('2026-01-02T04:00:00');
    const justBefore = new Date('2026-01-02T03:59:59');

    expect(rolloverDayKey(atRollover, 4)).not.toBe(rolloverDayKey(justBefore, 4));
  });
});

describe('grants and clock tampering — §3.5', () => {
  it('a grant is active before its expiry and inactive at/after it', () => {
    const grant = { appId: 'mocktok', grantedAtEpochMs: 1000, expiresAtEpochMs: 2000 };
    expect(isGrantActive(grant, 1999)).toBe(true);
    expect(isGrantActive(grant, 2000)).toBe(false);
    expect(isGrantActive(grant, 2001)).toBe(false);
  });

  it('does not flag ordinary forward time passage as a clock jump', () => {
    const grantWindowMs = 10 * 60 * 1000;
    expect(shouldExpireAllGrantsForClockJump(1_000_000, 1_000_500, grantWindowMs)).toBe(false);
  });

  it('does not flag a small backwards drift under the grant window', () => {
    const grantWindowMs = 10 * 60 * 1000;
    const now = 1_000_000;
    const smallBackwardsJump = now - 1000; // much smaller than the 10-minute window
    expect(shouldExpireAllGrantsForClockJump(now, smallBackwardsJump, grantWindowMs)).toBe(false);
  });

  it('flags a backwards clock jump larger than the grant window', () => {
    const grantWindowMs = 10 * 60 * 1000;
    const now = 1_000_000;
    const bigBackwardsJump = now - grantWindowMs - 1;
    expect(shouldExpireAllGrantsForClockJump(now, bigBackwardsJump, grantWindowMs)).toBe(true);
  });
});

describe('toll source fallback — §3.5 "deck deleted / empty while attached to a guard"', () => {
  it('uses the configured deck when it still has cards', () => {
    expect(resolveTollSource('deck-1', true, true)).toEqual({ kind: 'deck', deckId: 'deck-1' });
  });

  it('falls back to all decks when the configured deck is gone or empty', () => {
    expect(resolveTollSource('deck-1', false, true)).toEqual({ kind: 'all-decks' });
    expect(resolveTollSource(null, false, true)).toEqual({ kind: 'all-decks' });
  });

  it('reports no-cards when nothing exists anywhere, so the guard can pause itself', () => {
    expect(resolveTollSource('deck-1', false, false)).toEqual({ kind: 'no-cards' });
    expect(resolveTollSource(null, false, false)).toEqual({ kind: 'no-cards' });
  });
});
