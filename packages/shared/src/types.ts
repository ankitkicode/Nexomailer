// ═══════════════════════════════════════════════════════════
// @nexomailer/shared — Core Type Definitions
// ═══════════════════════════════════════════════════════════

// ─── Email Address ───────────────────────────────────────

export interface Address {
  name?: string;
  address: string;
}

export type AddressInput = string | Address | (string | Address)[];

// ─── Attachment ──────────────────────────────────────────

export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  encoding?: 'base64' | 'binary' | 'utf-8';
  cid?: string; // for inline images
}

// ─── Send Options ────────────────────────────────────────

export interface SendOptions {
  to: AddressInput;
  cc?: AddressInput;
  bcc?: AddressInput;
  from?: string | Address;
  replyTo?: string | Address;
  subject: string;
  html?: string;
  text?: string;
  template?: TemplateRef;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  priority?: EmailPriority;
  scheduledAt?: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
  tracking?: TrackingOptions;
}

export interface TemplateRef {
  name: string;
  data: Record<string, unknown>;
}

export interface TrackingOptions {
  opens?: boolean;
  clicks?: boolean;
}

export type EmailPriority = 'high' | 'normal' | 'low';

// ─── Send Result ─────────────────────────────────────────

export interface SendResult {
  id: string;
  provider: string;
  status: SendStatus;
  timestamp: Date;
  attempts: number;
  metadata?: Record<string, unknown>;
}

export type SendStatus = 'sent' | 'queued' | 'failed';

export interface BatchResult {
  results: SendResult[];
  succeeded: number;
  failed: number;
  total: number;
}

// ─── Provider Types ──────────────────────────────────────

export interface ProviderSendOptions {
  from: Address;
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  replyTo?: Address;
  subject: string;
  html?: string;
  text?: string;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ProviderResult {
  id: string;
  status: 'sent' | 'failed';
  rawResponse?: unknown;
}

export interface QuotaInfo {
  limit: number;
  used: number;
  remaining: number;
  resetsAt?: Date;
}

// ─── SMTP Config ─────────────────────────────────────────

export interface SMTPAuthPlain {
  user: string;
  pass: string;
}

export interface SMTPAuthOAuth2 {
  type: 'oauth2';
  user: string;
  accessToken: string;
}

export type SMTPAuth = SMTPAuthPlain | SMTPAuthOAuth2;

export interface SMTPConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: SMTPAuth;
  tls?: {
    rejectUnauthorized?: boolean;
    servername?: string;
  };
  connectionTimeout?: number;
  socketTimeout?: number;
  name?: string; // EHLO hostname
}

export interface SMTPPoolConfig extends SMTPConfig {
  maxConnections: number;
  maxMessages: number;
  idleTimeout: number;
  rateDelta?: number;
  rateLimit?: number;
}

export interface SMTPResponse {
  code: number;
  message: string;
  enhancedCode?: string;
}

// ─── Pool Stats ──────────────────────────────────────────

export interface PoolStats {
  total: number;
  active: number;
  idle: number;
  pending: number;
}

// ─── Provider Config ─────────────────────────────────────

export interface SMTPProviderConfig {
  type: 'smtp';
  priority: number;
  weight?: number;
  config: SMTPConfig;
}

export interface ResendProviderConfig {
  type: 'resend';
  priority: number;
  weight?: number;
  config: {
    apiKey: string;
    baseUrl?: string;
  };
}

export interface SESProviderConfig {
  type: 'ses';
  priority: number;
  weight?: number;
  config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    configurationSet?: string;
  };
}

export type ProviderConfig =
  | SMTPProviderConfig
  | ResendProviderConfig
  | SESProviderConfig;

// ─── Failover ────────────────────────────────────────────

export type FailoverStrategy = 'sequential' | 'round-robin' | 'weighted';

export interface FailoverConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  strategy: FailoverStrategy;
}

// ─── Tracking ────────────────────────────────────────────

export type WebhookEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.opened'
  | 'email.clicked'
  | 'email.bounced'
  | 'email.complained'
  | 'email.failed';

export interface WebhookConfig {
  url: string;
  events: WebhookEventType[];
  secret: string;
  retries?: number;
}

export interface TrackingConfig {
  enabled: boolean;
  baseUrl: string;
  opens: boolean;
  clicks: boolean;
  webhooks?: WebhookConfig[];
}

