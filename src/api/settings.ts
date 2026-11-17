import { apiClient, unwrap } from './client';
import type { ApiResponse, StoreSettings } from '../types/api';

/** Definições da loja (ADMIN e MANAGER). */
export async function fetchStoreSettings(): Promise<StoreSettings> {
  const { data } = await apiClient.get<ApiResponse<StoreSettings>>('/settings');
  return unwrap(data);
}

/** Só ADMIN. Campos em falta mantêm o valor actual; a API valida o IBAN e a loja fixa. */
export async function updateStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const { data } = await apiClient.put<ApiResponse<StoreSettings>>('/settings', settings);
  return unwrap(data);
}
