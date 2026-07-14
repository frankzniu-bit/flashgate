import { retrievability } from './scheduler';
import type { CardSchedule } from './scheduler';

export interface SelectableCard {
  id: string;
  schedule: CardSchedule;
}

export interface CardSelectionOptions {
  now: Date;
  /** New cards already introduced today, toward `newCardsPerDayCap` (§4.3.3). */
  newCardsIntroducedToday: number;
  newCardsPerDayCap: number;
}

/**
 * Orders cards for a study queue per §4.3:
 *   1. Due Learning/Relearning — oldest due first.
 *   2. Due Review — retrievability ascending (most-forgotten first).
 *   3. New cards, up to the deck's remaining daily cap.
 *
 * Free-study sessions consume this queue until it's empty (§4.3). The gate's
 * additional "ahead-of-schedule" fallback for empty queues (§3.5) is a
 * toll-engine concern, not this ordering — it layers on top in Phase 3.
 */
export function selectStudyQueue(
  cards: SelectableCard[],
  options: CardSelectionOptions,
): SelectableCard[] {
  const due = cards.filter((c) => c.schedule.due.getTime() <= options.now.getTime());

  const learning = due
    .filter((c) => c.schedule.state === 'Learning' || c.schedule.state === 'Relearning')
    .sort((a, b) => a.schedule.due.getTime() - b.schedule.due.getTime());

  const review = due
    .filter((c) => c.schedule.state === 'Review')
    .sort(
      (a, b) =>
        retrievability(a.schedule, options.now) - retrievability(b.schedule, options.now),
    );

  const remainingNewCap = Math.max(0, options.newCardsPerDayCap - options.newCardsIntroducedToday);
  const newCards = cards.filter((c) => c.schedule.state === 'New').slice(0, remainingNewCap);

  return [...learning, ...review, ...newCards];
}
