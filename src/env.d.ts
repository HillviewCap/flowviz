/// <reference types="vite/client" />

// REMOVED: VITE_ANTHROPIC_API_KEY no longer used - all API calls are server-side only
interface ImportMetaEnv {
  readonly VITE_AGENTS_URL?: string;
  readonly VITE_RESEARCH_USER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 