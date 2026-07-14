import { requireNativeModule, type EventSubscription } from 'expo-modules-core';

interface FlashgateGuardEvents {
  onGateRequested(event: { appPackage: string }): void;
}

// The object requireNativeModule returns is itself an EventEmitter (as of
// Expo SDK 52 — no separate `new EventEmitter(nativeModule)` wrapper needed).
interface NativeFlashgateGuard {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  hasNotificationPermission(): boolean;
  requestNotificationPermission(): Promise<boolean>;
  listInstalledApps(): { id: string; displayName: string }[];
  getTodayUsageMinutes(appPackage: string): number;
  startMonitoring(guards: { appPackage: string; dailyLimitMinutes: number }[]): void;
  updateGuards(guards: { appPackage: string; dailyLimitMinutes: number }[]): void;
  stopMonitoring(): void;
  grantWindow(appPackage: string, minutes: number): void;
  revokeAllGrants(): void;
  addListener<EventName extends keyof FlashgateGuardEvents>(
    eventName: EventName,
    listener: FlashgateGuardEvents[EventName],
  ): EventSubscription;
}

// Lazy, not module-top-level: this native module only exists on Android
// (expo-module.config.json restricts it to that platform), and importing
// this file must stay safe even before any Android-specific UI selects it.
let cached: NativeFlashgateGuard | null = null;
function nativeModule(): NativeFlashgateGuard {
  if (!cached) {
    cached = requireNativeModule<NativeFlashgateGuard>('FlashgateGuard');
  }
  return cached;
}

export function hasUsageAccess(): boolean {
  return nativeModule().hasUsageAccess();
}

export function openUsageAccessSettings(): void {
  nativeModule().openUsageAccessSettings();
}

export function hasNotificationPermission(): boolean {
  return nativeModule().hasNotificationPermission();
}

export function requestNotificationPermission(): Promise<boolean> {
  return nativeModule().requestNotificationPermission();
}

export function listInstalledApps(): { id: string; displayName: string }[] {
  return nativeModule().listInstalledApps();
}

export function getTodayUsageMinutes(appPackage: string): number {
  return nativeModule().getTodayUsageMinutes(appPackage);
}

export function startMonitoring(guards: { appPackage: string; dailyLimitMinutes: number }[]): void {
  nativeModule().startMonitoring(guards);
}

export function updateGuards(guards: { appPackage: string; dailyLimitMinutes: number }[]): void {
  nativeModule().updateGuards(guards);
}

export function stopMonitoring(): void {
  nativeModule().stopMonitoring();
}

export function grantWindow(appPackage: string, minutes: number): void {
  nativeModule().grantWindow(appPackage, minutes);
}

export function revokeAllGrants(): void {
  nativeModule().revokeAllGrants();
}

export function onGateRequested(callback: (appPackage: string) => void): EventSubscription {
  return nativeModule().addListener('onGateRequested', (event) => callback(event.appPackage));
}
