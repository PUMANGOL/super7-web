import { apiClient, unwrap } from './client';
import type { ApiResponse } from '../types/api';

/** Carrega uma imagem solta (campo `file`) e devolve o URL. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const { data } = await apiClient.post<ApiResponse<string>>('/images', form);
  return unwrap(data);
}

/**
 * Acrescenta a caixa de redimensionamento a um URL de `GET /images/{id}`.
 * A API devolve WebP dentro dessa caixa, mantendo a proporção.
 * URLs que não sejam da API de imagens ficam como estão.
 */
export function sizedImageUrl(src: string | null | undefined, width: number, height = width): string | undefined {
  if (!src?.trim()) return undefined;
  if (!src.includes('/images/') || /[?&]width=/.test(src)) return src;

  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}width=${width}&height=${height}`;
}
