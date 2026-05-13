import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import type { QueueConfig, SendOptions, QueueStats, SendResult } from '@nexomailer/shared';
import { QueueError, QueueConnectionError, createLogger, DEFAULTS } from '@nexomailer/shared';

export interface EnqueueOptions {
  jobId?: string;
  delay?: number;
  priority?: number;
}

export type JobProcessor = (options: SendOptions) => Promise<SendResult>;

/**
 * Queue module based on BullMQ + Redis.
 * Handles scheduling, retries, and rate-limiting for email sending.
 */
export class QueueModule {
  private readonly queue: Queue;
  private readonly worker: Worker;
  private readonly redis: IORedis;
  private readonly logger = createLogger({ prefix: 'queue' });

  constructor(
    private readonly processJob: JobProcessor,
    config: QueueConfig,
    queueName = 'nexomailer-queue'
  ) {
    try {
      this.redis = new IORedis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: config.redis.db ?? 0,
        maxRetriesPerRequest: null,
      });

      this.redis.on('error', (err) => {
        this.logger.error(`Redis connection error: ${err.message}`);
      });

      const defaultJobOptions: any = config.defaultJobOptions ?? DEFAULTS.QUEUE;

      this.queue = new Queue(queueName, {
        connection: this.redis,
        defaultJobOptions: {
          attempts: defaultJobOptions.attempts,
          backoff: defaultJobOptions.backoff,
          removeOnComplete: defaultJobOptions.removeOnComplete ?? true,
          removeOnFail: defaultJobOptions.removeOnFail ?? false,
        },
      });

      this.worker = new Worker(
        queueName,
        async (job: Job<SendOptions>) => {
          this.logger.debug(`Processing job ${job.id}`);
          // Send email via the injected processor
          const result = await this.processJob(job.data);
          return result;
        },
        {
          connection: this.redis,
          concurrency: config.concurrency ?? DEFAULTS.QUEUE.concurrency,
          limiter: config.limiter,
        }
      );

      this.worker.on('completed', (job) => {
        this.logger.debug(`Job ${job.id} completed successfully`);
      });

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.id} failed: ${err.message}`);
      });

    } catch (error) {
      throw new QueueConnectionError(`Failed to initialize queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Schedule a single email
   */
  async schedule(options: SendOptions, enqueueOpts?: EnqueueOptions): Promise<{ jobId: string }> {
    try {
      // If scheduledAt is provided, calculate delay
      let delay = enqueueOpts?.delay;
      if (options.scheduledAt && !delay) {
        delay = Math.max(0, new Date(options.scheduledAt).getTime() - Date.now());
      }

      const job = await this.queue.add('send-email', options, {
        jobId: enqueueOpts?.jobId,
        delay,
        priority: enqueueOpts?.priority,
      });

      if (!job.id) throw new Error('Job ID not returned from BullMQ');
      
      this.logger.debug(`Scheduled email job ${job.id}`);
      return { jobId: job.id };
    } catch (error) {
      throw new QueueError(`Failed to schedule email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Schedule multiple emails in bulk
   */
  async scheduleBatch(emails: { options: SendOptions; enqueueOpts?: EnqueueOptions }[]): Promise<{ jobIds: string[] }> {
    try {
      const jobs = emails.map(({ options, enqueueOpts }) => {
        let delay = enqueueOpts?.delay;
        if (options.scheduledAt && !delay) {
          delay = Math.max(0, new Date(options.scheduledAt).getTime() - Date.now());
        }

        return {
          name: 'send-email',
          data: options,
          opts: {
            jobId: enqueueOpts?.jobId,
            delay,
            priority: enqueueOpts?.priority,
          },
        };
      });

      const addedJobs = await this.queue.addBulk(jobs);
      
      return { jobIds: addedJobs.map(j => j.id!).filter(Boolean) };
    } catch (error) {
      throw new QueueError(`Failed to schedule batch: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Pause queue processing
   */
  async pause(): Promise<void> {
    await this.queue.pause();
    this.logger.info('Queue paused');
  }

  /**
   * Resume queue processing
   */
  async resume(): Promise<void> {
    await this.queue.resume();
    this.logger.info('Queue resumed');
  }

  /**
   * Cancel a specific job
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (!job) return false;
    
    // Only remove if it's waiting or delayed
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      this.logger.debug(`Job ${jobId} cancelled`);
      return true;
    }
    return false;
  }

  /**
   * Remove all jobs from the queue
   */
  async drain(): Promise<void> {
    await this.queue.drain();
    this.logger.info('Queue drained');
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    const isPaused = await this.queue.isPaused();

    return { waiting, active, completed, failed, delayed, paused: isPaused };
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    this.redis.disconnect();
  }
}
