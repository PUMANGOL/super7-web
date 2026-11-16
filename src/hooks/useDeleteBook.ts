import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteBook } from '../api/books';
import { CATALOG_QUERY_KEY } from '../catalog/useCatalog';

export function useDeleteBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBook(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['books'] });
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}
