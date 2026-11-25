import axios, { AxiosError } from 'axios';
import type { ApiResponse, AuthUser } from '../types/api';

export const AUTH_TOKEN_KEY = 'access_token';
export const AUTH_USER_KEY = 'auth_user';

/** Evento disparado quando a API rejeita o token (401 numa rota privada). */
export const SESSION_EXPIRED_EVENT = 's7:sessao-expirada';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.api_url,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();

  // Um token passado à mão (logout, já com a sessão local apagada) não é substituído.
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // O browser junta o boundary do multipart; não definir o Content-Type à mão.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);
    const url = error.config?.url ?? '';
    // O logout leva o token antigo: um erro nele nunca pode apagar uma sessão iniciada entretanto.
    const isAuthRoute = url.includes('/auth/sign-in') || url.includes('/auth/sign-out');

    // Token inválido, expirado ou substituído por outro login: termina a sessão local.
    if (error.response?.status === 401 && sentToken && !isAuthRoute) {
      clearAuth();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    return Promise.reject(error);
  },
);

/** Devolve `data` do envelope da API. */
export function unwrap<T>(body: ApiResponse<T>): T {
  return body.data;
}

/**
 * Erro que chegou com HTTP 200: alguns endpoints (ex.: POST /user com um e-mail repetido) respondem sempre 200 e
 * põem o erro em `status` e `errors` do envelope.
 */
export class ApiEnvelopeError extends Error {
  readonly messages: string[];

  constructor(messages: string[]) {
    super(messages[0]);
    this.name = 'ApiEnvelopeError';
    this.messages = messages;
  }
}

/** Como `unwrap`, mas falha quando o envelope traz um `status` de erro. */
export function unwrapOk<T>(body: ApiResponse<T>, fallback: string): T {
  if (body.status && body.status !== 'OK') {
    const messages = (body.errors ?? []).filter((message) => typeof message === 'string' && message.trim() !== '');
    throw new ApiEnvelopeError(messages.length > 0 ? messages : [fallback]);
  }
  return body.data;
}

const MESSAGES_BY_STATUS: Record<number, string> = {
  400: 'Verifique os dados e tente novamente.',
  401: 'A sua sessão terminou. Inicie sessão novamente.',
  403: 'Não tem permissão para esta acção.',
  404: 'Não encontrámos o que procurava.',
  500: 'O servidor não conseguiu responder. Tente novamente dentro de momentos.',
};

/**
 * Mensagens para mostrar ao utilizador a partir de um erro da API:
 * primeiro as de `errors` no envelope, depois uma mensagem pelo código HTTP.
 */
export function getApiErrorMessages(error: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string[] {
  if (error instanceof ApiEnvelopeError) return error.messages;

  if (axios.isAxiosError(error)) {
    const body = error.response?.data as Partial<ApiResponse<unknown>> | undefined;
    const errors = Array.isArray(body?.errors)
      ? body.errors.filter((message): message is string => typeof message === 'string' && message.trim() !== '')
      : [];

    if (errors.length > 0) return errors;

    if (!error.response) {
      return ['Sem ligação ao servidor. Verifique a internet e tente novamente.'];
    }

    const byStatus = MESSAGES_BY_STATUS[error.response.status];
    if (byStatus) return [byStatus];
  }

  return [fallback];
}

export function getApiErrorMessage(error: unknown, fallback?: string): string {
  return getApiErrorMessages(error, fallback)[0];
}

export function getApiStatus(error: unknown): number | null {
  return axios.isAxiosError(error) ? error.response?.status ?? null : null;
}
