import type { AuthRole, AuthUser } from '../types/api';

export type RoleName = 'ADMIN' | 'MANAGER' | 'SUPPORT' | 'FINANCE' | 'AUDITOR' | 'USER';

/** Perfis de equipa: entram no back-office. `USER` (registo público) não entra. */
export const TEAM_ROLES: RoleName[] = ['ADMIN', 'MANAGER', 'SUPPORT', 'FINANCE', 'AUDITOR'];

/** Perfil de quem se regista na loja online (`/auth/signUp`). */
export const CUSTOMER_ROLE: RoleName = 'USER';

/**
 * O que cada acção do back-office exige (tabela "Perfis e permissões" da documentação da API). São as regras fixas
 * da API actual; com permissões por perfil na API (`role-permissions`), passam a ser só os valores iniciais.
 */
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
  /** Utilizadores e perfis (/user e /role). */
  manageUsers: ['ADMIN'],
} satisfies Record<string, RoleName[]>;

export type Permission = keyof typeof PERMISSIONS;

export interface PermissionInfo {
  /** Nome na API (proposto): `permissions` de cada perfil. */
  code: string;
  label: string;
  /** Texto curto, para a descrição de um perfil. */
  short: string;
  help: string;
  area: string;
  /** Permissão que esta pressupõe (ex.: mudar o estado exige ver as encomendas). */
  requires?: Permission;
}

/** Linhas da tabela de permissões, pela ordem em que aparecem. */
export const PERMISSION_INFO: Record<Permission, PermissionInfo> = {
  viewDashboard: {
    code: 'VIEW_DASHBOARD',
    label: 'Ver o painel',
    short: 'painel',
    help: 'Números de vendas, encomendas e pagamentos.',
    area: 'Encomendas',
  },
  viewOrders: {
    code: 'VIEW_ORDERS',
    label: 'Ver encomendas',
    short: 'encomendas',
    help: 'Lista e detalhe das encomendas, com os dados do cliente.',
    area: 'Encomendas',
  },
  changeOrderStatus: {
    code: 'CHANGE_ORDER_STATUS',
    label: 'Mudar o estado das encomendas',
    short: 'estado das encomendas',
    help: 'Em preparação, pronta para levantar, entregue, cancelada.',
    area: 'Encomendas',
    requires: 'viewOrders',
  },
  confirmPayments: {
    code: 'CONFIRM_PAYMENTS',
    label: 'Confirmar pagamentos',
    short: 'pagamentos',
    help: 'Confirmar ou recusar transferências e acertos manuais.',
    area: 'Encomendas',
    requires: 'viewOrders',
  },
  manageCatalog: {
    code: 'MANAGE_CATALOG',
    label: 'Gerir o catálogo e as lojas',
    short: 'catálogo e lojas',
    help: 'Produtos, livros, categorias e lojas de levantamento.',
    area: 'Catálogo',
  },
  viewSettings: {
    code: 'VIEW_SETTINGS',
    label: 'Ver as definições da loja',
    short: 'ver definições',
    help: 'Formas de pagamento, IBAN e opções da loja, sem alterar.',
    area: 'Loja',
  },
  manageSettings: {
    code: 'MANAGE_SETTINGS',
    label: 'Alterar as definições e a aparência',
    short: 'definições',
    help: 'Grava as definições da loja e as cores do back-office.',
    area: 'Loja',
    requires: 'viewSettings',
  },
  manageUsers: {
    code: 'MANAGE_USERS',
    label: 'Gerir utilizadores e permissões',
    short: 'utilizadores',
    help: 'Criar contas da equipa, atribuir perfis e mudar as permissões.',
    area: 'Administração',
  },
};

export const PERMISSION_KEYS = Object.keys(PERMISSION_INFO) as Permission[];

const PERMISSION_BY_CODE = new Map(PERMISSION_KEYS.map((key) => [PERMISSION_INFO[key].code, key]));

export function permissionFromCode(code: string): Permission | null {
  return PERMISSION_BY_CODE.get(code) ?? null;
}

/** Permissões fixas de um perfil na API actual. */
export function defaultPermissions(roleName: string): Permission[] {
  return PERMISSION_KEYS.filter((key) => (PERMISSIONS[key] as RoleName[]).includes(roleName as RoleName));
}

