import type {
  AppGuard,
  GuardableApp,
  GuardConfig,
  Minutes,
  PermissionState,
  Unsubscribe,
} from './AppGuard';

const MOCK_APPS: GuardableApp[] = [
  { id: 'mocktok', displayName: 'MockTok' },
  { id: 'instagrief', displayName: 'Instagrief' },
];

/**
 * In-app fake guard (§6.4): drives the full gate flow — shield, gate
 * session, grant, expiry — entirely inside the RN app, with no OS
 * permissions or native modules involved. Default guard for daily
 * development; the debug screen that simulates "limit reached" ships
 * in Phase 3 alongside the gate session UI.
 */
export class MockGuard implements AppGuard {
  private guards: GuardConfig[] = [];
  private gateListeners = new Set<(appId: string) => void>();
  private usage = new Map<string, Minutes>();

  async requestPermissions(): Promise<PermissionState> {
    return 'granted';
  }

  async listInstalledApps(): Promise<GuardableApp[]> {
    return MOCK_APPS;
  }

  async setGuards(guards: GuardConfig[]): Promise<void> {
    this.guards = guards;
  }

  async grantWindow(_appId: string, _minutes: Minutes): Promise<void> {
    // Grant bookkeeping lives in the toll engine (domain layer, Phase 3);
    // MockGuard just needs to exist as a valid AppGuard for now.
  }

  async revokeAllGrants(): Promise<void> {}

  onGateRequested(cb: (appId: string) => void): Unsubscribe {
    this.gateListeners.add(cb);
    return () => this.gateListeners.delete(cb);
  }

  async getTodayUsage(appId: string): Promise<Minutes> {
    return this.usage.get(appId) ?? 0;
  }

  /** Test/debug hook: simulate the user hitting the shield for `appId`. */
  simulateGateRequest(appId: string): void {
    for (const listener of this.gateListeners) listener(appId);
  }
}
