import { describe, it, expect, afterEach } from 'vitest';
import { OpenRouterProvider } from './openrouter-provider.js';
import { OpenAIProvider } from './openai-provider.js';

describe('OpenRouterProvider', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('extends OpenAIProvider (shares the OpenAI-compatible request/stream/vision logic)', () => {
    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test', model: 'anthropic/claude-sonnet-5' });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('defaults the base URL to OpenRouter, not OpenAI', () => {
    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test', model: 'anthropic/claude-sonnet-5' });
    expect(provider.baseUrl).toBe('https://openrouter.ai/api/v1');
  });

  it('respects an explicit baseUrl override', () => {
    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-5',
      baseUrl: 'https://custom.proxy/v1',
    });
    expect(provider.baseUrl).toBe('https://custom.proxy/v1');
  });

  it('reports itself as "OpenRouter", not "OpenAI"', () => {
    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test', model: 'anthropic/claude-sonnet-5' });
    expect(provider.getName()).toBe('OpenRouter');
  });

  it('isConfigured() is true with just apiKey + model (inherited from BaseProvider)', () => {
    const provider = new OpenRouterProvider({ apiKey: 'sk-or-test', model: 'anthropic/claude-sonnet-5' });
    expect(provider.isConfigured()).toBe(true);
  });

  describe('getVisionModel()', () => {
    it('returns the configured model instead of falling back to a bare OpenAI id', () => {
      // Regression test: OpenAIProvider.getVisionModel() falls back to the bare
      // OpenAI model id "gpt-4o" for any model not in its OpenAI-specific
      // allowlist. "gpt-4o" is not a valid OpenRouter slug (it would need to be
      // "openai/gpt-4o"), so an Anthropic model routed through OpenRouter must
      // not hit that fallback.
      const provider = new OpenRouterProvider({ apiKey: 'sk-or-test', model: 'anthropic/claude-sonnet-5' });
      expect(provider.getVisionModel()).toBe('anthropic/claude-sonnet-5');
      expect(provider.getVisionModel()).not.toBe('gpt-4o');
    });

    it('also returns the configured model for a non-Anthropic OpenRouter slug', () => {
      const provider = new OpenRouterProvider({ apiKey: 'sk-or-test', model: 'google/gemini-2.5-pro' });
      expect(provider.getVisionModel()).toBe('google/gemini-2.5-pro');
    });
  });

  describe('getSupportedModels()', () => {
    it('returns OpenRouter-style slugs, not bare OpenAI ids', () => {
      const models = OpenRouterProvider.getSupportedModels();
      expect(models).toContain('anthropic/claude-sonnet-5');
      expect(models.every((m) => m.includes('/'))).toBe(true);
    });
  });

  describe('optional attribution headers', () => {
    it('does not throw when OPENROUTER_SITE_URL / OPENROUTER_APP_NAME are set', () => {
      process.env.OPENROUTER_SITE_URL = 'https://imtr.net';
      process.env.OPENROUTER_APP_NAME = 'IronMonkey FlowViz';
      expect(() => new OpenRouterProvider({ apiKey: 'sk-or-test', model: 'anthropic/claude-sonnet-5' }))
        .not.toThrow();
    });
  });
});
