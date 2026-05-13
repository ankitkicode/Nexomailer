import { describe, it, expect } from 'vitest';
import { defaultRegistry } from '../src/registry.js';
import { ResendProviderAdapter } from '../src/resend.js';

describe('Providers Registry', () => {
  it('should register and resolve built-in providers', () => {
    const providers = defaultRegistry.createProviders([
      { type: 'resend', priority: 1, config: { apiKey: 'test' } }
    ]);
    expect(providers).toHaveLength(1);
    expect(providers[0]).toBeInstanceOf(ResendProviderAdapter);
  });
});
