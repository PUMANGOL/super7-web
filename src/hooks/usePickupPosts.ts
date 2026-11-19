import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPickupPost, deletePickupPost, fetchPickupPosts, updatePickupPost } from '../api/pickupPosts';
import type { PickupPostRequest } from '../types/api';

const KEY = ['pickup-posts'] as const;

/** Lojas de levantamento. `enabled = false` não as pede (por exemplo, só quando é preciso o nome da loja fixa). */
export function usePickupPosts(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchPickupPosts,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled,
  });
}

/** Cria (sem `id`) ou actualiza uma loja de levantamento. */
export function useSavePickupPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id?: string; dto: PickupPostRequest }) => (id ? updatePickupPost(id, dto) : createPickupPost(dto)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePickupPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePickupPost(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
