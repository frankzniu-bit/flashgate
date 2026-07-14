import { describe, expect, it } from 'vitest';
import { domainLayerReady } from './index';

describe('domain package', () => {
  it('loads under plain Node with no React Native imports', () => {
    expect(domainLayerReady).toBe(true);
  });
});