export interface TrackingEvent {
  id: string;
  messageId: string;
  type: WebhookEventType;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  url?: string;
  timestamp: Date;
  provider?: string;
  recipient?: string;
  subject?: string;
}

// ─── AI Config ───────────────────────────────────────────

export type AIProvider = 'openai' | 'openrouter';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

export type AITone = 'professional' | 'casual' | 'friendly' | 'urgent';
export type AILength = 'short' | 'medium' | 'long';

export interface AnalyticsQueryOptions {
  from: Date;
  to: Date;
  groupBy?: TimeGroupBy;
  tags?: string[];
  provider?: string;
  projectId?: string;
  environment?: string;
}

export interface AIGenerateOptions {
  prompt: string;
  tone?: AITone;
  length?: AILength;
  language?: string;
  context?: Record<string, unknown>;
}

export interface AIGenerateResult {
  subject: string;
  html: string;
  text: string;
}

export interface ScoredSubject {
  subject: string;
  score: number;
  reasoning: string;
}

export interface SpamTrigger {
  word: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface SpamAnalysis {
  score: number;
  triggers: SpamTrigger[];
  verdict: 'safe' | 'risky' | 'likely_spam';
  improvements: string[];
}

export interface CheckResult {
  passed: boolean;
  message: string;
  details?: string;
}

export interface DeliverabilityReport {
  score: number;
  checks: {
    spf: CheckResult;
    dkim: CheckResult;
    dmarc: CheckResult;
    htmlQuality: CheckResult;
    subjectQuality: CheckResult;
    contentAnalysis: CheckResult;
  };
  recommendations: string[];
}

// ─── Queue Config ────────────────────────────────────────

export interface QueueRedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface QueueConfig {
  redis: QueueRedisConfig;
  defaultJobOptions?: {
    attempts: number;
    backoff: { type: 'exponential' | 'fixed'; delay: number };
    removeOnComplete: boolean | number;
    removeOnFail: boolean | number;
  };
  concurrency?: number;
  limiter?: { max: number; duration: number };
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

// ─── Analytics ───────────────────────────────────────────

export interface AnalyticsConfig {
  mongodbUri?: string;
  retentionDays?: number;
  projectId?: string;
  environment?: string;
}

export type TimeGroupBy = 'hour' | 'day' | 'week' | 'month';

export interface AnalyticsSummary {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  timeline: TimelinePoint[];
}

export interface TimelinePoint {
  timestamp: Date;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

export interface RealtimeStats {
  sendingRate: number;
  queueDepth: number;
  activeConnections: number;
  providerHealth: Record<string, 'healthy' | 'degraded' | 'down'>;
}

// ─── Plugin ──────────────────────────────────────────────

export interface SendContext {
  options: SendOptions;
  provider?: string;
  attempt: number;
  metadata: Record<string, unknown>;
}

export interface NexoPlugin {
  name: string;
  version: string;
  hooks: {
    beforeSend?(ctx: SendContext): Promise<SendContext>;
    afterSend?(result: SendResult): Promise<void>;
    onError?(error: Error): Promise<void>;
    onInit?(config: NexoMailerConfig): Promise<void>;
  };
}

// ─── Logger ──────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
}

// ─── Health ──────────────────────────────────────────────

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers: Record<string, {
    status: 'healthy' | 'unhealthy';
    latency?: number;
    lastChecked: Date;
  }>;
  queue?: {
    connected: boolean;
    stats: QueueStats;
  };
  uptime: number;
}

// ─── Branding ────────────────────────────────────────────

export interface BrandingConfig {
  companyName: string;
  logoUrl?: string;
  footerText?: string;
  websiteUrl?: string;
  socialLinks?: Record<string, string>;
  colors?: {
    primary?: string;
    secondary?: string;
  };
  tone?: string;
}

// ─── Main Config ─────────────────────────────────────────

export interface NexoMailerConfig {
  providers: ProviderConfig[];
  failover?: Partial<FailoverConfig>;
  pool?: {
    maxConnections?: number;
    idleTimeout?: number;
  };
  defaults?: {
    from?: string | Address;
    replyTo?: string | Address;
  };
  tracking?: TrackingConfig;
  queue?: QueueConfig;
  ai?: AIConfig;
  analytics?: AnalyticsConfig;
  branding?: BrandingConfig;
  projectId?: string;
  environment?: string;
  plugins?: NexoPlugin[];
  logger?: LoggerConfig;
}
