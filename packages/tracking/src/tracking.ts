import { Router } from 'express';
import * as cheerio from 'cheerio';
import type { TrackingConfig, TrackingEvent, WebhookConfig } from '@nexomailer/shared';
import { WebhookDeliveryError, createLogger, signPayload } from '@nexomailer/shared';

// Base64 encoded 1x1 transparent GIF
const TRANSPARENT_PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

import type { AnalyticsModule } from '@nexomailer/analytics';

/**
 * Tracking module for NexoMailer.
 * Injects pixels, rewrites links, provides Express middleware, and dispatches webhooks.
 */
export class TrackingModule {
  private readonly config: TrackingConfig;
  private readonly analytics?: AnalyticsModule;
  private readonly logger = createLogger({ prefix: 'tracking' });

  // In-memory event store for fallback
  private readonly events: TrackingEvent[] = [];
  private readonly parsers = new Map<string, (payload: any) => { eventType: string; messageId: string; metadata?: any } | null>();

  constructor(config: TrackingConfig, analytics?: AnalyticsModule) {
    this.config = config;
    this.analytics = analytics;

    // Register built-in parsers
    this.registerParser('resend', (payload) => {
      const resendEventMap: Record<string, string> = {
        'email.sent': 'email.sent',
        'email.delivered': 'email.delivered',
        'email.bounced': 'email.bounced',
        'email.complained': 'email.complained',
      };
      const eventType = resendEventMap[payload.type];
      const messageId = payload.data?.tags?.find((t: any) => t.name === 'nexo_id')?.value;
      if (!eventType || !messageId) return null;
      return { eventType, messageId, metadata: { providerId: payload.data?.id, ...payload.data } };
    });
  }

  /**
   * Register a custom webhook parser for a new provider
   */
  registerParser(name: string, parser: (payload: any) => { eventType: string; messageId: string; metadata?: any } | null): void {
    this.parsers.set(name, parser);
    this.logger.debug(`Registered webhook parser for: ${name}`);
  }

  /**
   * Instrument HTML email with tracking
   */
  instrument(messageId: string, html: string): string {
    if (!this.config.enabled || (!this.config.opens && !this.config.clicks)) {
      return html;
    }

    try {
      const $ = cheerio.load(html);

      // Inject open tracking pixel
      if (this.config.opens) {
        const pixelUrl = `${this.config.baseUrl}/track/open/${messageId}`;
        $('body').append(`<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`);
      }

      // Rewrite links for click tracking
      if (this.config.clicks) {
        $('a').each((_, el) => {
          const originalUrl = $(el).attr('href');
          if (originalUrl && !originalUrl.startsWith('mailto:') && !originalUrl.startsWith('tel:')) {
            const encodedUrl = encodeURIComponent(originalUrl);
            const trackingUrl = `${this.config.baseUrl}/track/click/${messageId}?url=${encodedUrl}`;
            $(el).attr('href', trackingUrl);
          }
        });
      }

      return $.html();
    } catch (error) {
      this.logger.error(`Failed to instrument HTML for ${messageId}`, { error });
      return html; // Return original on failure
    }
  }

  /**
   * Express middleware router for tracking endpoints.
   * Mount this in your Express app to automatically handle tracking:
   * app.use('/api', mailer.tracking.middleware());
   */
  middleware(): Router {
    const router = Router();

    // GET /track/open/:messageId
    router.get('/track/open/:messageId', async (req, res) => {
      const { messageId } = req.params;

      if (messageId) {
        console.log(`\n🔔 [TRACKING] Received OPEN event for message: ${messageId}`);
        await this.recordEvent({
          id: crypto.randomUUID(),
          messageId,
          type: 'email.opened',
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get('User-Agent'),
          timestamp: new Date(),
        });
      }

      res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Content-Length': TRANSPARENT_PIXEL.length,
      });
      res.end(TRANSPARENT_PIXEL);
    });

    // GET /track/click/:messageId
    router.get('/track/click/:messageId', async (req, res) => {
      const { messageId } = req.params;
      const originalUrl = req.query.url as string;

      if (messageId && originalUrl) {
        console.log(`\n🔔 [TRACKING] Received CLICK event for message: ${messageId} -> ${originalUrl}`);
        await this.recordEvent({
          id: crypto.randomUUID(),
          messageId,
          type: 'email.clicked',
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.get('User-Agent'),
          url: decodeURIComponent(originalUrl),
          timestamp: new Date(),
        });
      }

      if (originalUrl) {
        res.redirect(302, decodeURIComponent(originalUrl));
      } else {
        res.status(400).send('Missing destination URL');
      }
    });

    // POST /track/webhook/:provider
    router.post('/track/webhook/:provider', async (req, res) => {
      const { provider } = req.params;
      const payload = req.body;

      this.logger.debug(`Received webhook from ${provider}`);

      try {
        const parser = this.parsers.get(provider);
        if (!parser) {
          this.logger.warn(`No parser registered for provider: ${provider}`);
          return res.status(404).json({ error: 'Provider parser not found' });
        }

        const result = parser(payload);

        // 2. Record if valid
        if (result && result.messageId && result.eventType) {
          console.log(`\n🔔 [WEBHOOK] Received ${result.eventType} from ${provider} for message: ${result.messageId}`);
          await this.recordEvent({
            id: crypto.randomUUID(),
            messageId: result.messageId,
            type: result.eventType as any,
            timestamp: new Date(),
            metadata: result.metadata
          });
        }

        res.status(200).json({ received: true });
      } catch (error) {
        this.logger.error(`Webhook processing failed: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    return router;
  }

  /**
   * Record an event and dispatch webhooks
   */
  async recordEvent(event: TrackingEvent): Promise<void> {
    this.events.push(event);
    this.logger.debug(`Event recorded: ${event.type} for ${event.messageId}`);

    // Persist to analytics if connected
    if (this.analytics) {
      this.analytics.record(event).catch((err: any) => {
        this.logger.error(`Failed to record tracking event to analytics: ${err.message}`);
      });
    }

    if (this.config.webhooks && this.config.webhooks.length > 0) {
      for (const webhook of this.config.webhooks) {
        if (webhook.events.includes(event.type)) {
          // Fire and forget, or push to queue in a real system
          this.dispatchWebhook(webhook, event).catch(err => {
            this.logger.error(`Webhook dispatch failed: ${err.message}`);
          });
        }
      }
    }
  }

  /**
   * Dispatch a webhook payload
   */
  private async dispatchWebhook(webhook: WebhookConfig, event: TrackingEvent): Promise<void> {
    const payload = JSON.stringify({
      event: event.type,
      data: event,
      timestamp: new Date().toISOString(),
    });

    const signature = signPayload(payload, webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-NexoMailer-Signature': signature,
          'User-Agent': 'NexoMailer-Webhook/1.0',
        },
        body: payload,
      });

      if (!response.ok) {
        throw new WebhookDeliveryError(webhook.url, response.status);
      }
    } catch (error) {
      if (error instanceof WebhookDeliveryError) throw error;
      throw new WebhookDeliveryError(webhook.url, undefined, { originalError: error });
    }
  }

  /**
   * Get recorded events (for MVP in-memory store)
   */
  async getEvents(messageId: string): Promise<TrackingEvent[]> {
    return this.events.filter(e => e.messageId === messageId);
  }
}
