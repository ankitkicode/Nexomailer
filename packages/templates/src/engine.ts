import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { TemplateError, TemplateNotFoundError, createLogger } from '@nexomailer/shared';

export interface TemplateDefinition {
  html: string;
  text?: string;
  isMjml?: boolean;
  defaults?: Record<string, unknown>;
  subject?: string;
}

export interface RenderResult {
  html: string;
  text?: string;
  subject?: string;
}

/**
 * Template engine for NexoMailer.
 * Supports Handlebars templating and MJML to HTML compilation.
 */
export class TemplateEngine {
  private readonly templates = new Map<string, TemplateDefinition>();
  private readonly compiled = new Map<string, { html: HandlebarsTemplateDelegate; text?: HandlebarsTemplateDelegate }>();
  private readonly logger = createLogger({ prefix: 'templates' });
  private globalData: Record<string, unknown> = {};

  constructor() {
    // Register basic Handlebars helpers if needed
    Handlebars.registerHelper('eq', (a, b) => a === b);
  }

  /**
   * Set global data (e.g. branding) to be available in all templates
   */
  setGlobalData(data: Record<string, unknown>): void {
    this.globalData = data;
  }

  /**
   * Register a template from string content
   */
  async register(name: string, definition: TemplateDefinition): Promise<void> {
    try {
      this.templates.set(name, definition);
      
      let htmlContent = definition.html;
      if (definition.isMjml) {
        const mjmlResult = await mjml2html(definition.html, { validationLevel: 'soft' });
        if (mjmlResult.errors && mjmlResult.errors.length > 0) {
          this.logger.warn(`MJML validation errors for template ${name}`, { errors: mjmlResult.errors });
        }
        htmlContent = mjmlResult.html;
      }

      this.compiled.set(name, {
        html: Handlebars.compile(htmlContent),
        text: definition.text ? Handlebars.compile(definition.text) : undefined,
      });

      this.logger.debug(`Template registered: ${name}`);
    } catch (error) {
      throw new TemplateError(`Failed to compile template ${name}`, { originalError: error });
    }
  }

  /**
   * Render a registered template with data
   */
  async render(name: string, data: Record<string, unknown>): Promise<RenderResult> {
    const definition = this.templates.get(name);
    const compiled = this.compiled.get(name);

    if (!definition || !compiled) {
      throw new TemplateNotFoundError(name);
    }
    
    // Merge global data (branding) with template defaults and local data
    const context = { ...this.globalData, ...definition.defaults, ...data };

    try {
      return {
        html: compiled.html(context),
        text: compiled.text ? compiled.text(context) : undefined,
        subject: definition.subject ? Handlebars.compile(definition.subject)(context) : undefined,
      };
    } catch (error) {
      throw new TemplateError(`Failed to render template ${name}`, { originalError: error });
    }
  }

  /**
   * Load templates from a directory structure
   * Format:
   * /dir
   *   /welcome
   *     template.hbs (or template.mjml)
   *     text.hbs (optional)
   *     meta.json (optional subject, defaults)
   */
  async loadDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const templateName = entry.name;
        const templatePath = path.join(dirPath, templateName);

        let html = '';
        let text: string | undefined;
        let isMjml = false;
        let subject: string | undefined;
        let defaults: Record<string, unknown> | undefined;

        // Check for MJML vs HBS
        try {
          html = await fs.readFile(path.join(templatePath, 'template.mjml'), 'utf-8');
          isMjml = true;
        } catch {
          try {
            html = await fs.readFile(path.join(templatePath, 'template.hbs'), 'utf-8');
          } catch {
            this.logger.warn(`Skipping ${templateName}: missing template.hbs or template.mjml`);
            continue;
          }
        }

        // Check for text fallback
        try {
          text = await fs.readFile(path.join(templatePath, 'text.hbs'), 'utf-8');
        } catch {
          // Optional
        }

        // Check for metadata
        try {
          const metaStr = await fs.readFile(path.join(templatePath, 'meta.json'), 'utf-8');
          const meta = JSON.parse(metaStr);
          subject = meta.subject;
          defaults = meta.defaults;
        } catch {
          // Optional
        }

        await this.register(templateName, { html, text, isMjml, subject, defaults });
      }
    } catch (error) {
      throw new TemplateError(`Failed to load templates from ${dirPath}`, { originalError: error });
    }
  }

  /**
   * Load the prebuilt library of NexoMailer templates (welcome, otp, newsletter, onboarding)
   */
  async loadBuiltIn(): Promise<void> {
    // Import dynamically or directly from the bundled file
    const { prebuiltTemplates } = await import('./built-in/index.js');
    
    for (const [name, def] of Object.entries(prebuiltTemplates)) {
      await this.register(name, def);
    }
    
    this.logger.info(`Loaded ${Object.keys(prebuiltTemplates).length} built-in templates.`);
  }

  /**
   * List all registered template names
   */
  list(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Remove a registered template
   */
  remove(name: string): boolean {
    this.compiled.delete(name);
    return this.templates.delete(name);
  }
}
