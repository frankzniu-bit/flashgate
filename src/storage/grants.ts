import { rolloverDayKey } from '@flashgate/domain';
import { randomUUID } from 'expo-crypto';
import { getDatabase } from './db';
import type { GrantRecord } from './types';

interface GrantRow {
  id: string;
  guard_id: string;
  granted_at: number;
  expires_at: number;
}

function fromRow(row: GrantRow): GrantRecord {
  return {
    id: row.id,
    guardId: row.guard_id,
    grantedAt: new Date(row.granted_at),
    expiresAt: new Date(row.expires_at),
  };
}

export function createGrant(guardId: string, grantedAtMs: number, expiresAtMs: number): GrantRecord {
  const db = getDatabase();
  const id = randomUUID();
  db.runSync(
    'INSERT INTO grants (id, guard_id, granted_at, expires_at) VALUES (?, ?, ?, ?)',
    id,
    guardId,
    grantedAtMs,
    expiresAtMs,
  );
  return { id, guardId, grantedAt: new Date(grantedAtMs), expiresAt: new Date(expiresAtMs) };
}

export function getActiveGrant(guardId: string, nowMs: number): GrantRecord | null {
  const row = getDatabase().getFirstSync<GrantRow>(
    'SELECT * FROM grants WHERE guard_id = ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1',
    guardId,
    nowMs,
  );
  return row ? fromRow(row) : null;
}

export function listGrantsForGuard(guardId: string): GrantRecord[] {
  return getDatabase()
    .getAllSync<GrantRow>('SELECT * FROM grants WHERE guard_id = ?', guardId)
    .map(fromRow);
}

/** Counts unlocks "today" per the §3.4 rollover boundary (default 4am
 * local, not midnight) — used to compute the next escalated toll size via
 * packages/domain/src/tollEngine.ts#tollSizeForUnlock. Derives the count
 * from grants rather than a separate table, as §6.7 allows. */
export function countUnlocksToday(guardId: string, now: Date, rolloverHour = 4): number {
  const todayKey = rolloverDayKey(now, rolloverHour);
  return listGrantsForGuard(guardId).filter(
    (grant) => rolloverDayKey(grant.grantedAt, rolloverHour) === todayKey,
  ).length;
}

export function revokeAllGrantsForGuard(guardId: string): void {
  getDatabase().runSync('DELETE FROM grants WHERE guard_id = ?', guardId);
}

/** §3.5 clock-tampering response: a detected backwards jump larger than the
 * grant window expires every grant, not just the current guard's. */
export function revokeAllGrants(): void {
  getDatabase().runSync('DELETE FROM grants');
}
