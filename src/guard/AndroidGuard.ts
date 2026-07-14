import * as native from '../../modules/flashgate-guard';
import type { AppGuard, GuardableApp, GuardConfig, Minutes, PermissionState, Unsubscribe } from './AppGuard';

/**
 * Real Android implementation of AppGuard (§6.5): usage-stats-based
 * detection via a foreground service, a trampoline blocking Activity, no
 * AccessibilityService. Thin by design — all toll/escalation logic stays
 * in the JS domain layer; this class only talks to the native module.
 */
export class AndroidGuard implements AppGuard {
  async requestPermissions(): Promise<PermissionState> {
    if (!native.hasUsageAccess()) {
      // Special access, not a runtime dialog — opens Settings and returns
      // immediately. The caller must re-check hasUsageAccess() once the
      // user comes back (e.g. on screen focus), same as §3.1's
      // "plain-language explanation screen before each OS prompt."
      native.openUsageAccessSettings();
      return 'not-determined';
    }
    if (!native.hasNotificationPermission()) {
      await native.requestNotificationPermission();
    }
    return native.hasUsageAccess() ? 'granted' : 'not-determined';
  }

  async listInstalledApps(): Promise<GuardableApp[]> {
    return native.listInstalledApps();
  }

  async setGuards(guards: GuardConfig[]): Promise<void> {
    native.startMonitoring(
      guards.map((g) => ({ appPackage: g.appId, dailyLimitMinutes: g.dailyLimitMinutes })),
    );
  }

  async grantWindow(appId: string, minutes: Minutes): Promise<void> {
    native.grantWindow(appId, minutes);
  }

  async revokeAllGrants(): Promise<void> {
    native.revokeAllGrants();
  }

  onGateRequested(cb: (appId: string) => void): Unsubscribe {
    const subscription = native.onGateRequested(cb);
    return () => subscription.remove();
  }

  async getTodayUsage(appId: string): Promise<Minutes> {
    return native.getTodayUsageMinutes(appId);
  }
}
