/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  VITE_CLOUDFLARE_TURN_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
