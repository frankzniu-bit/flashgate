import { describe, expect, it } from 'vitest';
import { selectStudyQueue, type SelectableCard } from './cardSelection';
import { createNewCardSchedule, scheduleReview, type CardSchedule } from './scheduler';

const NOW = new Date('2026-01-01T12:00:00Z');

function card(id: string, schedule: CardSchedule): SelectableCard {
  return { id, schedule };
}

function reviewCardDueAt(due: Date, stability: number): CardSchedule {
  const base = scheduleReview(createNewCardSchedule(NOW), 'Good', NOW).schedule;
  // Retrievability is computed from elapsed time since lastReview, so it must
  // move with `due` for these fixtures to actually differ by stability alone.
  return { ...base, state: 'Review', due, lastReview: due, stability };
}

function learningCardDueAt(due: Date): CardSchedule {
  const base = scheduleReview(createNewCardSchedule(NOW), 'Again', NOW).schedule;
  return { ...base, state: 'Learning', due };
}

describe('selectStudyQueue', () => {
  it('orders due Learning/Relearning before due Review before New', () => {
    const learning = card('learning', learningCardDueAt(new Date(NOW.getTime() - 1000)));
    const review = card('review', reviewCardDueAt(new Date(NOW.getTime() - 1000), 5));
    const fresh = card('new', createNewCardSchedule(NOW));

    const queue = selectStudyQueue([fresh, review, learning], {
      now: NOW,
      newCardsIntroducedToday: 0,
      newCardsPerDayCap: 10,
    });

    expect(queue.map((c) => c.id)).toEqual(['learning', 'review', 'new']);
  });

  it('orders due Learning cards oldest-due first', () => {
    const older = card('older', learningCardDueAt(new Date(NOW.getTime() - 10_000)));
    const newer = card('newer', learningCardDueAt(new Date(NOW.getTime() - 1_000)));

    const queue = selectStudyQueue([newer, older], {
      now: NOW,
      newCardsIntroducedToday: 0,
      newCardsPerDayCap: 10,
    });

    expect(queue.map((c) => c.id)).toEqual(['older', 'newer']);
  });

  it('orders due Review cards by retrievability ascending (most-forgotten first)', () => {
    // Lower stability decays faster, so at the same due/elapsed time it has
    // lower retrievability -- "more forgotten".
    const due = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lowStability = card('low-stability', reviewCardDueAt(due, 2));
    const highStability = card('high-stability', reviewCardDueAt(due, 50));

    const queue = selectStudyQueue([highStability, lowStability], {
      now: NOW,
      newCardsIntroducedToday: 0,
      newCardsPerDayCap: 10,
    });

    expect(queue.map((c) => c.id)).toEqual(['low-stability', 'high-stability']);
  });

  it('excludes not-yet-due Learning/Review cards entirely', () => {
    const notDue = card('not-due', reviewCardDueAt(new Date(NOW.getTime() + 10_000), 5));

    const queue = selectStudyQueue([notDue], {
      now: NOW,
      newCardsIntroducedToday: 0,
      newCardsPerDayCap: 10,
    });

    expect(queue).toEqual([]);
  });

  it('caps New cards at the remaining daily allowance', () => {
    const news = ['a', 'b', 'c'].map((id) => card(id, createNewCardSchedule(NOW)));

    const queue = selectStudyQueue(news, {
      now: NOW,
      newCardsIntroducedToday: 1,
      newCardsPerDayCap: 2,
    });

    expect(queue).toHaveLength(1);
  });

  it('offers no New cards once the daily cap is exhausted', () => {
    const news = ['a', 'b'].map((id) => card(id, createNewCardSchedule(NOW)));

    const queue = selectStudyQueue(news, {
      now: NOW,
      newCardsIntroducedToday: 5,
      newCardsPerDayCap: 5,
    });

    expect(queue).toEqual([]);
  });
});
