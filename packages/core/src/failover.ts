import type { ProviderSendOptions, ProviderResult, FailoverConfig } from '@nexomailer/shared';
import { FailoverExhaustedError, sleep, backoffDelay, DEFAULTS } from '@nexomailer/shared';
import type { EmailProvider } from '@nexomailer/providers';

/**
 * Executes a send operation with failover across multiple providers.
 */
export class FailoverEngine {
  private readonly config: FailoverConfig;
  private readonly providers: EmailProvider[];
  private currentRoundRobinIndex = 0;

  constructor(providers: EmailProvider[], config?: Partial<FailoverConfig>) {
    this.providers = providers;
    this.config = {
      enabled: config?.enabled ?? DEFAULTS.FAILOVER.enabled,
      maxRetries: config?.maxRetries ?? DEFAULTS.FAILOVER.maxRetries,
      retryDelay: config?.retryDelay ?? DEFAULTS.FAILOVER.retryDelay,
      strategy: config?.strategy ?? DEFAULTS.FAILOVER.strategy,
    };
  }

  /**
   * Send with failover logic
   */
  async execute(options: ProviderSendOptions): Promise<ProviderResult & { providerName: string }> {
    if (!this.config.enabled || this.providers.length === 1) {
      // Just use the primary provider
      const provider = this.providers[0]!;
      const result = await provider.send(options);
      return { ...result, providerName: provider.name };
    }

    const errors: Error[] = [];
    let attempts = 0;

    // Get ordered list of providers for this execution based on strategy
    const executionList = this.getExecutionList();

    for (const provider of executionList) {
      // Each provider can be retried `maxRetries` times
      for (let i = 0; i <= this.config.maxRetries; i++) {
        attempts++;
        try {
          const result = await provider.send(options);
          return { ...result, providerName: provider.name };
        } catch (error) {
          const e = error instanceof Error ? error : new Error(String(error));
          errors.push(e);

          // If it's not the last retry for this provider, delay
          if (i < this.config.maxRetries) {
            await sleep(backoffDelay(i + 1, this.config.retryDelay));
          }
        }
      }
    }

    throw new FailoverExhaustedError(attempts, errors);
  }

  /**
   * Determine the order of providers to try based on strategy
   */
  private getExecutionList(): EmailProvider[] {
    switch (this.config.strategy) {
      case 'sequential':
        // Providers are already sorted by priority by the registry
        return this.providers;
      
      case 'round-robin': {
        const list = [...this.providers];
        const startIndex = this.currentRoundRobinIndex % list.length;
        this.currentRoundRobinIndex++;
        // Rotate the array
        return [...list.slice(startIndex), ...list.slice(0, startIndex)];
      }

      case 'weighted':
        // For MVP, weighted falls back to sequential if we don't have weight data,
        // but let's implement a simple weighted random selection later.
        // For now, treat as sequential.
        return this.providers;

      default:
        return this.providers;
    }
  }
}
