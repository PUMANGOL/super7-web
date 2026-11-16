import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// `api_` mantém compatível o nome antigo da URL (`api_url`) e `api_features`.
const ENV_PREFIXES = ['VITE_', 'api_']

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A URL da API fica fixa no bundle durante o build: sem ela, a loja seria publicada
  // a pedir os dados ao próprio domínio. Falhar aqui evita um deploy sem API.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), ENV_PREFIXES)
    if (!env.VITE_API_URL && !env.api_url) {
      throw new Error(
        'Falta a URL da API. Defina VITE_API_URL (produção: https://portal.pumangol.co.ao/api/book-store) ' +
          'no ficheiro .env ou, na Vercel, em Settings → Environment Variables.',
      )
    }
  }

  return {
    plugins: [react()],
    envPrefix: ENV_PREFIXES,
    server: {
      port: 4200,
    },
  }
})
