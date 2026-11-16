import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchBooksPage } from '../api/books';

export function useBooksPage(page: number) {
  return useQuery({
    queryKey: ['books', 'page', page],
    queryFn: () => fetchBooksPage(page),
    placeholderData: keepPreviousData,
  });
}
