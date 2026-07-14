export type PermissionState = 'granted' | 'denied' | 'not-determined';

export interface GuardableApp {
  id: string;
  displayName: string;
}

export interface GuardConfig {
  appId: string;
  dailyLimitMinutes: number;
}

export type Minutes = number;
export type Unsubscribe = () => void;

/**
 * One interface, three implementations (§6.3): MockGuard (dev & simulator,
 * default for daily development), AndroidGuard, IOSGuard.
 */
export interface AppGuard {
  requestPermissions(): Promise<PermissionState>;
  listInstalledApps(): Promise<GuardableApp[]>;
  setGuards(guards: GuardConfig[]): Promise<void>;
  grantWindow(appId: string, minutes: Minutes): Promise<void>;
  revokeAllGrants(): Promise<void>;
  onGateRequested(cb: (appId: string) => void): Unsubscribe;
  getTodayUsage(appId: string): Promise<Minutes>;
}
