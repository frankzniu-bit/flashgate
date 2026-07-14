import { describe, expect, it } from 'vitest';
import {
  createNewCardSchedule,
  isDue,
  retrievability,
  scheduleReview,
  type ReviewRating,
} from './scheduler';

const NOW = new Date('2026-01-01T12:00:00Z');

describe('createNewCardSchedule', () => {
  it('starts New and due immediately', () => {
    const schedule = createNewCardSchedule(NOW);
    expect(schedule.state).toBe('New');
    expect(isDue(schedule, NOW)).toBe(true);
    expect(schedule.reps).toBe(0);
    expect(schedule.lapses).toBe(0);
  });
});

describe('scheduleReview state transitions', () => {
  const ratings: ReviewRating[] = ['Again', 'Hard', 'Good', 'Easy'];

  it.each(ratings)('accepts a %s rating on a New card and moves state forward', (rating) => {
    const card = createNewCardSchedule(NOW);
    const { schedule } = scheduleReview(card, rating, NOW);

    expect(schedule.state).not.toBe('New');
    expect(schedule.reps).toBe(1);
    // Every review's resulting due date is at or after the review time.
    expect(schedule.due.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });

  it('Again keeps a New card in the (re)learning loop with a short due interval', () => {
    const card = createNewCardSchedule(NOW);
    const { schedule } = scheduleReview(card, 'Again', NOW);

    expect(schedule.state).toBe('Learning');
    const dueInMinutes = (schedule.due.getTime() - NOW.getTime()) / 60_000;
    expect(dueInMinutes).toBeLessThan(24 * 60); // still same-day, not scheduled out for days
  });

  it('Easy graduates a New card straight past Learning with a longer interval than Good', () => {
    const goodCard = createNewCardSchedule(NOW);
    const easyCard = createNewCardSchedule(NOW);

    const good = scheduleReview(goodCard, 'Good', NOW);
    const easy = scheduleReview(easyCard, 'Easy', NOW);

    expect(easy.schedule.due.getTime()).toBeGreaterThan(good.schedule.due.getTime());
  });

  it('accumulates a lapse when a Review card is answered Again', () => {
    let card = createNewCardSchedule(NOW);
    card = scheduleReview(card, 'Good', NOW).schedule;
    card = scheduleReview(card, 'Good', card.due).schedule;
    // By now the card should have graduated to Review.
    expect(card.state).toBe('Review');

    const lapsedBefore = card.lapses;
    const afterLapse = scheduleReview(card, 'Again', card.due).schedule;

    expect(afterLapse.state).toBe('Relearning');
    expect(afterLapse.lapses).toBe(lapsedBefore + 1);
  });

  it('re-reviewing keeps extending the due date further into the future on repeated Good ratings', () => {
    let card = createNewCardSchedule(NOW);
    const dueDates: number[] = [];

    for (let i = 0; i < 4; i++) {
      const result = scheduleReview(card, 'Good', card.due);
      card = result.schedule;
      dueDates.push(card.due.getTime());
    }

    for (let i = 1; i < dueDates.length; i++) {
      expect(dueDates[i]).toBeGreaterThan(dueDates[i - 1]!);
    }
  });
});

describe('due-date math with a fixed clock', () => {
  it('isDue is false before the due date and true at/after it', () => {
    const card = createNewCardSchedule(NOW);
    const { schedule } = scheduleReview(card, 'Good', NOW);

    const beforeDue = new Date(schedule.due.getTime() - 1000);
    const atDue = schedule.due;
    const afterDue = new Date(schedule.due.getTime() + 1000);

    expect(isDue(schedule, beforeDue)).toBe(false);
    expect(isDue(schedule, atDue)).toBe(true);
    expect(isDue(schedule, afterDue)).toBe(true);
  });

  it('retrievability decays as elapsed time since due grows', () => {
    const card = createNewCardSchedule(NOW);
    const { schedule } = scheduleReview(card, 'Good', NOW);

    const soonAfterReview = retrievability(schedule, NOW);
    const longAfterReview = retrievability(
      schedule,
      new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days later
    );

    expect(longAfterReview).toBeLessThan(soonAfterReview);
  });
});
