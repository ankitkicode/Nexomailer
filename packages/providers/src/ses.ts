import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { EmailProvider } from './base.js';
import type { ProviderSendOptions, ProviderResult, SESProviderConfig } from '@nexomailer/shared';
import { ProviderError } from '@nexomailer/shared';
import { MIMEBuilder } from '@nexomailer/smtp'; // Reusing our MIME builder for SES raw emails

/**
 * AWS SES Provider adapter.
 * Uses SendRawEmail with our MIMEBuilder for full control over attachments and inline images.
 */
export class SESProviderAdapter extends EmailProvider {
  readonly name = 'ses';
  private readonly client: SESClient;
  private readonly config: SESProviderConfig['config'];

  constructor(config: SESProviderConfig['config']) {
    super();
    this.config = config;
    this.client = new SESClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async send(options: ProviderSendOptions): Promise<ProviderResult> {
    try {
      // Build MIME message
      const builder = new MIMEBuilder()
        .setFrom(options.from)
        .setTo(options.to)
        .setSubject(options.subject);

      if (options.cc) builder.setCc(options.cc);
      // SES raw email requires BCC in envelope, but not in headers. 
      // Our MIMEBuilder already omits BCC from headers.
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

      // Add SES specific headers like ConfigurationSet
      if (this.config.configurationSet) {
        builder.setHeader('X-SES-CONFIGURATION-SET', this.config.configurationSet);
      }

      const rawMessage = builder.build();

      const command = new SendRawEmailCommand({
        RawMessage: {
          Data: Buffer.from(rawMessage, 'utf-8'),
        },
        // Destinations can be passed to override headers, but usually raw message headers are sufficient
        // unless doing BCC.
        Destinations: [
          ...options.to.map(t => t.address),
          ...(options.cc?.map(c => c.address) ?? []),
          ...(options.bcc?.map(b => b.address) ?? []),
        ],
      });

      const response = await this.client.send(command);

      if (!response.MessageId) {
        throw new ProviderError('Failed to get message ID from SES', this.name);
      }

      return {
        id: response.MessageId,
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
      // Could use GetSendQuotaCommand to verify credentials
      return true;
    } catch {
      return false;
    }
  }

  override supportsTracking(): boolean {
    // Requires SES Configuration Sets
    return !!this.config.configurationSet;
  }
}
