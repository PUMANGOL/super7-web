import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRole,
  createUser,
  deleteRole,
  deleteUser,
  fetchRoles,
  fetchUsers,
  updateRole,
  updateUser,
} from '../api/users';
import type { RoleRequest, UserRequest } from '../types/api';

const USERS_KEY = ['backoffice-users'] as const;
const ROLES_KEY = ['backoffice-roles'] as const;

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: fetchUsers,
    staleTime: 60_000,
    retry: 1,
  });
}

/** Cria (sem `id`) ou actualiza um utilizador. */
export function useSaveUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id?: string; dto: UserRequest }) => (id ? updateUser(id, dto) : createUser(dto)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: fetchRoles,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** Cria (sem `id`) ou actualiza um perfil. Os utilizadores também recarregam: trazem os perfis dentro. */
export function useSaveRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id?: string; dto: RoleRequest }) => (id ? updateRole(id, dto) : createRole(dto)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ROLES_KEY });
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}
