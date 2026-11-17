import type { AuthUser } from '../types/api';

export type RoleName = 'ADMIN' | 'MANAGER' | 'SUPPORT' | 'FINANCE' | 'AUDITOR' | 'USER';

/** Perfis de equipa: entram no back-office. `USER` (registo público) não entra. */
export const TEAM_ROLES: RoleName[] = ['ADMIN', 'MANAGER', 'SUPPORT', 'FINANCE', 'AUDITOR'];

/** O que cada acção do back-office exige (tabela "Perfis e permissões" da documentação da API). */
export const PERMISSIONS = {
  viewOrders: TEAM_ROLES,
  viewDashboard: TEAM_ROLES,
  changeOrderStatus: ['ADMIN', 'MANAGER', 'SUPPORT'],
  /** Confirmar ou recusar pagamentos (PUT /order/{id}/payment-status). */
  confirmPayments: ['ADMIN', 'MANAGER', 'FINANCE'],
  manageCatalog: ['ADMIN', 'MANAGER'],
  /** Ver as definições da loja (GET /settings). */
  viewSettings: ['ADMIN', 'MANAGER'],
  /** Alterar as definições da loja (PUT /settings). */
  manageSettings: ['ADMIN'],
} satisfies Record<string, RoleName[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(user: AuthUser | null | undefined, ...allowed: RoleName[]): boolean {
  if (!user?.roles) return false;
  return user.roles.some((role) => allowed.includes(role.name as RoleName));
}

export function can(user: AuthUser | null | undefined, permission: Permission): boolean {
  return hasRole(user, ...PERMISSIONS[permission]);
}

export function canAccessBackoffice(user: AuthUser | null | undefined): boolean {
  return hasRole(user, ...TEAM_ROLES);
}
