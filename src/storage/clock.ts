import { shouldExpireAllGrantsForClockJump } from '@flashgate/domain';
import { getDatabase } from './db';
import { revokeAllGrants } from './grants';

const LAST_OBSERVED_KEY = 'last_observed_epoch_ms';

function readLastObserved(): number | null {
  const row = getDatabase().getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    LAST_OBSERVED_KEY,
  );
  if (!row) return null;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : null;
}

function writeLastObserved(epochMs: number): void {
  getDatabase().runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    LAST_OBSERVED_KEY,
    String(epochMs),
  );
}

/**
 * §3.5 clock-tampering response: if the clock has jumped backwards by more
 * than the grant window since the last timestamp FlashGate observed, expire
 * every grant. Call on app launch (and any other natural checkpoint); also
 * advances the stored high-water mark. Deliberately nothing fancier than
 * this — Principle 5 says don't over-engineer the anti-cheat.
 */
export function checkClockAndExpireGrantsIfJumped(
  nowEpochMs: number = Date.now(),
  grantWindowMs: number = 10 * 60_000,
): boolean {
  const lastObserved = readLastObserved();
  let jumped = false;
  if (lastObserved !== null && shouldExpireAllGrantsForClockJump(lastObserved, nowEpochMs, grantWindowMs)) {
    revokeAllGrants();
    jumped = true;
  }
  // Only advance forward: a backwards jump must not lower the high-water
  // mark, or repeated small jumps could each slip under the threshold.
  if (lastObserved === null || nowEpochMs > lastObserved) {
    writeLastObserved(nowEpochMs);
  }
  return jumped;
}
