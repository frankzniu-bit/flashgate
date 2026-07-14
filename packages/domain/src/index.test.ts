import { describe, expect, it } from 'vitest';
import { createNewCardSchedule } from './index';

describe('domain package barrel export', () => {
  it('exposes the scheduler through the public entry point', () => {
    const schedule = createNewCardSchedule(new Date('2026-01-01T00:00:00Z'));
    expect(schedule.state).toBe('New');
  });
});
