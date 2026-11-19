import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBooksPage } from '../api/books';
import { setProductVisibility } from '../api/products';
import { CATALOG_QUERY_KEY } from '../catalog/useCatalog';
import type { ApiBook, Page } from '../types/api';

export function useBooksPage(page: number) {
  return useQuery({
    queryKey: ['books', 'page', page],
    queryFn: () => fetchBooksPage(page),
    placeholderData: keepPreviousData,
  });
}

/**
 * Mostrar ou ocultar um livro na loja (os livros também são produtos). A lista mostra logo o novo estado; depois a
 * lista dos livros, o catálogo da loja e a lista de produtos do back-office voltam a ser pedidos.
 */
export function useSetBookVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ book, visible }: { book: ApiBook; visible: boolean }) => setProductVisibility(book.id, visible),
    onSuccess: (saved) => {
      queryClient.setQueriesData<Page<ApiBook>>({ queryKey: ['books', 'page'] }, (page) =>
        page
          ? {
              ...page,
              content: page.content.map((book) =>
                book.id === saved.id ? { ...book, available: saved.available !== false } : book,
              ),
            }
          : page,
      );
      void queryClient.invalidateQueries({ queryKey: ['books'] });
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}
