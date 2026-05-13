import mongoose, { Schema, model, models } from 'mongoose';
import type { AnalyticsSummary, TrackingEvent, RealtimeStats, TimeGroupBy } from '@nexomailer/shared';
import { createLogger } from '@nexomailer/shared';

export interface AnalyticsConfig {
  mongodbUri?: string;
  retentionDays?: number;
  projectId?: string;
  environment?: string;
}

export interface AnalyticsQueryOptions {
  from: Date;
  to: Date;
  groupBy?: TimeGroupBy;
  tags?: string[];
  provider?: string;
  projectId?: string;
  environment?: string;
}

export interface ProviderStats {
  provider: string;
  sent: number;
  failed: number;
  latencyMs: number;
}

// Unified Message Schema for Analytics & Dashboard
const MessageSchema = new Schema({
  messageId: { type: String, required: true, unique: true, index: true }, // Our internal UUID
  providerId: { type: String, index: true }, // The provider's ID (e.g. Resend ID)
  provider: { type: String, required: true, index: true },
  from: { type: String },
  recipient: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED', 'COMPLAINED'],
    default: 'SENT',
    index: true 
  },
  metadata: { type: Schema.Types.Mixed },
  sentAt: { type: Date, default: Date.now },
  tags: [{ type: String }],
  projectId: { type: String, index: true },
  environment: { type: String, index: true },
}, { timestamps: true });

// Event history for detailed tracking
const TrackingEventSchema = new Schema({
  messageId: { type: String, required: true, index: true },
  type: { type: String, required: true, index: true },
  ip: { type: String },
  userAgent: { type: String },
  url: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
});

export const Message = (models.Message || model('Message', MessageSchema)) as any;
export const TrackingEventModel = (models.TrackingEvent || model('TrackingEvent', TrackingEventSchema)) as any;

/**
 * Analytics module for NexoMailer.
 * Aggregates events and provides reporting capabilities.
 */
export class AnalyticsModule {
  private readonly logger = createLogger({ prefix: 'analytics' });
  private readonly config: AnalyticsConfig;
  private isConnected = false;
  private readonly events: TrackingEvent[] = []; // Memory fallback

  constructor(config: AnalyticsConfig = {}) {
    this.config = config;
    if (!this.config.mongodbUri) {
      this.logger.debug('Analytics module initialized (in-memory mode)');
    }
  }

