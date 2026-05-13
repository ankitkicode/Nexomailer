import crypto from 'node:crypto';
import type {
  NexoMailerConfig,
  SendOptions,
  SendResult,
  NexoPlugin,
  SendContext,
  HealthStatus
} from '@nexomailer/shared';
import {
  nexoMailerConfigSchema,
  sendOptionsSchema,
  ValidationError,
  createLogger,
  parseAddress,
  normalizeAddresses
} from '@nexomailer/shared';
import { defaultRegistry } from '@nexomailer/providers';
import { FailoverEngine } from './failover.js';

import { AIModule } from '@nexomailer/ai';
import { TemplateEngine } from '@nexomailer/templates';
import { QueueModule } from '@nexomailer/queue';
import { TrackingModule } from '@nexomailer/tracking';
import { AnalyticsModule } from '@nexomailer/analytics';

export class NexoMailer {
  private readonly config: NexoMailerConfig;
  private readonly failoverEngine: FailoverEngine;
  private readonly plugins: NexoPlugin[] = [];
  private readonly logger;
  private initialized = false;

  // Lazily loaded modules
  private _ai?: AIModule;
  private _templates?: TemplateEngine;
  private _queue?: QueueModule;
  private _tracking?: TrackingModule;
  private _analytics?: AnalyticsModule;

  constructor(config: NexoMailerConfig) {
    const parsed = nexoMailerConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new ValidationError('Invalid configuration', undefined, { errors: parsed.error.format() });
    }
    this.config = parsed.data;

    this.logger = createLogger(this.config.logger);
    
    // Initialize providers and failover
    const providers = defaultRegistry.createProviders(this.config.providers);
    this.failoverEngine = new FailoverEngine(providers, this.config.failover);

