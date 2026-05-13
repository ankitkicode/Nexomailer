import { describe, it, expect } from 'vitest';
import { SMTPClient } from '../src/client.js';

describe('SMTPClient', () => {
  it('should initialize successfully', () => {
    const client = new SMTPClient({ host: 'localhost', port: 587 });
    expect(client).toBeDefined();
  });
});
