/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API, sem barra no fim (produção: https://portal.pumangol.co.ao/api/book-store). */
  readonly VITE_API_URL?: string;
  /** Nome antigo de VITE_API_URL: só é usado quando VITE_API_URL não está definida. */
  readonly api_url?: string;
  /** Funcionalidades novas da API já disponíveis, separadas por vírgulas (ver src/config/store.ts). */
  readonly api_features?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
