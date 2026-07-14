import type { SQLiteDatabase } from 'expo-sqlite';

// §6.7 sketches decks/cards/review_logs/settings; guards/grants/unlocks_today
// are added in Phase 3 once the toll engine needs them. Card columns beyond
// the sketch (scheduled_days, learning_steps, reps, lapses) are bookkeeping
// FSRS needs to schedule correctly — see packages/domain/src/scheduler.ts.
const CURRENT_VERSION = 1;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE decks (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      new_cards_per_day INTEGER NOT NULL DEFAULT 10,
      source TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE cards (
      id TEXT PRIMARY KEY NOT NULL,
      deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      fsrs_state TEXT NOT NULL DEFAULT 'New',
      difficulty REAL NOT NULL DEFAULT 0,
      stability REAL NOT NULL DEFAULT 0,
      scheduled_days REAL NOT NULL DEFAULT 0,
      learning_steps INTEGER NOT NULL DEFAULT 0,
      reps INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER NOT NULL,
      last_review_at INTEGER,
      suspended INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_cards_deck_id ON cards(deck_id);
    CREATE INDEX idx_cards_due_at ON cards(due_at);

    CREATE TABLE review_logs (
      id TEXT PRIMARY KEY NOT NULL,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      rating TEXT NOT NULL,
      mode TEXT NOT NULL,
      elapsed_ms INTEGER NOT NULL,
      reviewed_at INTEGER NOT NULL,
      fsrs_snapshot TEXT NOT NULL
    );
    CREATE INDEX idx_review_logs_card_id ON review_logs(card_id);

    CREATE TABLE settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `,
};

export function runMigrations(db: SQLiteDatabase): void {
  const { user_version: version } = db.getFirstSync<{ user_version: number }>(
    'PRAGMA user_version',
  ) ?? { user_version: 0 };

  db.withTransactionSync(() => {
    for (let v = version + 1; v <= CURRENT_VERSION; v++) {
      const migration = MIGRATIONS[v];
      if (!migration) continue;
      db.execSync(migration);
      db.execSync(`PRAGMA user_version = ${v}`);
    }
  });
}
