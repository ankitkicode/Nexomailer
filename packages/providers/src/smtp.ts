import { EmailProvider } from './base.js';
import type { ProviderSendOptions, ProviderResult, SMTPConfig } from '@nexomailer/shared';
import { generateId, ProviderError } from '@nexomailer/shared';
import { SMTPPool, MIMEBuilder, SMTPClient } from '@nexomailer/smtp';

/**
 * Native SMTP Provider wrapping @nexomailer/smtp.
 * Uses a connection pool for efficient delivery.
 */
export class NativeSMTPProvider extends EmailProvider {
  readonly name = 'smtp';
  private pool: SMTPPool | null = null;
  private readonly config: SMTPConfig;

  constructor(config: SMTPConfig) {
    super();
    this.config = config;
  }

  async send(options: ProviderSendOptions): Promise<ProviderResult> {
    try {
      this.initPool();

      const builder = new MIMEBuilder()
        .setFrom(options.from)
        .setTo(options.to)
        .setSubject(options.subject);

      if (options.cc) builder.setCc(options.cc);
      if (options.replyTo) builder.setReplyTo(options.replyTo);
      if (options.html) builder.setHtml(options.html);
      if (options.text) builder.setText(options.text);

      if (options.attachments) {
        for (const att of options.attachments) {
          builder.addAttachment(att);
        }
      }

      if (options.headers) {
        for (const [key, val] of Object.entries(options.headers)) {
          builder.setHeader(key, val);
        }
      }

      const messageId = generateId();
      builder.setMessageId(`${messageId}@nexomailer`);

      const rawMessage = builder.build();
      const envelope = {
        from: options.from.address,
        to: [
          ...options.to.map(t => t.address),
          ...(options.cc?.map(c => c.address) ?? []),
          ...(options.bcc?.map(b => b.address) ?? []),
        ],
      };

      const response = await this.pool!.send(envelope, rawMessage);

      return {
        id: messageId,
        status: 'sent',
        rawResponse: response,
      };
    } catch (error) {
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
      // Just create a single client to verify connection/auth, don't use pool
      const client = new SMTPClient({
        ...this.config,
        connectionTimeout: 5000,
        socketTimeout: 5000,
      });
      await client.connect();
      await client.close();
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    if (this.pool) {
      await this.pool.drain();
      this.pool = null;
    }
  }

  private initPool() {
    if (!this.pool) {
      this.pool = new SMTPPool({
        ...this.config,
        maxConnections: 3, // Default conservative pool for provider
      });
    }
  }
}
