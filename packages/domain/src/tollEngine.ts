import { selectStudyQueue, type CardSelectionOptions, type SelectableCard } from './cardSelection';
import type { ReviewRating } from './scheduler';

// ---------------------------------------------------------------------------
// Gate session composition (§4.3, §3.5)
// ---------------------------------------------------------------------------

export interface GateSessionPlan {
  /** Ordered card ids for this session — length equals `tollSize`, unless
   * the deck itself has fewer cards than that (§3.5 "deck smaller than the
   * toll"), in which case it equals `cards.length`. */
  cardIds: string[];
  tollSize: number;
}

/**
 * Composes a gate session per §4.3's priority order, then — unlike free
 * study, which just stops when the due queue is empty — pads the session
 * so the gate never comes up short (§3.5: "the gate never says 'no cards
 * available, come on in'"): new cards beyond the daily cap, then
 * ahead-of-schedule Review cards, lowest stability first.
 */
export function planGateSession(
  cards: SelectableCard[],
  requestedTollSize: number,
  options: CardSelectionOptions,
): GateSessionPlan {
  const tollSize = Math.min(requestedTollSize, cards.length);
  if (tollSize === 0) return { cardIds: [], tollSize: 0 };

  const primary = selectStudyQueue(cards, options);
  const chosen: SelectableCard[] = primary.slice(0, tollSize);
  const chosenIds = new Set(chosen.map((c) => c.id));

  if (chosen.length < tollSize) {
    const remainingNew = cards.filter((c) => c.schedule.state === 'New' && !chosenIds.has(c.id));
    for (const card of remainingNew) {
      if (chosen.length >= tollSize) break;
      chosen.push(card);
      chosenIds.add(card.id);
    }
  }

  if (chosen.length < tollSize) {
    const aheadOfSchedule = cards
      .filter((c) => c.schedule.state === 'Review' && !chosenIds.has(c.id))
      .sort((a, b) => a.schedule.stability - b.schedule.stability);
    for (const card of aheadOfSchedule) {
      if (chosen.length >= tollSize) break;
      chosen.push(card);
      chosenIds.add(card.id);
    }
  }

  return { cardIds: chosen.slice(0, tollSize).map((c) => c.id), tollSize };
}

// ---------------------------------------------------------------------------
// Gate answer grading (§4.4) — a pure reducer over the session queue
// ---------------------------------------------------------------------------

interface QueuedCard {
  cardId: string;
  attemptsSoFar: number;
}

export interface GateSessionState {
  queue: QueuedCard[];
  correctCount: number;
  tollSize: number;
}

export function startGateSession(plan: GateSessionPlan): GateSessionState {
  return {
    queue: plan.cardIds.map((cardId) => ({ cardId, attemptsSoFar: 0 })),
    correctCount: 0,
    tollSize: plan.tollSize,
  };
}

export function currentGateCardId(state: GateSessionState): string | null {
  return state.queue[0]?.cardId ?? null;
}

export function isGateSessionComplete(state: GateSessionState): boolean {
  return state.tollSize > 0 && state.correctCount >= state.tollSize;
}

export interface GateAnswerResult {
  state: GateSessionState;
  /** The FSRS rating to apply to the card just answered. Gate sessions
   * never award Easy (§4.4) — that's reserved for free-study self-rating. */
  rating: Exclude<ReviewRating, 'Easy'>;
  countedTowardToll: boolean;
}

/**
 * Advances the session by one answer. Correct on first try counts toward
 * the toll and rates Good; correct after a miss counts too but rates Hard
 * (§4.4); incorrect never counts, rates Again, and re-queues the card at
 * the back so the session always terminates once every card has been
 * answered correctly at least once (§3.4).
 */
export function answerGateCard(state: GateSessionState, correct: boolean): GateAnswerResult {
  const [current, ...rest] = state.queue;
  if (!current) {
    throw new Error('answerGateCard called with no current card');
  }

  if (correct) {
    const rating = current.attemptsSoFar === 0 ? 'Good' : 'Hard';
    return {
      state: { ...state, queue: rest, correctCount: state.correctCount + 1 },
      rating,
      countedTowardToll: true,
    };
  }

  const requeued: QueuedCard = { cardId: current.cardId, attemptsSoFar: current.attemptsSoFar + 1 };
  return {
    state: { ...state, queue: [...rest, requeued] },
    rating: 'Again',
    countedTowardToll: false,
  };
}

