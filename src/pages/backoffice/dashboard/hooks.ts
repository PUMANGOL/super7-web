import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProductList } from '../../../api/products';
import type { ApiProduct } from '../../../types/api';
import { useServerNow } from '../../../utils/serverClock';

/** Hora actual (do servidor: os prazos vêm da API), actualizada a cada `intervalMs`. */
export function useNow(intervalMs: number): number {
  return useServerNow(intervalMs);
}

/** Largura (px) do elemento, seguida com ResizeObserver. Use o primeiro valor como `ref`. */
export function useElementWidth<T extends HTMLElement>(): [(node: T | null) => () => void, number] {
  const [width, setWidth] = useState(0);

  const ref = useCallback((node: T | null) => {
    if (!node) return () => undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/** `GET /product/list?includeUnavailable=true`: só ADMIN e MANAGER (os outros perfis recebem 403). */
function fetchProductsIncludingUnavailable(): Promise<ApiProduct[]> {
  return fetchProductList({ includeUnavailable: true });
}

/**
 * Produtos indisponíveis (escondidos da loja), para classificar por categoria as vendas de
 * produtos que já saíram do catálogo. Sem permissão de catálogo, não é pedido.
 */
export function useProductsIncludingUnavailable(enabled: boolean) {
  return useQuery({
    queryKey: ['products', 'including-unavailable'],
    queryFn: fetchProductsIncludingUnavailable,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
