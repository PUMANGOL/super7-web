import { useQuery } from '@tanstack/react-query';
import { fetchCatalog } from './catalog';

export const CATALOG_QUERY_KEY = ['catalog'] as const;

/**
 * Catálogo completo da loja (produtos + categorias), carregado uma vez e partilhado
 * por todas as páginas. A pesquisa, os filtros e a paginação são feitos no browser,
 * porque a API só filtra por categoria e tipo.
 */
export function useCatalog() {
  return useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: fetchCatalog,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