// ---------------------------------------------------------------------------
// Toll economics: escalation and daily rollover (§3.4)
// ---------------------------------------------------------------------------

const DEFAULT_ESCALATION_STEP = 2;
const DEFAULT_ESCALATION_CAP = 15;

/** Toll size for the Nth unlock of a guarded app today (1-indexed). Off by
 * default toggle disables escalation entirely; otherwise +2 cards per
 * subsequent unlock, capped at 15. */
export function tollSizeForUnlock(
  baseToll: number,
  unlockNumberToday: number,
  escalationOn: boolean,
  cap: number = DEFAULT_ESCALATION_CAP,
  step: number = DEFAULT_ESCALATION_STEP,
): number {
  if (!escalationOn || unlockNumberToday <= 1) return baseToll;
  return Math.min(baseToll + step * (unlockNumberToday - 1), cap);
}

/** A stable key for "which day" a moment belongs to, given a rollover hour
 * (default 4:00 AM local, not midnight — §3.4 — so a session that runs past
 * midnight doesn't get charged a fresh escalation mid-session). Two Dates
 * on either side of the rollover hour, same calendar day, share a key. */
export function rolloverDayKey(now: Date, rolloverHour: number = 4): string {
  const d = new Date(now.getTime());
  if (d.getHours() < rolloverHour) {
    d.setDate(d.getDate() - 1);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Epoch ms at which "today" (per the same rollover boundary as
 * rolloverDayKey) began. The single day-start definition for anything that
 * counts per-day activity — new-card caps, unlock counts — so the app never
 * mixes a midnight boundary with the 4am one. */
export function rolloverDayStartMs(now: Date, rolloverHour: number = 4): number {
  const d = new Date(now.getTime());
  if (d.getHours() < rolloverHour) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(rolloverHour, 0, 0, 0);
  return d.getTime();
}

// ---------------------------------------------------------------------------
// Grants and clock tampering (§3.5)
// ---------------------------------------------------------------------------

export interface Grant {
  appId: string;
  grantedAtEpochMs: number;
  expiresAtEpochMs: number;
}

export function isGrantActive(grant: Grant, nowEpochMs: number): boolean {
  return nowEpochMs < grant.expiresAtEpochMs;
}

/**
 * Detects a backwards clock jump larger than the grant window — the one
 * clock-tampering case the brief asks us to guard against, deliberately no
 * further (§3.5, Principle 5: "don't over-engineer beyond that"). Compare
 * against the latest timestamp FlashGate has itself observed, not just the
 * grant's own `grantedAtEpochMs`, since the trick works even against a
 * grant made long before the jump.
 */
export function shouldExpireAllGrantsForClockJump(
  lastObservedEpochMs: number,
  nowEpochMs: number,
  grantWindowMs: number,
): boolean {
  return nowEpochMs < lastObservedEpochMs - grantWindowMs;
}

// ---------------------------------------------------------------------------
// Toll source fallback (§3.5 "deck deleted / empty while attached to a guard")
// ---------------------------------------------------------------------------

export type TollSource =
  | { kind: 'deck'; deckId: string }
  | { kind: 'all-decks' }
  | { kind: 'no-cards' };

/** A guard's configured deck may have been deleted or emptied since it was
 * attached. Falls back to "all decks"; if there's nothing anywhere, the
 * guard has nothing to charge and must pause itself (a UI/storage concern
 * above this function — this just reports which case applies). */
export function resolveTollSource(
  configuredDeckId: string | null,
  deckHasCards: boolean,
  anyCardsExistAnywhere: boolean,
): TollSource {
  if (configuredDeckId !== null && deckHasCards) {
    return { kind: 'deck', deckId: configuredDeckId };
  }
  if (anyCardsExistAnywhere) {
    return { kind: 'all-decks' };
  }
  return { kind: 'no-cards' };
}
