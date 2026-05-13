import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type {
  AIConfig,
  AIGenerateOptions,
  AIGenerateResult,
  SpamAnalysis,
  ScoredSubject,
  BrandingConfig
} from '@nexomailer/shared';
import { AIError, AIRateLimitError, createLogger, DEFAULTS } from '@nexomailer/shared';

/**
 * AI Module for NexoMailer.
 * Uses Vercel AI SDK to interface with OpenAI or OpenRouter.
 */
export class AIModule {
  private readonly config: AIConfig;
  private readonly logger = createLogger({ prefix: 'ai' });
  private readonly model;

  constructor(config: AIConfig) {
    this.config = {
      ...config,
      model: config.model ?? DEFAULTS.AI.model,
      maxTokens: config.maxTokens ?? DEFAULTS.AI.maxTokens,
      temperature: config.temperature ?? DEFAULTS.AI.temperature,
    };

    const openai = createOpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : this.config.baseUrl,
      compatibility: 'strict',
    });

    this.model = openai(this.config.model!);
  }

  private getBrandContext(): string {
    const branding = (this.config as any).branding as BrandingConfig | undefined;
    if (!branding) return '';
    return `
Brand Context:
- Company: ${branding.companyName}
- Website: ${branding.websiteUrl || 'N/A'}
- Preferred Tone: ${branding.tone || 'Human, helpful, and direct'}
- Style: Avoid spam triggers like "Click here now", "Limited time", or excessive capitalization. Keep it simple and authentic.
`;
  }

  /**
   * Generate complete email content from a prompt
   */
  async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    this.logger.debug(`Generating email: ${options.prompt}`);

    const systemPrompt = `You are an expert email copywriter for ${this.getBrandContext()}. Generate an email based on the prompt.
Tone: ${options.tone ?? 'professional'}
Length: ${options.length ?? 'medium'}
Language: ${options.language ?? 'English'}
${options.context ? `Context: ${JSON.stringify(options.context)}` : ''}

Output must be valid JSON matching the schema. HTML should use clean, semantic tags without html/head/body wrappers. Text should be a plain-text fallback.`;

    try {
      const { object } = await generateObject({
        model: this.model,
        system: systemPrompt,
        prompt: options.prompt,
        schema: z.object({
          subject: z.string(),
          html: z.string(),
          text: z.string(),
        }),
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });

      return object as AIGenerateResult;
    } catch (error) {
      this.handleError(error, 'generation');
    }
  }

  /**
   * Optimize subject line for higher open rates
   */
  async optimizeSubject(options: { subject: string; audience?: string; variations?: number }): Promise<{ subjects: ScoredSubject[] }> {
    const variations = options.variations ?? 3;
    const systemPrompt = `You are an email marketing expert. Optimize this subject line to maximize open rates.
Generate exactly ${variations} variations.
${options.audience ? `Target Audience: ${options.audience}` : ''}
Output valid JSON. Score each variation out of 100 on predicted open rate, and provide brief reasoning.`;

    try {
      const { object } = await generateObject({
        model: this.model,
        system: systemPrompt,
        prompt: `Original Subject: ${options.subject}`,
        schema: z.object({
          subjects: z.array(z.object({
            subject: z.string(),
            score: z.number().min(0).max(100),
            reasoning: z.string(),
          })),
        }),
        maxTokens: 1000,
        temperature: 0.8,
      });

      return object as { subjects: ScoredSubject[] };
    } catch (error) {
      this.handleError(error, 'subject optimization');
    }
  }

  /**
   * Analyze email content for spam triggers
   */
  async spamCheck(options: { subject: string; html: string; from?: string }): Promise<SpamAnalysis> {
    const systemPrompt = `You are an anti-spam analyst. Analyze this email for spam filter triggers (words, formatting, urgency).
Output JSON matching the schema. Score 0-100 where 100 means almost certainly flagged as spam, 0 means pristine.`;

    try {
      const { object } = await generateObject({
        model: this.model,
        system: systemPrompt,
        prompt: `Subject: ${options.subject}\n\nBody: ${options.html}`,
        schema: z.object({
          score: z.number().min(0).max(100),
          triggers: z.array(z.object({
            word: z.string(),
            severity: z.enum(['low', 'medium', 'high']),
            suggestion: z.string(),
          })),
          verdict: z.enum(['safe', 'risky', 'likely_spam']),
          improvements: z.array(z.string()),
        }),
        maxTokens: 1500,
        temperature: 0.2, // Low temp for analytical tasks
      });

      return object as SpamAnalysis;
    } catch (error) {
      this.handleError(error, 'spam check');
    }
  }

  /**
   * Personalize existing email template for a specific recipient
   */
  async personalize(options: { 
    subject?: string; 
    html: string; 
    recipient: Record<string, unknown>; 
    data?: Record<string, unknown>;
    style?: string;
  }): Promise<{ subject?: string; html: string; text: string }> {
    const systemPrompt = `You are an expert personalized marketing assistant for ${this.getBrandContext()}. Personalize the provided email for the specific recipient.
Do not change the core message or structural HTML. Inject personalized sentences or modify tone slightly to fit the recipient profile.
If a subject is provided, optimize it to be catchy and relevant for this specific person.

Recipient Profile: ${JSON.stringify(options.recipient)}
Context Data: ${options.data ? JSON.stringify(options.data) : 'None'}
${options.style ? `Personalization Style: ${options.style}` : ''}`;

    try {
      const { object } = await generateObject({
        model: this.model,
        system: systemPrompt,
        prompt: `Current Subject: ${options.subject || 'None'}\n\nEmail HTML: ${options.html}`,
        schema: z.object({
          subject: z.string().optional(),
          html: z.string(),
          text: z.string(),
        }),
        maxTokens: this.config.maxTokens,
        temperature: 0.7,
      });

      return object as { subject?: string; html: string; text: string };
    } catch (error) {
      this.handleError(error, 'personalization');
    }
  }

  private handleError(error: unknown, context: string): never {
    if (error instanceof Error) {
      if (error.message.includes('rate_limit') || error.message.includes('429')) {
        throw new AIRateLimitError();
      }
      throw new AIError(`AI ${context} failed: ${error.message}`, { originalError: error });
    }
    throw new AIError(`Unknown AI error during ${context}`, { originalError: error });
  }
}
