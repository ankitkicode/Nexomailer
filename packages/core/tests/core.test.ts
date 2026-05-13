import { describe, it, expect, vi } from 'vitest';
import { NexoMailer } from '../src';
import { defaultRegistry } from '@nexomailer/providers';

describe('NexoMailer Core', () => {
  it('should construct with valid configuration', async () => {
    const mailer = new NexoMailer({
      providers: [
        { type: 'smtp', priority: 1, config: { host: 'test', port: 25 } }
      ],
      failover: { enabled: true, maxRetries: 3, strategy: 'sequential', retryDelay: 0 },
      defaults: { from: 'hello@nexomailer.dev' }
    });
    
    expect(mailer).toBeInstanceOf(NexoMailer);
  });

  it('should call failover engine correctly', async () => {
    const mailer = new NexoMailer({
      providers: [
        { type: 'smtp', priority: 1, config: { host: 'test', port: 25 } }
      ],
      failover: { enabled: true, maxRetries: 3, strategy: 'sequential', retryDelay: 0 },
      defaults: { from: 'hello@nexomailer.dev' }
    });
    
    // Mock the execute method of failover engine
    const executeSpy = vi.spyOn(mailer['failoverEngine'], 'execute').mockResolvedValue({
      id: 'test-id',
      providerName: 'smtp',
      status: 'sent',
      rawResponse: 'ok'
    });

    const result = await mailer.send({
      to: 'test@test.com',
      subject: 'Hello',
      html: '<p>Test</p>'
    });

    expect(executeSpy).toHaveBeenCalled();
    expect(result.provider).toBe('smtp');
    expect(result.status).toBe('sent');
  });
});
