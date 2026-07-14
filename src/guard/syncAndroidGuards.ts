import { listGuards } from '../storage/guards';
import { androidGuard } from './androidGuardInstance';

/** Refreshes the native monitor's guard list from storage — call after any
 * guard is created, edited, paused, or deleted so the foreground service
 * (§6.5) stays in sync with what's in the database. */
export async function syncAndroidGuards(): Promise<void> {
  const guards = listGuards().filter((g) => g.platform === 'android' && !g.paused);
  await androidGuard.setGuards(
    guards.map((g) => ({ appId: g.appRef, dailyLimitMinutes: g.dailyLimitMin })),
  );
}
