import { Resend } from 'resend';
import { EmailProvider } from './base.js';
import type { ProviderSendOptions, ProviderResult, ResendProviderConfig } from '@nexomailer/shared';
import { ProviderError } from '@nexomailer/shared';

/**
 * Resend Provider adapter.
 * Uses the official Resend SDK.
 */
export class ResendProviderAdapter extends EmailProvider {
  readonly name = 'resend';
  private readonly client: Resend;

  constructor(config: ResendProviderConfig['config']) {
    super();
    this.client = new Resend(config.apiKey);
    // Note: The resend SDK doesn't easily expose changing the baseUrl via config directly in standard constructor for all versions, 
    // but assuming standard usage for now. If baseUrl is needed, it might require a custom fetch or interceptor.
  }

  async send(options: ProviderSendOptions): Promise<ProviderResult> {
    try {
      // Map options to Resend format
      const fromFormatted = options.from.name 
        ? `${options.from.name} <${options.from.address}>` 
        : options.from.address;

      const toFormatted = options.to.map(t => t.address);
      const ccFormatted = options.cc?.map(c => c.address);
      const bccFormatted = options.bcc?.map(b => b.address);
      const replyToFormatted = options.replyTo ? options.replyTo.address : undefined;

      const attachments = options.attachments?.map(att => ({
        filename: att.filename,
        content: typeof att.content === 'string' ? Buffer.from(att.content, att.encoding || 'utf-8') : att.content,
      }));

      const { data, error } = await this.client.emails.send({
        from: fromFormatted,
        to: toFormatted,
        cc: ccFormatted,
        bcc: bccFormatted,
        replyTo: replyToFormatted,
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: options.headers,
        attachments: attachments,
        tags: options.tags?.map(tag => ({ name: 'tag', value: tag })),
      } as any);

      if (error) {
        throw new ProviderError(error.message, this.name, undefined, { originalError: error });
      }

      if (!data || !data.id) {
         throw new ProviderError('Failed to get message ID from Resend', this.name);
      }

      return {
        id: data.id,
        status: 'sent',
        rawResponse: data,
      };

    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        error instanceof Error ? error.message : String(error),
        this.name,
        undefined,
        { originalError: error }
      );
    }
  }

  async verify(): Promise<boolean> {
    try {
      // Resend doesn't have a direct ping/verify endpoint that is free of side-effects in standard API,
      // but we can try to fetch domains or api keys to check auth if permissions allow, 
      // or we just return true and assume it will fail on send if invalid.
      // For MVP, returning true.
      return true;
    } catch {
      return false;
    }
  }

  override supportsTracking(): boolean {
    return true; // Resend supports open/click tracking natively
  }

  override supportsBatch(): boolean {
    return true; // Resend supports batch API
  }
}
