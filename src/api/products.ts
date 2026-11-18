import { apiClient, unwrap } from './client';
import type { ApiProduct, ApiResponse, ProductRequest } from '../types/api';

/**
 * Catálogo completo: produtos activos e visíveis na loja (inclui livros), ordenados por nome. Em cache no Redis.
 * Com `includeUnavailable`, também os ocultos (`available=false`), para o back-office: só ADMIN e MANAGER.
 */
export async function fetchProductList(options: { includeUnavailable?: boolean } = {}): Promise<ApiProduct[]> {
  const { data } = await apiClient.get<ApiResponse<ApiProduct[]>>('/product/list', {
    params: options.includeUnavailable ? { includeUnavailable: true } : undefined,
  });
  return unwrap(data) ?? [];
}

export async function fetchProduct(id: string): Promise<ApiProduct> {
  const { data } = await apiClient.get<ApiResponse<ApiProduct>>(`/product/${id}`);
  return unwrap(data);
}

/** POST multipart com `dto` (JSON em texto) e `imagem` (obrigatória). */
export async function createProduct(dto: ProductRequest, image: File): Promise<ApiProduct> {
  const form = new FormData();
  form.append('dto', JSON.stringify(dto));
  form.append('imagem', image);

  const { data } = await apiClient.post<ApiResponse<ApiProduct>>('/product', form);
  return unwrap(data);
}

/** Substitui os dados do produto. A imagem só muda se enviar outro URL em `coverImage`. */
export async function updateProduct(id: string, dto: ProductRequest): Promise<ApiProduct> {
  const { data } = await apiClient.put<ApiResponse<ApiProduct>>(`/product/${id}`, dto);
  return unwrap(data);
}

/** Eliminação lógica: o produto fica `Eliminado` e sai do catálogo. */
export async function deleteProduct(id: string): Promise<void> {
  await apiClient.delete(`/product/${id}`);
}
