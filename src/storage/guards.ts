import { randomUUID } from 'expo-crypto';
import { getDatabase } from './db';
import type { Guard } from './types';

interface GuardRow {
  id: string;
  app_ref: string;
  platform: string;
  daily_limit_min: number;
  deck_id: string | null;
  toll_cards: number;
  grant_minutes: number;
  escalation_on: number;
  paused: number;
}

function fromRow(row: GuardRow): Guard {
  return {
    id: row.id,
    appRef: row.app_ref,
    platform: row.platform,
    dailyLimitMin: row.daily_limit_min,
    deckId: row.deck_id,
    tollCards: row.toll_cards,
    grantMinutes: row.grant_minutes,
    escalationOn: row.escalation_on !== 0,
    paused: row.paused !== 0,
  };
}

export interface CreateGuardOptions {
  dailyLimitMin: number;
  deckId?: string | null;
  tollCards?: number;
  grantMinutes?: number;
  escalationOn?: boolean;
  platform?: string;
}

export function createGuard(appRef: string, options: CreateGuardOptions): Guard {
  const db = getDatabase();
  const id = randomUUID();
  const guard: Guard = {
    id,
    appRef,
    platform: options.platform ?? 'mock',
    dailyLimitMin: options.dailyLimitMin,
    deckId: options.deckId ?? null,
    tollCards: options.tollCards ?? 5,
    grantMinutes: options.grantMinutes ?? 10,
    escalationOn: options.escalationOn ?? true,
    paused: false,
  };
  db.runSync(
    `INSERT INTO guards (id, app_ref, platform, daily_limit_min, deck_id, toll_cards, grant_minutes, escalation_on, paused)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    guard.id,
    guard.appRef,
    guard.platform,
    guard.dailyLimitMin,
    guard.deckId,
    guard.tollCards,
    guard.grantMinutes,
    guard.escalationOn ? 1 : 0,
  );
  return guard;
}

export function listGuards(): Guard[] {
  return getDatabase().getAllSync<GuardRow>('SELECT * FROM guards').map(fromRow);
}

export function getGuard(id: string): Guard | null {
  const row = getDatabase().getFirstSync<GuardRow>('SELECT * FROM guards WHERE id = ?', id);
  return row ? fromRow(row) : null;
}

export function getGuardByAppRef(appRef: string): Guard | null {
  const row = getDatabase().getFirstSync<GuardRow>('SELECT * FROM guards WHERE app_ref = ?', appRef);
  return row ? fromRow(row) : null;
}

/** Falls back a guard to "all decks" (deck_id = NULL) — §3.5's deleted/empty
 * deck case. */
export function setGuardDeck(id: string, deckId: string | null): void {
  getDatabase().runSync('UPDATE guards SET deck_id = ? WHERE id = ?', deckId, id);
}

export function setGuardPaused(id: string, paused: boolean): void {
  getDatabase().runSync('UPDATE guards SET paused = ? WHERE id = ?', paused ? 1 : 0, id);
}

export function deleteGuard(id: string): void {
  getDatabase().runSync('DELETE FROM guards WHERE id = ?', id);
}

export interface UpdateGuardOptions {
  dailyLimitMin: number;
  deckId: string | null;
  tollCards: number;
  grantMinutes: number;
  escalationOn: boolean;
}

/** Edits an existing guard's configuration in place — unlike delete+recreate,
 * this preserves grant history (grants cascade-delete with their guard). */
export function updateGuardConfig(id: string, options: UpdateGuardOptions): void {
  getDatabase().runSync(
    `UPDATE guards SET daily_limit_min = ?, deck_id = ?, toll_cards = ?, grant_minutes = ?, escalation_on = ?
     WHERE id = ?`,
    options.dailyLimitMin,
    options.deckId,
    options.tollCards,
    options.grantMinutes,
    options.escalationOn ? 1 : 0,
    id,
  );
}
