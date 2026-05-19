/// <reference types="vite/client" />

// Augment ImportMeta as a fallback so `import.meta.env.DEV` is typed even
// when the LSP cannot resolve vite/client from the workspace node_modules.
// At build time, Vite's own vite/client declaration takes precedence via
// interface merging — no conflict.

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
