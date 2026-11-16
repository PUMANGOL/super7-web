import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCategory } from '../api/categories';
import { CATALOG_QUERY_KEY } from '../catalog/useCatalog';

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}
