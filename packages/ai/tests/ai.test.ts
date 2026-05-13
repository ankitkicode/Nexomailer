import { describe, it, expect } from 'vitest';
import { AIModule } from '../src/ai.js';

describe('AIModule', () => {
  it('should initialize successfully', () => {
    const ai = new AIModule({ provider: 'openai', apiKey: 'test' });
    expect(ai).toBeDefined();
  });
});
