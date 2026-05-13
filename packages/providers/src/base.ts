import type { ProviderSendOptions, ProviderResult, QuotaInfo } from '@nexomailer/shared';

/**
 * Abstract base class for all email providers.
 * Every provider (SMTP, Resend, SES, etc.) must extend this.
 */
export abstract class EmailProvider {
  abstract readonly name: string;

  /** Send an email through this provider */
  abstract send(options: ProviderSendOptions): Promise<ProviderResult>;

  /** Verify provider credentials/connection */
  abstract verify(): Promise<boolean>;

  /** Check if this provider supports open/click tracking natively */
  supportsTracking(): boolean {
    return false;
  }

  /** Check if this provider supports batch sending */
  supportsBatch(): boolean {
    return false;
  }

  /** Get current quota/rate limit info */
  async getQuota(): Promise<QuotaInfo | null> {
    return null;
  }

  /** Dispose/cleanup resources */
  async dispose(): Promise<void> {
    // Override in subclasses if needed
  }
}
