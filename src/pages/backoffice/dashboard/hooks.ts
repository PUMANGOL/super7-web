import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, unwrap } from '../../../api/client';
import type { ApiProduct, ApiResponse } from '../../../types/api';

/** Hora actual, actualizada a cada `intervalMs`. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
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
async function fetchProductsIncludingUnavailable(): Promise<ApiProduct[]> {
  const { data } = await apiClient.get<ApiResponse<ApiProduct[]>>('/product/list', {
    params: { includeUnavailable: true },
  });
  return unwrap(data) ?? [];
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
