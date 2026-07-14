import { createNewCardSchedule, type CardSchedule, type CardState } from '@flashgate/domain';
import { randomUUID } from 'expo-crypto';
import { getDatabase } from './db';
import type { DeckCard } from './types';

interface CardRow {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  fsrs_state: string;
  difficulty: number;
  stability: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  due_at: number;
  last_review_at: number | null;
  suspended: number;
}

function scheduleFromRow(row: CardRow): CardSchedule {
  return {
    state: row.fsrs_state as CardState,
    due: new Date(row.due_at),
    stability: row.stability,
    difficulty: row.difficulty,
    scheduledDays: row.scheduled_days,
    learningSteps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    lastReview: row.last_review_at ? new Date(row.last_review_at) : null,
  };
}

function fromRow(row: CardRow): DeckCard {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    schedule: scheduleFromRow(row),
    suspended: row.suspended !== 0,
  };
}

export function createCard(deckId: string, front: string, back: string): DeckCard {
  const db = getDatabase();
  const id = randomUUID();
  const schedule = createNewCardSchedule();
  db.runSync(
    `INSERT INTO cards
      (id, deck_id, front, back, fsrs_state, difficulty, stability, scheduled_days, learning_steps, reps, lapses, due_at, last_review_at, suspended)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    id,
    deckId,
    front,
    back,
    schedule.state,
    schedule.difficulty,
    schedule.stability,
    schedule.scheduledDays,
    schedule.learningSteps,
    schedule.reps,
    schedule.lapses,
    schedule.due.getTime(),
    schedule.lastReview?.getTime() ?? null,
  );
  return { id, deckId, front, back, schedule, suspended: false };
}

/** Inserts many cards in one transaction (imports, §5) — same schedule
 * initialization as createCard, just batched for a whole parsed set. */
export function createCards(deckId: string, cards: { front: string; back: string }[]): DeckCard[] {
  const db = getDatabase();
  const created: DeckCard[] = [];
  db.withTransactionSync(() => {
    for (const { front, back } of cards) {
      const id = randomUUID();
      const schedule = createNewCardSchedule();
      db.runSync(
        `INSERT INTO cards
          (id, deck_id, front, back, fsrs_state, difficulty, stability, scheduled_days, learning_steps, reps, lapses, due_at, last_review_at, suspended)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        id,
        deckId,
        front,
        back,
        schedule.state,
        schedule.difficulty,
        schedule.stability,
        schedule.scheduledDays,
        schedule.learningSteps,
        schedule.reps,
        schedule.lapses,
        schedule.due.getTime(),
        schedule.lastReview?.getTime() ?? null,
      );
      created.push({ id, deckId, front, back, schedule, suspended: false });
    }
  });
  return created;
}

export function listCardsInDeck(deckId: string): DeckCard[] {
  const db = getDatabase();
  return db
    .getAllSync<CardRow>('SELECT * FROM cards WHERE deck_id = ? ORDER BY due_at ASC', deckId)
    .map(fromRow);
}

/** All non-suspended cards across every deck — the gate's "all decks" toll
 * source (§3.5) and the pool for multiple-choice distractors when a single
 * deck is too small (§4.4). */
export function listAllCards(): DeckCard[] {
  const db = getDatabase();
  return db.getAllSync<CardRow>('SELECT * FROM cards WHERE suspended = 0 ORDER BY due_at ASC').map(fromRow);
}

export function getCard(id: string): DeckCard | null {
  const db = getDatabase();
  const row = db.getFirstSync<CardRow>('SELECT * FROM cards WHERE id = ?', id);
  return row ? fromRow(row) : null;
}

export function updateCardContent(id: string, front: string, back: string): void {
  getDatabase().runSync('UPDATE cards SET front = ?, back = ? WHERE id = ?', front, back, id);
}

export function updateCardSchedule(id: string, schedule: CardSchedule): void {
  getDatabase().runSync(
    `UPDATE cards SET
       fsrs_state = ?, difficulty = ?, stability = ?, scheduled_days = ?,
       learning_steps = ?, reps = ?, lapses = ?, due_at = ?, last_review_at = ?
     WHERE id = ?`,
    schedule.state,
    schedule.difficulty,
    schedule.stability,
    schedule.scheduledDays,
    schedule.learningSteps,
    schedule.reps,
    schedule.lapses,
    schedule.due.getTime(),
    schedule.lastReview?.getTime() ?? null,
    id,
  );
}

export function deleteCard(id: string): void {
  getDatabase().runSync('DELETE FROM cards WHERE id = ?', id);
}

/** Approximates "new cards introduced today" (§4.3.3) as cards on their
 * first-ever review, reviewed within [dayStartMs, now]. */
export function countNewCardsIntroducedToday(deckId: string, dayStartMs: number): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM cards WHERE deck_id = ? AND reps = 1 AND last_review_at >= ?',
    deckId,
    dayStartMs,
  );
  return row?.count ?? 0;
}
