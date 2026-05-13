import type { ProviderConfig } from '@nexomailer/shared';
import { ProviderNotFoundError, ConfigurationError } from '@nexomailer/shared';
import { EmailProvider } from './base.js';
import { NativeSMTPProvider } from './smtp.js';
import { ResendProviderAdapter } from './resend.js';
import { SESProviderAdapter } from './ses.js';

/**
 * Factory for instantiating providers based on configuration.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, typeof EmailProvider>();

  constructor() {
    // Register built-in providers
    this.register('smtp', NativeSMTPProvider as any);
    this.register('resend', ResendProviderAdapter as any);
    this.register('ses', SESProviderAdapter as any);
  }

  /**
   * Register a custom provider class
   */
  register(type: string, providerClass: typeof EmailProvider): void {
    this.providers.set(type, providerClass);
  }

  /**
   * Instantiate providers from configuration
   */
  createProviders(configs: ProviderConfig[]): EmailProvider[] {
    if (!configs || configs.length === 0) {
      throw new ConfigurationError('At least one provider must be configured');
    }

    // Sort by priority (lower number = higher priority)
    const sortedConfigs = [...configs].sort((a, b) => a.priority - b.priority);

    return sortedConfigs.map(config => {
      const ProviderClass = this.providers.get(config.type);
      if (!ProviderClass) {
        throw new ProviderNotFoundError(config.type);
      }
      return new (ProviderClass as any)(config.config);
    });
  }
}

// Global default registry
export const defaultRegistry = new ProviderRegistry();
