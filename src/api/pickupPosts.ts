import { apiClient, unwrap } from './client';
import type { ApiResponse, PickupPost, PickupPostRequest } from '../types/api';

/** Todos os postos de recolha activos (lojas Super7 onde se levanta a encomenda). */
export async function fetchPickupPosts(): Promise<PickupPost[]> {
  const { data } = await apiClient.get<ApiResponse<PickupPost[]>>('/pickup-post/findList');
  const posts = unwrap(data) ?? [];
  return [...posts].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
}

/** Hoje a API só guarda `name`; zona, morada, horário e telefone são propostos. */
export async function createPickupPost(dto: PickupPostRequest): Promise<PickupPost> {
  const { data } = await apiClient.post<ApiResponse<PickupPost>>('/pickup-post', dto);
  return unwrap(data);
}

export async function updatePickupPost(id: string, dto: PickupPostRequest): Promise<PickupPost> {
  const { data } = await apiClient.put<ApiResponse<PickupPost>>(`/pickup-post/${id}`, dto);
  return unwrap(data);
}

/** Eliminação definitiva. */
export async function deletePickupPost(id: string): Promise<void> {
  await apiClient.delete(`/pickup-post/${id}`);
}

/** Texto curto da loja: "Talatona, Luanda · Todos os dias, 06h00–22h00". */
export function pickupPostDetails(post: PickupPost | null | undefined): string {
  if (!post) return '';
  return [post.zone || post.address, post.openingHours].filter(Boolean).join(' · ');
}
