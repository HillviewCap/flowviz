import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { fileTypeFromBuffer } from 'file-type';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { validateUrl, secureFetch, rateLimits, handleFetchError } from './security-utils.js';
import { logger } from './src/shared/utils/logger.js';
import dotenv from 'dotenv';
import { ProviderFactory } from './providers/provider-factory.js';

// Load environment variables from .env file
const dotenvResult = dotenv.config();

// Force values from .env file if available
if (dotenvResult.parsed) {
  // Make sure .env variables take precedence over shell environment
  if (dotenvResult.parsed.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = dotenvResult.parsed.ANTHROPIC_API_KEY;
  }

  if (dotenvResult.parsed.ANTHROPIC_BASE_URL) {
    process.env.ANTHROPIC_BASE_URL = dotenvResult.parsed.ANTHROPIC_BASE_URL;
  }

  if (dotenvResult.parsed.ANTHROPIC_MODEL) {
    process.env.ANTHROPIC_MODEL = dotenvResult.parsed.ANTHROPIC_MODEL;
  }

  if (dotenvResult.parsed.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = dotenvResult.parsed.OPENAI_API_KEY;
  }

  if (dotenvResult.parsed.OPENAI_BASE_URL) {
    process.env.OPENAI_BASE_URL = dotenvResult.parsed.OPENAI_BASE_URL;
  }

  if (dotenvResult.parsed.OPENAI_MODEL) {
    process.env.OPENAI_MODEL = dotenvResult.parsed.OPENAI_MODEL;
  }

  if (dotenvResult.parsed.OLLAMA_BASE_URL) {
    process.env.OLLAMA_BASE_URL = dotenvResult.parsed.OLLAMA_BASE_URL;
  }

  if (dotenvResult.parsed.OLLAMA_TEXT_MODEL) {
    process.env.OLLAMA_TEXT_MODEL = dotenvResult.parsed.OLLAMA_TEXT_MODEL;
  }

  if (dotenvResult.parsed.OLLAMA_VISION_MODEL) {
    process.env.OLLAMA_VISION_MODEL = dotenvResult.parsed.OLLAMA_VISION_MODEL;
  }

  if (dotenvResult.parsed.DEFAULT_AI_PROVIDER) {
    process.env.DEFAULT_AI_PROVIDER = dotenvResult.parsed.DEFAULT_AI_PROVIDER;
  }
}

// Log the loaded environment variables to verify .env file loading
console.log('[ENV] Loaded from .env file:', dotenvResult.parsed ? 'YES' : 'NO');
console.log('[ENV] ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '***' + process.env.ANTHROPIC_API_KEY.slice(-4) : 'Not set');
console.log('[ENV] ANTHROPIC_BASE_URL:', process.env.ANTHROPIC_BASE_URL || 'Not set');
console.log('[ENV] ANTHROPIC_MODEL:', process.env.ANTHROPIC_MODEL || 'Not set');
console.log('[ENV] OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '***' + process.env.OPENAI_API_KEY.slice(-4) : 'Not set');
console.log('[ENV] OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL || 'Not set');
console.log('[ENV] OPENAI_MODEL:', process.env.OPENAI_MODEL || 'Not set');
console.log('[ENV] OLLAMA_BASE_URL:', process.env.OLLAMA_BASE_URL || 'Not set');
console.log('[ENV] OLLAMA_TEXT_MODEL:', process.env.OLLAMA_TEXT_MODEL || 'Not set');
console.log('[ENV] OLLAMA_VISION_MODEL:', process.env.OLLAMA_VISION_MODEL || 'Not set');
console.log('[ENV] DEFAULT_AI_PROVIDER:', process.env.DEFAULT_AI_PROVIDER || 'Not set');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware - MUST come first
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for some React dev tools
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Enable CORS for specific origins only
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Use environment variable for allowed origins, or default to localhost
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [
          'http://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:3000'
        ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// Parse JSON bodies with size limits (configurable via environment)
const maxRequestSize = process.env.MAX_REQUEST_SIZE || '10mb';
app.use(express.json({ limit: maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: maxRequestSize }));

// Serve static files from dist folder in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get available AI providers
app.get('/api/providers', async (_req, res) => {
  try {
    const providers = ProviderFactory.getAvailableProviders();
    const defaultProvider = ProviderFactory.getDefaultProvider();

    // Fetch actual models from Ollama if configured
    const ollamaProvider = providers.find(p => p.id === 'ollama');
    if (ollamaProvider) {
      const { OllamaProvider } = await import('./providers/ollama-provider.js');
      const models = await OllamaProvider.fetchAvailableModels();
      if (models.length > 0) {
        ollamaProvider.models = models;
      }
    }

    logger.info('Providers request', {
      availableCount: providers.length,
      defaultProvider
    });

    res.json({
      providers,
      defaultProvider,
      hasConfiguredProviders: providers.length > 0
    });
  } catch (error) {
    logger.error('Error getting providers:', error);
    res.status(500).json({
      error: 'Failed to get available providers',
      details: error.message
    });
  }
});

// Secure image fetch endpoint with rate limiting and validation  
app.get('/api/fetch-image', rateLimits.images, async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  logger.debug(`Fetching image from: ${url}`);
  
  try {
    // Step 1: Validate URL to prevent SSRF attacks
    const validatedUrl = validateUrl(url);
    
    // Step 2: Secure fetch with image-specific settings
    const response = await secureFetch(validatedUrl, {
      timeout: 15000, // 15 seconds for images
      maxSize: parseInt(process.env.MAX_IMAGE_SIZE) || 5 * 1024 * 1024, // Default 5MB limit for images
      headers: {
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      }
    });
    
    logger.debug(`Image response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      logger.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Failed to fetch image: ${response.statusText}` 
      });
    }
    
    // Step 3: Validate content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({ 
        error: 'Invalid content type. Only image content is supported.' 
      });
    }
    
    // Step 4: Get image data with size validation
    const buffer = await response.arrayBuffer();
    const nodeBuffer = Buffer.from(buffer);
    
    if (nodeBuffer.length > (parseInt(process.env.MAX_IMAGE_SIZE) || 3 * 1024 * 1024)) { // Configurable limit for processed images
      return res.status(413).json({ 
        error: 'Image too large. Maximum size is 3MB.' 
      });
    }
    
    // Step 5: Detect and validate file type
    const fileType = await fileTypeFromBuffer(nodeBuffer);
    const mediaType = fileType?.mime || contentType || 'image/jpeg';
    
    // Only allow common image formats
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(mediaType)) {
      return res.status(400).json({ 
        error: `Unsupported image format: ${mediaType}. Allowed: ${allowedTypes.join(', ')}` 
      });
    }
    
    // Step 6: Convert to base64
    const base64 = nodeBuffer.toString('base64');
    
    logger.info(`Image fetched: ${mediaType}, ${Math.round(base64.length/1024)}KB`);
    res.json({ base64, mediaType });
    
  } catch (error) {
    const errorResponse = handleFetchError(error, 'image');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      details: errorResponse.details
    });
  }
});

