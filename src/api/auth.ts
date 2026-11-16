import { apiClient, unwrap } from './client';
import type { ApiResponse, AuthUser, SignInPayload, SignInResponse } from '../types/api';

export async function signIn(payload: SignInPayload): Promise<SignInResponse> {
  const { data } = await apiClient.post<ApiResponse<SignInResponse>>('/auth/sign-in', payload);
  return unwrap(data);
}

/** Responde 200 com o utilizador (sem envelope) ou 401 se o token já não for válido. */
export async function validateToken(): Promise<AuthUser> {
  const { data } = await apiClient.post<AuthUser>('/auth/validate-token');
  return data;
}