    if (this.config.plugins) {
      for (const plugin of this.config.plugins) {
        this.use(plugin);
      }
    }
  }

  get ai(): AIModule {
    if (!this._ai) {
      if (!this.config.ai) throw new Error("AI module is not configured in NexoMailer options.");
      this._ai = new AIModule({
        ...this.config.ai,
        branding: this.config.branding
      } as any);
    }
    return this._ai;
  }

  get templates(): TemplateEngine {
    if (!this._templates) {
      this._templates = new TemplateEngine();
      if (this.config.branding) {
        this._templates.setGlobalData({ branding: this.config.branding });
      }
    }
    return this._templates;
  }

  get queue(): QueueModule {
    if (!this._queue) {
      if (!this.config.queue) throw new Error("Queue module is not configured in NexoMailer options.");
      
      const processJob = async (options: any) => {
        const { scheduledAt, ...immediateOptions } = options;
        return this.send(immediateOptions);
      };

      this._queue = new QueueModule(processJob, this.config.queue);
    }
    return this._queue;
  }

  get tracking(): TrackingModule {
    if (!this._tracking) {
      if (!this.config.tracking) throw new Error("Tracking module is not configured in NexoMailer options.");
      this._tracking = new TrackingModule(this.config.tracking, this.analytics);
    }
    return this._tracking;
  }

  get analytics(): AnalyticsModule {
    if (!this._analytics) {
      this._analytics = new AnalyticsModule(this.config.analytics);
    }
    return this._analytics;
  }

  /**
   * Register a plugin
   */
  use(plugin: NexoPlugin): void {
    this.plugins.push(plugin);
    this.logger.debug(`Registered plugin: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Initialize SDK and plugins
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    for (const plugin of this.plugins) {
      if (plugin.hooks.onInit) {
        await plugin.hooks.onInit(this.config);
      }
    }

    if (this.config.analytics) {
      await this.analytics.init();
    }

    this.initialized = true;
    this.logger.info('NexoMailer initialized');
  }

  /**
   * Send an email
   */
  async send(options: SendOptions): Promise<SendResult> {
    await this.init();

    // Validate options
    const parsedOptions = sendOptionsSchema.safeParse(options);
    if (!parsedOptions.success) {
      throw new ValidationError('Invalid send options', undefined, { errors: parsedOptions.error.format() });
    }

    const validOptions = parsedOptions.data;

    // Apply defaults
    const finalFrom = validOptions.from ?? this.config.defaults?.from;
    if (!finalFrom) {
      throw new ValidationError('Sender address (from) is required');
    }

    const payload = {
      ...validOptions,
      from: finalFrom,
      replyTo: validOptions.replyTo ?? this.config.defaults?.replyTo,
    };

    let context: SendContext = {
      options: payload as SendOptions,
      attempt: 1,
      metadata: payload.metadata ?? {},
    };

    try {
      // Execute beforeSend plugins
      for (const plugin of this.plugins) {
        if (plugin.hooks.beforeSend) {
          context = await plugin.hooks.beforeSend(context);
        }
      }

      // Convert shared Address formats to Provider formats
      const fromAddr = typeof context.options.from === 'string' ? parseAddress(context.options.from) : context.options.from as any;
      const providerOptions = {
        from: fromAddr,
        to: normalizeAddresses(context.options.to),
        cc: context.options.cc ? normalizeAddresses(context.options.cc) : undefined,
        bcc: context.options.bcc ? normalizeAddresses(context.options.bcc) : undefined,
        replyTo: context.options.replyTo ? (typeof context.options.replyTo === 'string' ? parseAddress(context.options.replyTo) : context.options.replyTo as any) : undefined,
        subject: context.options.subject,
        html: context.options.html,
        text: context.options.text,
        attachments: context.options.attachments,
        headers: context.options.headers,
        tags: context.options.tags,
        metadata: context.options.metadata,
      };

      // Handle Scheduling via Queue Module
      if (context.options.scheduledAt) {
        if (!this.config.queue) {
          throw new ValidationError('Queue module is required for scheduled sending, but is not configured.');
        }
        
        const job = await this.queue.schedule({
          ...context.options,
          html: context.options.html || ''
        });

        const queuedResult: SendResult = {
          id: String(job.jobId || crypto.randomUUID()),
          provider: 'queue',
          status: 'queued',
          timestamp: new Date(),
          attempts: 0,
        };

        this.logger.info(`Email scheduled successfully in queue`, { jobId: job.jobId });
        return queuedResult;
      }

      const startTime = Date.now();
      const trackingId = crypto.randomUUID();
      
      // Apply Tracking if configured globally and for this message
      const shouldTrack = validOptions.tracking !== false && this.config.tracking?.enabled;
      if (shouldTrack) {
        try {
          providerOptions.html = this.tracking.instrument(
            trackingId,
            providerOptions.html || ''
          );
        } catch (err) {
          this.logger.warn(`Tracking instrumentation failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Execute send via failover engine
      const failoverResult = await this.failoverEngine.execute(providerOptions);
      
      const result: SendResult = {
        id: failoverResult.id,
        provider: failoverResult.providerName,
        status: failoverResult.status,
        timestamp: new Date(),
        attempts: context.attempt,
        metadata: failoverResult.rawResponse ? { raw: failoverResult.rawResponse } : undefined,
      };

      this.logger.info(`Email sent successfully via ${result.provider}`, { 
        id: result.id,
        latencyMs: Date.now() - startTime 
      });

      // Record Analytics
      if (this.config.analytics) {
        const to = Array.isArray(context.options.to) ? context.options.to[0] : context.options.to;
        const recipientEmail = typeof to === 'string' ? to : (to as any)?.address;

        this.analytics.record({
          id: crypto.randomUUID(),
          messageId: trackingId, // Use our internal ID as the primary key
          type: 'email.sent',
          provider: result.provider,
          recipient: recipientEmail,
          subject: context.options.subject,
          timestamp: result.timestamp,
          metadata: {
            ...result.metadata,
            providerId: result.id, // Store the provider's ID here
            projectId: this.config.analytics?.projectId,
            environment: this.config.analytics?.environment,
            tags: context.options.tags
          }
        }).catch(err => {
          this.logger.error(`Failed to record analytics: ${err.message}`);
        });
      }

      const latency = Date.now() - startTime;
      this.logger.info(`Email sent successfully via ${result.provider}`, { id: trackingId, latencyMs: latency });

      // Execute afterSend plugins
      for (const plugin of this.plugins) {
        if (plugin.hooks.afterSend) {
          await plugin.hooks.afterSend(result);
        }
      }

      return {
        ...result,
        id: trackingId // Return our internal ID to the user
      };

    } catch (error) {
      this.logger.error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
      
      // Record Failure Analytics
      if (this.config.analytics) {
        this.analytics.record({
          id: crypto.randomUUID(),
          messageId: 'failed',
          type: 'email.bounced', // Or a custom error type
          timestamp: new Date(),
          metadata: { error: error instanceof Error ? error.message : String(error) }
        }).catch(() => {});
      }
      // Execute onError plugins
      for (const plugin of this.plugins) {
        if (plugin.hooks.onError) {
          await plugin.hooks.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }

      throw error;
    }
  }

  /**
   * Check system health
   */
  async healthCheck(): Promise<HealthStatus> {
    // This will be expanded as we add more modules
    return {
      status: 'healthy',
      providers: {},
      uptime: process.uptime(),
    };
  }
}
