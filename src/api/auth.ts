import { apiClient, unwrap } from './client';
import type { ApiResponse, AuthUser, SignInPayload, SignInResponse } from '../types/api';

export async function signIn(payload: SignInPayload): Promise<SignInResponse> {
  const { data } = await apiClient.post<ApiResponse<SignInResponse>>('/auth/sign-in', payload);
  return unwrap(data);
}

/**
 * Termina a sessão na API: o token deixa de ser aceite em qualquer pedido.
 * Responde 204 (sem corpo), também quando o token já não estava activo.
 * Recebe o token explicitamente porque a sessão local é apagada sem esperar por este pedido.
 */
export async function signOut(token: string): Promise<void> {
  await apiClient.post('/auth/sign-out', null, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Responde 200 com o utilizador (sem envelope) ou 401 se o token já não for válido. */
export async function validateToken(): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>('/auth/validate-token');
  return data;
}