/** Permissões de um perfil: as que a API devolve (com `role-permissions`) ou as fixas. O ADMIN tem sempre todas. */
export function rolePermissions(role: Pick<AuthRole, 'name' | 'permissions'>): Permission[] {
  if (role.name === 'ADMIN') return PERMISSION_KEYS;
  if (!Array.isArray(role.permissions)) return defaultPermissions(role.name);
  return role.permissions.map(permissionFromCode).filter((key): key is Permission => key !== null);
}

/** A API já devolve as permissões de cada perfil (`role-permissions`)? */
export function usesRolePermissions(roles: Pick<AuthRole, 'permissions'>[] | null | undefined): boolean {
  return Boolean(roles?.some((role) => Array.isArray(role.permissions)));
}

export function hasRole(user: AuthUser | null | undefined, ...allowed: RoleName[]): boolean {
  if (!user?.roles) return false;
  return user.roles.some((role) => allowed.includes(role.name as RoleName));
}

export function can(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user?.roles) return false;
  if (hasRole(user, 'ADMIN')) return true;
  if (usesRolePermissions(user.roles)) return user.roles.some((role) => rolePermissions(role).includes(permission));
  return hasRole(user, ...PERMISSIONS[permission]);
}

/** Perfil de equipa: um dos fixos ou, com permissões na API, um perfil novo com alguma permissão. */
export function isTeamRole(role: Pick<AuthRole, 'name' | 'permissions'>): boolean {
  if (TEAM_ROLES.includes(role.name as RoleName)) return true;
  return role.name !== CUSTOMER_ROLE && Array.isArray(role.permissions) && role.permissions.length > 0;
}

export function canAccessBackoffice(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.roles?.some(isTeamRole));
}

/** Nome dos perfis para mostrar, do mais alto para o mais baixo. */
const ROLE_LABELS: [RoleName, string][] = [
  ['ADMIN', 'Administrador'],
  ['MANAGER', 'Gestor'],
  ['FINANCE', 'Finanças'],
  ['SUPPORT', 'Apoio ao cliente'],
  ['AUDITOR', 'Auditor'],
  ['USER', 'Cliente'],
];

const ROLE_LABEL_BY_NAME = new Map<string, string>(ROLE_LABELS);

/** O que cada perfil fixo faz, nas palavras da equipa. */
const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  ADMIN: 'Tudo, incluindo utilizadores, permissões e definições da loja.',
  MANAGER: 'Encomendas, pagamentos, catálogo e lojas. Vê as definições, sem as alterar.',
  FINANCE: 'Vê as encomendas e confirma ou recusa pagamentos.',
  SUPPORT: 'Vê as encomendas e muda o estado.',
  AUDITOR: 'Só consulta: painel e encomendas.',
  USER: 'Conta da loja online. Não entra no back-office.',
};

export function roleDisplayName(roleName: string): string {
  return ROLE_LABEL_BY_NAME.get(roleName) ?? roleName;
}

/** Ordem para listas e tabelas: os perfis fixos primeiro (do mais alto), depois os novos por nome. */
export function compareRoles(a: Pick<AuthRole, 'name'>, b: Pick<AuthRole, 'name'>): number {
  const rank = (name: string) => {
    const index = ROLE_LABELS.findIndex(([role]) => role === name);
    return index === -1 ? ROLE_LABELS.length : index;
  };
  return rank(a.name) - rank(b.name) || roleDisplayName(a.name).localeCompare(roleDisplayName(b.name), 'pt');
}

/** Descrição de um perfil: a da API, a fixa ou, para um perfil novo ou mudado, a lista das permissões. */
export function roleDescription(role: Pick<AuthRole, 'name' | 'permissions' | 'description'>): string {
  if (role.description) return role.description;
  const fixed = ROLE_DESCRIPTIONS[role.name as RoleName];
  const permissions = rolePermissions(role);
  const changed =
    Array.isArray(role.permissions) &&
    (permissions.length !== defaultPermissions(role.name).length ||
      permissions.some((key) => !defaultPermissions(role.name).includes(key)));
  if (fixed && !changed) return fixed;
  if (permissions.length === 0) return 'Sem permissões no back-office.';
  const text = permissions.map((key) => PERMISSION_INFO[key].short).join(', ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** Nome do perfil para mostrar (o mais alto, se a pessoa tiver vários). */
export function roleLabel(user: AuthUser | null | undefined): string {
  const team = (user?.roles ?? []).filter(isTeamRole).sort(compareRoles);
  return team[0] ? roleDisplayName(team[0].name) : 'Equipa';
}
