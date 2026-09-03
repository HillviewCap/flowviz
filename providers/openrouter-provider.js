import OpenAI from 'openai';
import { OpenAIProvider } from './openai-provider.js';

/**
 * OpenRouter provider implementation.
 *
 * OpenRouter exposes an OpenAI-compatible `/chat/completions` endpoint (including
 * SSE streaming and `image_url` vision content), so this class reuses
 * OpenAIProvider's request/stream/vision/prompt-formatting logic wholesale via
 * inheritance and only overrides what is genuinely OpenAI-specific:
 *   - the default base URL (OpenRouter's, not OpenAI's)
 *   - the vision-model fallback (OpenAIProvider.getVisionModel() falls back to
 *     the bare OpenAI id "gpt-4o", which is not a valid OpenRouter model slug)
 *   - the supported-model list surfaced to the UI (OpenRouter slugs, e.g.
 *     "anthropic/claude-sonnet-5", not bare OpenAI ids)
 *   - optional attribution headers OpenRouter recommends (not required)
 */
export class OpenRouterProvider extends OpenAIProvider {
  constructor(config) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
    });
    this.providerName = 'OpenRouter';

    // OpenRouter recommends (does not require) identifying the calling app via
    // these headers for its public rankings. Only rebuild the client if at
    // least one is actually configured.
    const defaultHeaders = {};
    if (process.env.OPENROUTER_SITE_URL) {
      defaultHeaders['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
    }
    if (process.env.OPENROUTER_APP_NAME) {
      defaultHeaders['X-Title'] = process.env.OPENROUTER_APP_NAME;
    }
    if (Object.keys(defaultHeaders).length > 0) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
        defaultHeaders,
      });
    }
  }

  /**
   * OpenRouter routes to whatever model you request, and the models this
   * provider is actually configured for (Claude/GPT/Gemini families) all
   * accept image_url vision content on OpenRouter. Reuse the configured text
   * model instead of OpenAIProvider's bare-OpenAI-id fallback, which would
   * send an invalid model slug ("gpt-4o" instead of "openai/gpt-4o").
   */
  getVisionModel() {
    return this.model;
  }

  /**
   * Curated set of OpenRouter model slugs surfaced in the provider-picker UI.
   * This is informational only (server.js does not validate the requested
   * model against this list), but keeping it accurate avoids showing the
   * user OpenAI-style bare ids that aren't valid OpenRouter slugs.
   */
  static getSupportedModels() {
    return [
      // Anthropic Claude via OpenRouter (IronMonkey default)
      'anthropic/claude-sonnet-5',
      'anthropic/claude-opus-4.1',
      'anthropic/claude-haiku-4.5',

      // OpenAI via OpenRouter
      'openai/gpt-5.1',
      'openai/gpt-4o',

      // Google via OpenRouter
      'google/gemini-2.5-pro',
    ];
  }
}
