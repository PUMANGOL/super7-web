import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBook } from '../api/books';
import { CATALOG_QUERY_KEY } from '../catalog/useCatalog';
import type { CreateBookDto } from '../types/api';

export function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dto, imagem }: { dto: CreateBookDto; imagem: File }) => createBook(dto, imagem),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['books'] });
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}
