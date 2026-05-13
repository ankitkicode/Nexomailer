import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../src/engine.js';

describe('TemplateEngine', () => {
  it('should initialize successfully', () => {
    const engine = new TemplateEngine();
    expect(engine).toBeDefined();
  });
  
  it('should load built-in templates', async () => {
    const engine = new TemplateEngine();
    await engine.loadBuiltIn();
    const result = await engine.render('welcome', { name: 'Test User' });
    expect(result.subject).toContain('Test User');
    expect(result.html).toBeDefined();
    expect(result.html.length).toBeGreaterThan(0);
  });
});
