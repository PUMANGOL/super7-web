import { ApiEnvelopeError, apiClient, unwrap, unwrapOk } from './client';
import type { ApiResponse, AuthRole, AuthUser, Page, RoleRequest, UserRequest } from '../types/api';
import { compareRoles } from '../utils/auth';

/**
 * Contas activas por ordem de nome. A API pagina, mas a equipa e os clientes registados cabem numa página: o
 * back-office filtra e pagina no browser (`total` diz se ficou alguma de fora).
 */
export const USERS_PAGE_SIZE = 500;

export interface UserList {
  users: AuthUser[];
  total: number;
}

/** Mensagens da API (sem acentos, em inglês ou com "usuario") na linguagem do back-office. */
const USER_MESSAGES: [RegExp, string][] = [
  [/ja existe um usuario/i, 'Já existe uma conta com este e-mail ou telefone.'],
  [/pertencem a utilizadores diferentes/i, 'Este e-mail e este telefone pertencem a contas diferentes.'],
  [/password e obrigatoria/i, 'Indique a password.'],
  [/unexpected error/i, 'A API não conseguiu gravar. Tente novamente.'],
];

function translate(error: unknown): never {
  if (error instanceof ApiEnvelopeError) {
    throw new ApiEnvelopeError(
      error.messages.map((message) => USER_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? message),
    );
  }
  throw error;
}

export async function fetchUsers(): Promise<UserList> {
  const { data } = await apiClient.get<ApiResponse<Page<AuthUser>>>('/user', {
    params: { page: 0, size: USERS_PAGE_SIZE, sort: 'name,asc' },
  });
  const page = unwrap(data);
  const users = (page?.content ?? []).map((user) => ({
    ...user,
    roles: [...(user.roles ?? [])].sort(compareRoles),
  }));
  return { users, total: page?.totalElements ?? users.length };
}

/** A API responde sempre 200: um e-mail ou telefone repetido vem em `status`/`errors`. */
export async function createUser(dto: UserRequest): Promise<AuthUser> {
  try {
    const { data } = await apiClient.post<ApiResponse<AuthUser>>('/user', dto);
    return unwrapOk(data, 'Não foi possível criar o utilizador.');
  } catch (error) {
    return translate(error);
  }
}

/**
 * Substitui nome, contactos e perfis. Com a API actual, a pessoa tem de voltar a iniciar sessão e a password é
 * obrigatória (ver docs/api-campos-em-falta.md, secção 9).
 */
export async function updateUser(id: string, dto: UserRequest): Promise<AuthUser> {
  try {
    const { data } = await apiClient.put<ApiResponse<AuthUser>>(`/user/${id}`, dto);
    return unwrapOk(data, 'Não encontrámos este utilizador.');
  } catch (error) {
    return translate(error);
  }
}

/** Eliminação definitiva. */
export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/user/${id}`);
}

/* ---------- Perfis ---------- */

/** Todos os perfis activos (também `USER`, o dos clientes). */
export async function fetchRoles(): Promise<AuthRole[]> {
  const { data } = await apiClient.get<ApiResponse<AuthRole[]>>('/role/findList');
  return [...(unwrap(data) ?? [])].sort(compareRoles);
}

/** Hoje a API só guarda `name`; `description` e `permissions` são propostos (`role-permissions`). */
export async function createRole(dto: RoleRequest): Promise<AuthRole> {
  const { data } = await apiClient.post<ApiResponse<AuthRole>>('/role', dto);
  return unwrapOk(data, 'Não foi possível criar o perfil.');
}

export async function updateRole(id: string, dto: RoleRequest): Promise<AuthRole> {
  const { data } = await apiClient.put<ApiResponse<AuthRole>>(`/role/${id}`, dto);
  return unwrapOk(data, 'Não foi possível guardar o perfil.');
}

export async function deleteRole(id: string): Promise<void> {
  await apiClient.delete(`/role/${id}`);
}
