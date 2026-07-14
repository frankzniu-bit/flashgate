import { randomUUID } from 'expo-crypto';
import { getDatabase } from './db';
import type { Deck, DeckSource } from './types';

interface DeckRow {
  id: string;
  name: string;
  created_at: number;
  new_cards_per_day: number;
  source: string;
}

function fromRow(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at),
    newCardsPerDay: row.new_cards_per_day,
    source: row.source as DeckSource,
  };
}

export function createDeck(name: string, newCardsPerDay = 10, source: DeckSource = 'manual'): Deck {
  const db = getDatabase();
  const id = randomUUID();
  const createdAt = Date.now();
  db.runSync(
    'INSERT INTO decks (id, name, created_at, new_cards_per_day, source) VALUES (?, ?, ?, ?, ?)',
    id,
    name,
    createdAt,
    newCardsPerDay,
    source,
  );
  return { id, name, createdAt: new Date(createdAt), newCardsPerDay, source };
}

export function listDecks(): Deck[] {
  const db = getDatabase();
  return db.getAllSync<DeckRow>('SELECT * FROM decks ORDER BY created_at DESC').map(fromRow);
}

export function getDeck(id: string): Deck | null {
  const db = getDatabase();
  const row = db.getFirstSync<DeckRow>('SELECT * FROM decks WHERE id = ?', id);
  return row ? fromRow(row) : null;
}

export function renameDeck(id: string, name: string): void {
  getDatabase().runSync('UPDATE decks SET name = ? WHERE id = ?', name, id);
}

export function deleteDeck(id: string): void {
  getDatabase().runSync('DELETE FROM decks WHERE id = ?', id);
}

export function countDueCards(deckId: string, now: number = Date.now()): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM cards WHERE deck_id = ? AND suspended = 0 AND due_at <= ?',
    deckId,
    now,
  );
  return row?.count ?? 0;
}
