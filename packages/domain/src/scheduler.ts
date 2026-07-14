import {
  createEmptyCard,
  fsrs,
  Rating,
  type Card as FsrsCard,
  type CardInput as FsrsCardInput,
  type Grade,
  type GradeType,
  type StateType,
} from 'ts-fsrs';

/**
 * Public rating vocabulary for FlashGate (§4.2). "Easy" is only ever passed
 * from free-study self-rating — gate sessions never award it (§4.4).
 */
export type ReviewRating = GradeType;

/** Public state vocabulary, re-exported from ts-fsrs's StateType so callers
 * never need to import the ts-fsrs package directly (§6.2 layering). */
export type CardState = StateType;

/**
 * The subset of ts-fsrs's Card that FlashGate persists per §6.7, extended
 * with the bookkeeping fields (reps, lapses, scheduledDays, learningSteps)
 * FSRS needs to schedule correctly — the brief's data model is a sketch,
 * not an exhaustive column list.
 */
export interface CardSchedule {
  state: CardState;
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
}

export interface ScheduleResult {
  schedule: CardSchedule;
  elapsedDays: number;
}

const scheduler = fsrs();

const GRADE_BY_RATING: Record<GradeType, Grade> = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
};

function toFsrsCardInput(schedule: CardSchedule): FsrsCardInput {
  return {
    state: schedule.state,
    due: schedule.due,
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    scheduled_days: schedule.scheduledDays,
    learning_steps: schedule.learningSteps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    last_review: schedule.lastReview ?? null,
    elapsed_days: 0,
  };
}

function fromFsrsCard(card: FsrsCard): CardSchedule {
  return {
    state: card.state === 0 ? 'New' : card.state === 1 ? 'Learning' : card.state === 2 ? 'Review' : 'Relearning',
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ?? null,
  };
}

/** A fresh card, due immediately. */
export function createNewCardSchedule(now: Date = new Date()): CardSchedule {
  return fromFsrsCard(createEmptyCard(now));
}

/** Apply a review rating to a card's schedule, returning its next schedule. */
export function scheduleReview(
  schedule: CardSchedule,
  rating: ReviewRating,
  now: Date,
): ScheduleResult {
  const { card, log } = scheduler.next(toFsrsCardInput(schedule), now, GRADE_BY_RATING[rating]);
  return { schedule: fromFsrsCard(card), elapsedDays: log.scheduled_days };
}

/** Probability of recall right now, in [0, 1] — used to order due Review
 * cards "most-forgotten first" (§4.3). */
export function retrievability(schedule: CardSchedule, now: Date): number {
  return scheduler.get_retrievability(toFsrsCardInput(schedule), now, false);
}

export function isDue(schedule: CardSchedule, now: Date): boolean {
  return schedule.due.getTime() <= now.getTime();
}