  /**
   * Initialize connection to MongoDB
   */
  async init(): Promise<void> {
    if (!this.config.mongodbUri || this.isConnected) return;

    try {
      if (mongoose.connection?.readyState === 1) {
        this.isConnected = true;
        return;
      }
      await mongoose.connect(this.config.mongodbUri);
      this.isConnected = true;
      this.logger.info('Analytics connected to MongoDB');
    } catch (err) {
      this.logger.error(`Failed to connect analytics to MongoDB: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Record a new event into analytics
   */
  async record(event: TrackingEvent): Promise<void> {
    if (!this.config.mongodbUri) {
      this.events.push(event);
      this.logger.debug(`Recorded analytics event (memory): ${event.type}`);
      return;
    }

    try {
      await this.init();

      // 1. Save detailed event to history collection (Audit Trail)
      await TrackingEventModel.create({
        ...event,
        timestamp: event.timestamp || new Date(),
      });

      // 2. Map event type to database status
      const newStatus = event.type.replace('email.', '').toUpperCase();

      // 3. Smart status prioritization
      // Priority: CLICKED > OPENED > DELIVERED > SENT
      const statusPriority: Record<string, number> = {
        'CLICKED': 4,
        'OPENED': 3,
        'DELIVERED': 2,
        'SENT': 1,
        'BOUNCED': 0,
        'FAILED': 0,
        'COMPLAINED': 0
      };

      const existingMessage = await Message.findOne({ messageId: event.messageId });
      
      if (existingMessage) {
        const currentPrio = statusPriority[existingMessage.status] || 0;
        const newPrio = statusPriority[newStatus] || 0;

        // Only update status if it's a "higher" event or an error state
        const shouldUpdateStatus = newPrio > currentPrio || ['BOUNCED', 'FAILED', 'COMPLAINED'].includes(newStatus);

        const updateData: any = {
          updatedAt: new Date(),
          // Ensure we update metadata if provided (e.g. providerId, tags)
          ...(event.metadata ? { 
            $set: { 
              metadata: { ...existingMessage.metadata, ...event.metadata },
              projectId: (event.metadata as any)?.projectId || existingMessage.projectId,
              environment: (event.metadata as any)?.environment || existingMessage.environment,
              tags: (event.metadata as any)?.tags || existingMessage.tags,
            } 
          } : {})
        };

        if (shouldUpdateStatus) {
          if (!updateData.$set) updateData.$set = {};
          updateData.$set.status = newStatus;
        }

        // Increment counts for opens/clicks
        if (newStatus === 'OPENED') {
          if (!updateData.$inc) updateData.$inc = {};
          updateData.$inc.openCount = 1;
        }
        if (newStatus === 'CLICKED') {
          if (!updateData.$inc) updateData.$inc = {};
          updateData.$inc.clickCount = 1;
        }

        await Message.updateOne({ messageId: event.messageId }, updateData);
        console.log(`✅ [DATABASE] ${event.messageId}: ${existingMessage.status} -> ${newStatus} (Updated)`);
      } else {
        // Create new record if it doesn't exist (e.g. if record() is called for OPEN before SENT)
        await Message.create({
          messageId: event.messageId,
          recipient: event.recipient,
          subject: event.subject,
          status: newStatus,
          provider: event.provider,
          metadata: event.metadata,
          providerId: (event.metadata as any)?.providerId,
          projectId: (event.metadata as any)?.projectId,
          environment: (event.metadata as any)?.environment,
          tags: (event.metadata as any)?.tags,
          sentAt: event.type === 'email.sent' ? (event.timestamp || new Date()) : undefined,
          openCount: newStatus === 'OPENED' ? 1 : 0,
          clickCount: newStatus === 'CLICKED' ? 1 : 0,
        });
        console.log(`✅ [DATABASE] Created new record for ${event.messageId} as ${newStatus}`);
      }

      this.logger.debug(`Recorded ${event.type} for ${event.messageId}`);
    } catch (err) {
      this.logger.error(`Failed to record analytics for ${event.messageId}`, { err: err instanceof Error ? err.stack : String(err) });
    }
  }

  /**
   * Generate an analytics summary for a given time range
   */
  async getSummary(options: AnalyticsQueryOptions): Promise<AnalyticsSummary> {
    if (this.isConnected) {
      const query: any = {
        sentAt: { $gte: options.from, $lte: options.to }
      };

      if (options.projectId) query.projectId = options.projectId;
      if (options.provider) query.provider = options.provider;
      if (options.environment) query.environment = options.environment;
      if (options.tags && options.tags.length > 0) {
        query.tags = { $in: options.tags };
      }

      const stats = await Message.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            sent: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
            opened: { $sum: { $cond: [{ $eq: ['$status', 'OPENED'] }, 1, 0] } },
            clicked: { $sum: { $cond: [{ $eq: ['$status', 'CLICKED'] }, 1, 0] } },
            bounced: { $sum: { $cond: [{ $eq: ['$status', 'BOUNCED'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
          }
        }
      ]);

      const s = stats[0] || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 };
      
      return {
        sent: s.sent,
        delivered: s.delivered,
        opened: s.opened,
        clicked: s.clicked,
        bounced: s.bounced,
        complained: 0,
        deliveryRate: s.sent > 0 ? (s.delivered / s.sent) * 100 : 0,
        openRate: s.sent > 0 ? (s.opened / s.sent) * 100 : 0,
        clickRate: s.opened > 0 ? (s.clicked / s.opened) * 100 : 0,
        timeline: []
      };
    }

    // Memory fallback for tests
    const filtered = this.events.filter(e => 
      e.timestamp && e.timestamp >= options.from && e.timestamp <= options.to
    );
    
    const sent = filtered.filter(e => e.type === 'email.sent').length;
    const opened = filtered.filter(e => e.type === 'email.opened').length;

    return {
      sent,
      delivered: sent,
      opened,
      clicked: 0,
      bounced: 0,
      complained: 0,
      deliveryRate: 100,
      openRate: sent > 0 ? (opened / sent) * 100 : 0,
      clickRate: 0,
      timeline: []
    };
  }

  /**
   * Get a paginated list of messages
   */
  async getMessages(options: { 
    page?: number, 
    limit?: number, 
    projectId?: string,
    environment?: string,
    status?: string 
  } = {}): Promise<{ messages: any[], total: number }> {
    if (this.isConnected) {
      const { page = 1, limit = 20, projectId, environment, status } = options;
      const query: any = {};
      if (projectId) query.projectId = projectId;
      if (environment) query.environment = environment;
      if (status) query.status = status;

      const total = await Message.countDocuments(query);
      const messages = await Message.find(query)
        .sort({ sentAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      return { messages, total };
    }
    return { messages: [], total: 0 };
  }

  /**
   * Get full details of a single message including its tracking events
   */
  async getMessageDetails(messageId: string): Promise<any> {
    if (this.isConnected) {
      const message = await Message.findOne({ messageId }).lean();
      if (!message) return null;

      const events = await TrackingEventModel.find({ messageId }).sort({ timestamp: 1 }).lean();
      return { ...message, events };
    }
    return null;
  }

  /**
   * Get real-time queue and sending stats
   */
  async getRealtimeStats(): Promise<RealtimeStats> {
    return {
      sendingRate: 0,
      queueDepth: 0,
      activeConnections: 0,
      providerHealth: {
        smtp: 'healthy',
        resend: 'healthy',
        ses: 'healthy'
      }
    };
  }

  /**
   * Get provider performance statistics
   */
  async getProviderStats(_options: { from: Date; to: Date }): Promise<ProviderStats[]> {
    return [];
  }
}
