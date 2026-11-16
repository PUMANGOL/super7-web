import { apiClient, unwrap } from './client';
import type { ApiResponse, Category, CategoryRequest } from '../types/api';

/** Todas as categorias activas. */
export async function fetchCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<ApiResponse<Category[]>>('/category');
  return unwrap(data) ?? [];
}

export async function createCategory(dto: CategoryRequest): Promise<Category> {
  const { data } = await apiClient.post<ApiResponse<Category>>('/category', dto);
  return unwrap(data);
}

export async function updateCategory(id: string, dto: CategoryRequest): Promise<Category> {
  const { data } = await apiClient.put<ApiResponse<Category>>(`/category/${id}`, dto);
  return unwrap(data);
}

/** Eliminação definitiva. Falha se a categoria ainda tiver produtos. */
export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/category/${id}`);
}
