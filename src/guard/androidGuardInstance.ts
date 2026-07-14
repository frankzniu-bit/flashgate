import { AndroidGuard } from './AndroidGuard';

/** Single shared AndroidGuard instance — safe to construct on any platform
 * since it only touches the native module lazily, inside method calls. */
export const androidGuard = new AndroidGuard();
