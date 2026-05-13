import { z } from 'zod';

const addressSchema = z.union([
  z.string().email(),
  z.object({ name: z.string().optional(), address: z.string().email() }),
]);

const addressInputSchema = z.union([
  addressSchema,
  z.array(addressSchema),
]);

export const sendOptionsSchema = z.object({
  to: addressInputSchema,
  cc: addressInputSchema.optional(),
  bcc: addressInputSchema.optional(),
  from: z.union([z.string().email(), z.object({ name: z.string().optional(), address: z.string().email() })]).optional(),
  replyTo: z.union([z.string().email(), z.object({ name: z.string().optional(), address: z.string().email() })]).optional(),
  subject: z.string().min(1, 'Subject is required'),
  html: z.string().optional(),
  text: z.string().optional(),
  template: z.object({ name: z.string(), data: z.record(z.unknown()) }).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.union([z.instanceof(Buffer), z.string()]),
    contentType: z.string().optional(),
    encoding: z.enum(['base64', 'binary', 'utf-8']).optional(),
    cid: z.string().optional(),
  })).optional(),
  headers: z.record(z.string()).optional(),
  priority: z.enum(['high', 'normal', 'low']).optional(),
  scheduledAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tracking: z.union([
    z.boolean(),
    z.object({ opens: z.boolean().optional(), clicks: z.boolean().optional() })
  ]).optional(),
}).refine(
  (data) => data.html || data.text || data.template,
  { message: 'At least one of html, text, or template must be provided' },
);

export const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().optional(),
  auth: z.union([
    z.object({ user: z.string(), pass: z.string() }),
    z.object({ type: z.literal('oauth2'), user: z.string(), accessToken: z.string() }),
  ]).optional(),
  tls: z.object({
    rejectUnauthorized: z.boolean().optional(),
    servername: z.string().optional(),
  }).optional(),
  connectionTimeout: z.number().positive().optional(),
  socketTimeout: z.number().positive().optional(),
  name: z.string().optional(),
});

export const providerConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('smtp'),
    priority: z.number().int().min(1),
    weight: z.number().positive().optional(),
    config: smtpConfigSchema,
  }),
  z.object({
    type: z.literal('resend'),
    priority: z.number().int().min(1),
    weight: z.number().positive().optional(),
    config: z.object({ apiKey: z.string().min(1), baseUrl: z.string().url().optional() }),
  }),
  z.object({
    type: z.literal('ses'),
    priority: z.number().int().min(1),
    weight: z.number().positive().optional(),
    config: z.object({
      region: z.string().min(1),
      accessKeyId: z.string().min(1),
      secretAccessKey: z.string().min(1),
      configurationSet: z.string().optional(),
    }),
  }),
]);

export const nexoMailerConfigSchema = z.object({
  providers: z.array(providerConfigSchema).min(1, 'At least one provider is required'),
  failover: z.object({
    enabled: z.boolean().optional(),
    maxRetries: z.number().int().min(0).optional(),
    retryDelay: z.number().min(0).optional(),
    strategy: z.enum(['sequential', 'round-robin', 'weighted']).optional(),
  }).optional(),
  pool: z.object({
    maxConnections: z.number().int().positive().optional(),
    idleTimeout: z.number().positive().optional(),
  }).optional(),
  defaults: z.object({
    from: z.union([z.string().email(), z.object({ name: z.string().optional(), address: z.string().email() })]).optional(),
    replyTo: z.union([z.string().email(), z.object({ name: z.string().optional(), address: z.string().email() })]).optional(),
  }).optional(),
  tracking: z.object({
    enabled: z.boolean(),
    baseUrl: z.string().url(),
    opens: z.boolean(),
    clicks: z.boolean(),
    webhooks: z.array(z.object({
      url: z.string().url(),
      events: z.array(z.enum([
        'email.sent', 'email.delivered', 'email.opened',
        'email.clicked', 'email.bounced', 'email.complained', 'email.failed'
      ])),
      secret: z.string().min(1),
      retries: z.number().int().optional(),
    })).optional(),
  }).optional(),
  queue: z.object({
    redis: z.object({
      host: z.string(), port: z.number().int(),
      password: z.string().optional(), db: z.number().int().optional(),
    }),
    defaultJobOptions: z.object({
      attempts: z.number().int().positive(),
      backoff: z.object({ type: z.enum(['exponential', 'fixed']), delay: z.number() }),
      removeOnComplete: z.union([z.boolean(), z.number()]),
      removeOnFail: z.union([z.boolean(), z.number()]),
    }).optional(),
    concurrency: z.number().int().positive().optional(),
    limiter: z.object({ max: z.number(), duration: z.number() }).optional(),
  }).optional(),
  ai: z.object({
    provider: z.enum(['openai', 'openrouter']),
    apiKey: z.string().min(1),
    model: z.string().optional(),
    baseUrl: z.string().url().optional(),
    maxTokens: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),
  analytics: z.object({
    mongodbUri: z.string().optional(),
    retentionDays: z.number().int().positive().optional(),
    projectId: z.string().optional(),
    environment: z.string().optional(),
  }).optional(),
  branding: z.object({
    companyName: z.string(),
    logoUrl: z.string().url().optional(),
    footerText: z.string().optional(),
    websiteUrl: z.string().url().optional(),
    socialLinks: z.record(z.string().url()).optional(),
    colors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
    }).optional(),
    tone: z.string().optional(),
  }).optional(),
  projectId: z.string().optional(),
  environment: z.string().optional(),
  logger: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error', 'silent']),
    prefix: z.string().optional(),
  }).optional(),
});

export { z };
