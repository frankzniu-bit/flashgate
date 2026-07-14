import { MockGuard } from './MockGuard';

/** Single shared MockGuard instance for the whole app — the default guard
 * implementation for daily development (§6.4). */
export const mockGuard = new MockGuard();
