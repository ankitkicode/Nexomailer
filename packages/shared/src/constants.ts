export const NEXOMAILER_VERSION = '0.1.0';

export const DEFAULTS = {
  FAILOVER: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    strategy: 'sequential' as const,
  },
  POOL: {
    maxConnections: 5,
    maxMessages: 100,
    idleTimeout: 30_000,
  },
  SMTP: {
    port: 587,
    secure: false,
    connectionTimeout: 10_000,
    socketTimeout: 30_000,
  },
  QUEUE: {
    concurrency: 5,
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
  },
  AI: {
    model: 'gpt-4o-mini',
    maxTokens: 2048,
    temperature: 0.7,
  },
} as const;

export const SMTP_CODES = {
  READY: 220,
  CLOSING: 221,
  AUTH_SUCCESS: 235,
  OK: 250,
  AUTH_CONTINUE: 334,
  START_INPUT: 354,
  UNAVAILABLE: 421,
  MAILBOX_FULL: 452,
  SYNTAX_ERROR: 500,
  AUTH_REQUIRED: 530,
  AUTH_FAILED: 535,
  MAILBOX_NOT_FOUND: 550,
} as const;

export const MIME_TYPES = {
  HTML: 'text/html',
  PLAIN: 'text/plain',
  MIXED: 'multipart/mixed',
  ALTERNATIVE: 'multipart/alternative',
  RELATED: 'multipart/related',
  OCTET_STREAM: 'application/octet-stream',
} as const;
