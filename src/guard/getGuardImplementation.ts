import type { AppGuard } from './AppGuard';
import { androidGuard } from './androidGuardInstance';
import { mockGuard } from './mockGuardInstance';

/** Dispatches to the right AppGuard implementation for a stored guard's
 * `platform` column — the gate screen (app/gate/[guardId].tsx) is guard-
 * implementation-agnostic and shouldn't hardcode MockGuard. */
export function getGuardImplementation(platform: string): AppGuard {
  if (platform === 'android') return androidGuard;
  return mockGuard;
}
