// ═══════════════════════════════════════════════════════════
// @nexomailer/shared — Error Classes
// ═══════════════════════════════════════════════════════════

/**
 * Base error class for all NexoMailer errors.
 * Every error in the SDK extends this, making catch filtering easy.
 */
export class NexoError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'NexoError';
    this.code = code;
    this.timestamp = new Date();
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
    };
  }
}

// ─── Configuration Errors ────────────────────────────────

export class ConfigurationError extends NexoError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', context);
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends NexoError {
  public readonly field?: string;

  constructor(message: string, field?: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// ─── Provider Errors ─────────────────────────────────────

export class ProviderError extends NexoError {
  public readonly provider: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    provider: string,
    statusCode?: number,
    context?: Record<string, unknown>,
  ) {
    super(message, 'PROVIDER_ERROR', context);
    this.name = 'ProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

export class ProviderNotFoundError extends NexoError {
  constructor(provider: string) {
    super(`Provider "${provider}" is not registered`, 'PROVIDER_NOT_FOUND', { provider });
    this.name = 'ProviderNotFoundError';
  }
}

export class FailoverExhaustedError extends NexoError {
  public readonly attempts: number;
  public readonly errors: Error[];

  constructor(attempts: number, errors: Error[]) {
    super(
      `All ${attempts} provider attempts failed. Last error: ${errors[errors.length - 1]?.message ?? 'unknown'}`,
      'FAILOVER_EXHAUSTED',
      { attempts },
    );
    this.name = 'FailoverExhaustedError';
    this.attempts = attempts;
    this.errors = errors;
  }
}

// ─── SMTP Errors ─────────────────────────────────────────

export class SMTPError extends NexoError {
  public readonly smtpCode?: number;
  public readonly enhancedCode?: string;

  constructor(
    message: string,
    smtpCode?: number,
    enhancedCode?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'SMTP_ERROR', context);
    this.name = 'SMTPError';
    this.smtpCode = smtpCode;
    this.enhancedCode = enhancedCode;
  }
}

export class SMTPConnectionError extends NexoError {
  public readonly host: string;
  public readonly port: number;

  constructor(message: string, host: string, port: number) {
    super(message, 'SMTP_CONNECTION_ERROR', { host, port });
    this.name = 'SMTPConnectionError';
    this.host = host;
    this.port = port;
  }
}

export class SMTPAuthError extends NexoError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SMTP_AUTH_ERROR', context);
    this.name = 'SMTPAuthError';
  }
}

export class SMTPTimeoutError extends NexoError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `SMTP operation "${operation}" timed out after ${timeoutMs}ms`,
      'SMTP_TIMEOUT',
      { operation, timeoutMs },
    );
    this.name = 'SMTPTimeoutError';
  }
}

// ─── Queue Errors ────────────────────────────────────────

export class QueueError extends NexoError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'QUEUE_ERROR', context);
    this.name = 'QueueError';
  }
}

export class QueueConnectionError extends NexoError {
  constructor(message: string) {
    super(message, 'QUEUE_CONNECTION_ERROR');
    this.name = 'QueueConnectionError';
  }
}

// ─── AI Errors ───────────────────────────────────────────

export class AIError extends NexoError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AI_ERROR', context);
    this.name = 'AIError';
  }
}

export class AIRateLimitError extends NexoError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    super(
      `AI rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      'AI_RATE_LIMIT',
      { retryAfter },
    );
    this.name = 'AIRateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ─── Template Errors ─────────────────────────────────────

export class TemplateError extends NexoError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TEMPLATE_ERROR', context);
    this.name = 'TemplateError';
  }
}

export class TemplateNotFoundError extends NexoError {
  constructor(templateName: string) {
    super(`Template "${templateName}" not found`, 'TEMPLATE_NOT_FOUND', { templateName });
    this.name = 'TemplateNotFoundError';
  }
}

// ─── Tracking Errors ─────────────────────────────────────

export class TrackingError extends NexoError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TRACKING_ERROR', context);
    this.name = 'TrackingError';
  }
}

export class WebhookDeliveryError extends NexoError {
  public readonly webhookUrl: string;
  public readonly statusCode?: number;

  constructor(webhookUrl: string, statusCode?: number, context?: Record<string, unknown>) {
    super(
      `Webhook delivery to "${webhookUrl}" failed${statusCode ? ` with status ${statusCode}` : ''}`,
      'WEBHOOK_DELIVERY_ERROR',
      context,
    );
    this.name = 'WebhookDeliveryError';
    this.webhookUrl = webhookUrl;
    this.statusCode = statusCode;
  }
}
