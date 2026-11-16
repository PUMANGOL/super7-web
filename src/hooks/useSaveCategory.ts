import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCategory, updateCategory } from '../api/categories';
import { CATALOG_QUERY_KEY } from '../catalog/useCatalog';
import type { CategoryRequest } from '../types/api';

/** Cria a categoria (sem `id`) ou actualiza-a. */
export function useSaveCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id?: string; dto: CategoryRequest }) =>
      id ? updateCategory(id, dto) : createCategory(dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}
