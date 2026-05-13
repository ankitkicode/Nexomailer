import { describe, it, expect } from 'vitest';
import { sendOptionsSchema, nexoMailerConfigSchema } from '../src/validation';

describe('Validation Schemas', () => {
  describe('sendOptionsSchema', () => {
    it('should validate correct single recipient options', () => {
      const valid = {
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>'
      };
      const result = sendOptionsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should validate array of recipients', () => {
      const valid = {
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Subject',
        text: 'Test content'
      };
      const result = sendOptionsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should fail if missing to or subject', () => {
      const invalid = {
        html: '<p>Test</p>'
      };
      const result = sendOptionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => e.path.includes('to'))).toBe(true);
        expect(result.error.errors.some(e => e.path.includes('subject'))).toBe(true);
      }
    });
  });

  describe('nexoMailerConfigSchema', () => {
    it('should validate basic config', () => {
      const config = {
        providers: [
          { type: 'smtp', priority: 1, config: { host: 'smtp.test', port: 587 } }
        ],
        failover: { enabled: true }
      };
      const result = nexoMailerConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success && result.data.failover) {
        expect(result.data.failover.enabled).toBe(true);
      }
    });
  });
});
