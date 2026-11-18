import { apiClient, unwrap } from './client';
import type { ApiResponse, BackofficeThemeColors } from '../types/api';

/** Cores do back-office: todos os perfis da equipa as leem. Só com `backoffice-theme` em `api_features`. */
export async function fetchBackofficeTheme(): Promise<BackofficeThemeColors> {
  const { data } = await apiClient.get<ApiResponse<BackofficeThemeColors>>('/settings/theme');
  return unwrap(data);
}

/** Só ADMIN. Substitui as cores todas: uma chave em falta volta à original. A API recusa um fundo escuro. */
export async function updateBackofficeTheme(colors: Record<string, string>): Promise<BackofficeThemeColors> {
  const { data } = await apiClient.put<ApiResponse<BackofficeThemeColors>>('/settings/theme', { colors });
  return unwrap(data);
}
