/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API. */
  readonly api_url: string;
  /** Funcionalidades novas da API já disponíveis, separadas por vírgulas (ver src/config/store.ts). */
  readonly api_features?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