// Secure article fetch endpoint with rate limiting and proper parsing
app.get('/api/fetch-article', rateLimits.articles, async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  logger.debug(`Fetching article from: ${url}`);
  
  try {
    // Step 1: Validate URL to prevent SSRF attacks
    const validatedUrl = validateUrl(url);
    
    // Step 2: Secure fetch with article-specific settings
    const response = await secureFetch(validatedUrl, {
      timeout: 30000, // 30 seconds for articles
      maxSize: 10 * 1024 * 1024, // 10MB limit
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    
    logger.debug(`Article response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      logger.error(`Failed to fetch article: ${response.status} ${response.statusText}`);
      return res.status(response.status).json({ 
        error: `Failed to fetch article: ${response.statusText}` 
      });
    }
    
    // Step 3: Validate content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      return res.status(400).json({ 
        error: 'Invalid content type. Only HTML content is supported.' 
      });
    }
    
    // Step 4: Get HTML with size check
    const html = await response.text();
    if (html.length > (parseInt(process.env.MAX_ARTICLE_SIZE) || 5 * 1024 * 1024)) { // Configurable limit
      return res.status(413).json({ 
        error: 'Content too large. Maximum size is 5MB.' 
      });
    }
    
    // Step 5: Parse with Mozilla Readability for better content extraction
    const dom = new JSDOM(html, { url: validatedUrl.href });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    
    if (!article) {
      // Fallback to original HTML if Readability fails
      logger.warn('Readability parsing failed, falling back to raw HTML');
      res.json({ contents: html });
      return;
    }
    
    // Return enhanced content with better structure
    const enhancedHtml = `
      <html>
        <head><title>${article.title || 'Article'}</title></head>
        <body>
          <h1>${article.title || 'Article'}</h1>
          ${article.byline ? `<p class="byline">${article.byline}</p>` : ''}
          <div class="content">${article.content}</div>
        </body>
      </html>
    `;
    
    logger.info(`Successfully parsed article: "${article.title}", content length: ${enhancedHtml.length} characters`);
    res.json({ 
      contents: enhancedHtml,
      metadata: {
        title: article.title,
        byline: article.byline,
        excerpt: article.excerpt,
        length: article.length,
        readTime: Math.ceil(article.length / 200) // rough reading time in minutes
      }
    });
    
  } catch (error) {
    const errorResponse = handleFetchError(error, 'article');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      details: errorResponse.details
    });
  }
});

// Vision analysis endpoint for secure server-side processing
// Unified AI streaming endpoint with provider selection - PROTECTED with strict rate limiting
app.post('/api/analyze-stream', rateLimits.streaming, async (req, res) => {
  logger.info('Starting unified AI streaming request...');

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    const { provider, model, url, text, system } = req.body;
    logger.debug('Request body received', { provider, model, hasUrl: !!url, hasText: !!text });

    // Determine which provider to use
    const selectedProvider = provider || ProviderFactory.getDefaultProvider();

    if (!selectedProvider) {
      logger.error('No AI providers configured');
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No AI providers configured. Please set OPENROUTER_API_KEY (recommended), ANTHROPIC_API_KEY, or OPENAI_API_KEY.' })}\n\n`);
      res.end();
      return;
    }

    logger.info('Using AI provider:', selectedProvider);

    // Get provider configuration
    const providerConfig = ProviderFactory.getProviderConfig(selectedProvider);

    // Override model if specified in request
    if (model) {
      providerConfig.model = model;
    }

    // Create provider instance
    const aiProvider = ProviderFactory.create(selectedProvider, providerConfig);

    // Validate provider is configured
    if (!aiProvider.isConfigured()) {
      logger.error(`${selectedProvider} provider not properly configured`);
      res.write(`data: ${JSON.stringify({ type: 'error', error: `${selectedProvider} provider not properly configured. Check your environment variables.` })}\n\n`);
      res.end();
      return;
    }

    // Validate input
    if (!url && !text) {
      logger.warn('Request missing both URL and text');
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Either URL or text is required' })}\n\n`);
      res.end();
      return;
    }

    let finalText;
    let visionAnalysis = null;

    // Process URL if provided
    if (url) {
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'fetching_article', message: 'Fetching article content...' })}\n\n`);

      const validatedUrl = validateUrl(url);
      const response = await secureFetch(validatedUrl, { timeout: 30000 });

      if (!response.ok) {
        throw new Error(`Failed to fetch article: ${response.statusText}`);
      }

      const html = await response.text();
      const dom = new JSDOM(html, { url: validatedUrl.href });
      const readabilityReader = new Readability(dom.window.document);
      const article = readabilityReader.parse();

      if (!article) {
        throw new Error('Could not extract content from article');
      }

      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'processing_content', message: 'Processing article content...' })}\n\n`);

      const enhancedHtml = `
        <html>
          <head><title>${article.title || 'Article'}</title></head>
          <body>
            <h1>${article.title || 'Article'}</h1>
            ${article.byline ? `<p class="byline">${article.byline}</p>` : ''}
            <div class="content">${article.content}</div>
          </body>
        </html>
      `;

      const doc = new JSDOM(enhancedHtml).window.document;
      finalText = doc.body.textContent || doc.body.innerText || '';

      // Process images with vision analysis if any
      res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'analyzing_images', message: 'Analyzing images...' })}\n\n`);

      const imgElements = Array.from(dom.window.document.querySelectorAll('img'));

      if (imgElements.length > 0) {
        try {
          logger.info(`Found ${imgElements.length} images, starting vision analysis...`);

          const processedImages = [];
          for (const img of imgElements.slice(0, 5)) {
            const imgUrl = img.src;
            if (!imgUrl || !imgUrl.startsWith('http')) continue;

            try {
              const imageResponse = await secureFetch(validateUrl(imgUrl), {
                timeout: 15000,
                maxSize: parseInt(process.env.MAX_IMAGE_SIZE) || 3 * 1024 * 1024,
                headers: { 'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8' }
              });

              if (imageResponse.ok) {
                const buffer = await imageResponse.arrayBuffer();
                const nodeBuffer = Buffer.from(buffer);
                const fileType = await fileTypeFromBuffer(nodeBuffer);
                const mediaType = fileType?.mime || imageResponse.headers.get('content-type') || 'image/jpeg';

                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (allowedTypes.includes(mediaType)) {
                  processedImages.push({
                    base64Data: nodeBuffer.toString('base64'),
                    mediaType: mediaType,
                    url: imgUrl
                  });
                }
              }
            } catch (imgError) {
              logger.warn(`Failed to process image ${imgUrl}:`, imgError.message);
            }
          }

          // Analyze images with the selected provider
          if (processedImages.length > 0) {

            try {
              logger.info(`Processing ${processedImages.length} images with ${selectedProvider} vision analysis`);
              const visionResult = await aiProvider.analyzeVision(processedImages, finalText);
              visionAnalysis = visionResult.analysisText;
              logger.info(`Vision analysis complete: ${visionAnalysis.length} chars`);
            } catch (visionError) {
              logger.warn(`Vision analysis failed with ${selectedProvider}:`, visionError.message);
              // Continue without vision analysis
            }
          }
        } catch (err) {
          logger.warn('Image processing failed:', err.message);
          // Continue without vision analysis
        }
      }
    } else {
      // Use provided text
      finalText = text;
    }

    // Stream analysis
    res.write(`data: ${JSON.stringify({ type: 'progress', stage: 'analyzing', message: `Analyzing with ${selectedProvider}...` })}\n\n`);

    await aiProvider.stream(
      { text: finalText, visionAnalysis, system },
      res
    );

    logger.info('AI streaming completed successfully');
    res.end();

  } catch (err) {
    logger.error('Unified streaming error:', { message: err.message, stack: err.stack });
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.write(`data: [DONE]\n\n`);
    res.end();
  }
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  logger.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Serve React app for any non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // 404 handler for development
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `Route ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    });
  });
}

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});
