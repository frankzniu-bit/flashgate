import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'flashgate.db';

let db: SQLite.SQLiteDatabase | null = null;

// Schema (decks/cards/review_logs/guards/grants/settings, §6.7) lands in Phase 1+
// alongside the repositories that read and write it.
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DATABASE_NAME);
  }
  return db;
}
