import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPickupPost, deletePickupPost, fetchPickupPosts, updatePickupPost } from '../api/pickupPosts';
import type { PickupPostRequest } from '../types/api';

const KEY = ['pickup-posts'] as const;

export function usePickupPosts() {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchPickupPosts,
    staleTime: 10 * 60 * 1000,
    retry: 1,
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
