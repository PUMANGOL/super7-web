import { apiClient, unwrap } from './client';
import type { ApiResponse, Level } from '../types/api';

export async function fetchLevels(): Promise<Level[]> {
  const { data } = await apiClient.get<ApiResponse<Level[]>>('/education-level');
  const levels = unwrap(data) ?? [];
  return [...levels].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
