import { SMTPClient, type Envelope } from './client.js';
import type { SMTPPoolConfig, SMTPResponse, PoolStats } from '@nexomailer/shared';
import { createLogger, DEFAULTS } from '@nexomailer/shared';

interface PooledConnection {
  client: SMTPClient;
  messageCount: number;
  createdAt: number;
  lastUsedAt: number;
  busy: boolean;
}

interface PendingRequest {
  resolve: (client: SMTPClient) => void;
  reject: (error: Error) => void;
}

/**
 * SMTP Connection Pool.
 * Manages reusable persistent connections with configurable limits.
 */
export class SMTPPool {
  private readonly config: SMTPPoolConfig;
  private readonly connections: PooledConnection[] = [];
  private readonly pending: PendingRequest[] = [];
  private readonly logger;
  private draining = false;
  private idleTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<SMTPPoolConfig> & { host: string; port: number }) {
    this.config = {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      tls: config.tls,
      connectionTimeout: config.connectionTimeout,
      socketTimeout: config.socketTimeout,
      name: config.name,
      maxConnections: config.maxConnections ?? DEFAULTS.POOL.maxConnections,
      maxMessages: config.maxMessages ?? DEFAULTS.POOL.maxMessages,
      idleTimeout: config.idleTimeout ?? DEFAULTS.POOL.idleTimeout,
      rateDelta: config.rateDelta,
      rateLimit: config.rateLimit,
    };
    this.logger = createLogger({ level: 'info', prefix: 'smtp:pool' });
    this.startIdleCleanup();
  }

  /** Acquire a connection from the pool */
  async acquire(): Promise<SMTPClient> {
    if (this.draining) throw new Error('Pool is draining');

    // Try to find an idle connection
    const idle = this.connections.find(c => !c.busy && c.messageCount < this.config.maxMessages);
    if (idle) {
      idle.busy = true;
      idle.lastUsedAt = Date.now();
      return idle.client;
    }

    // Create new connection if pool isn't full
    if (this.connections.length < this.config.maxConnections) {
      return this.createConnection();
    }

    // Wait for a connection to become available
    return new Promise<SMTPClient>((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
  }

  /** Release a connection back to the pool */
  release(client: SMTPClient): void {
    const conn = this.connections.find(c => c.client === client);
    if (!conn) return;

    conn.busy = false;
    conn.messageCount++;
    conn.lastUsedAt = Date.now();

    // If max messages reached, close and remove
    if (conn.messageCount >= this.config.maxMessages) {
      this.removeConnection(conn);
      return;
    }

    // Serve pending requests
    if (this.pending.length > 0) {
      const req = this.pending.shift()!;
      conn.busy = true;
      req.resolve(conn.client);
    }
  }

  /** Send email using pooled connection */
  async send(envelope: Envelope, message: string): Promise<SMTPResponse> {
    const client = await this.acquire();
    try {
      const result = await client.send(envelope, message);
      this.release(client);
      return result;
    } catch (error) {
      this.removeConnection(this.connections.find(c => c.client === client)!);
      throw error;
    }
  }

  /** Get pool statistics */
  stats(): PoolStats {
    return {
      total: this.connections.length,
      active: this.connections.filter(c => c.busy).length,
      idle: this.connections.filter(c => !c.busy).length,
      pending: this.pending.length,
    };
  }

  /** Drain all connections gracefully */
  async drain(): Promise<void> {
    this.draining = true;
    if (this.idleTimer) clearInterval(this.idleTimer);

    // Reject all pending
    for (const p of this.pending) {
      p.reject(new Error('Pool is draining'));
    }
    this.pending.length = 0;

    // Close all connections
    await Promise.all(this.connections.map(c => c.client.close().catch(() => {})));
    this.connections.length = 0;
    this.logger.info('Pool drained');
  }

  private async createConnection(): Promise<SMTPClient> {
    const client = new SMTPClient({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
      tls: this.config.tls,
      connectionTimeout: this.config.connectionTimeout,
      socketTimeout: this.config.socketTimeout,
      name: this.config.name,
    });

    await client.connect();

    const conn: PooledConnection = {
      client,
      messageCount: 0,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      busy: true,
    };

    this.connections.push(conn);
    this.logger.debug('Connection created', { stats: this.stats() });
    return client;
  }

  private removeConnection(conn: PooledConnection | undefined): void {
    if (!conn) return;
    const idx = this.connections.indexOf(conn);
    if (idx !== -1) this.connections.splice(idx, 1);
    conn.client.close().catch(() => {});
  }

  private startIdleCleanup(): void {
    this.idleTimer = setInterval(() => {
      const now = Date.now();
      const toRemove = this.connections.filter(
        c => !c.busy && (now - c.lastUsedAt) > this.config.idleTimeout,
      );
      for (const conn of toRemove) {
        this.logger.debug('Removing idle connection');
        this.removeConnection(conn);
      }
    }, Math.min(this.config.idleTimeout, 10_000));
  }
}
