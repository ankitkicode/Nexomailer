import { describe, it, expect } from 'vitest';
import { QueueModule } from '../src/queue.js';

describe('QueueModule', () => {
  it('should initialize successfully', () => {
    const processJob = async () => ({ id: '1', provider: 'test', status: 'sent' as const, timestamp: new Date(), attempts: 1 });
    const queue = new QueueModule(processJob, { redis: { host: 'localhost', port: 6379 } });
    expect(queue).toBeDefined();
  });
});
