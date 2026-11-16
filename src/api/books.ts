import { apiClient, unwrap } from './client';
import type { ApiBook, ApiResponse, CreateBookDto, Page } from '../types/api';

export const BOOKS_PAGE_SIZE = 10;

export async function fetchBooksPage(page: number, size = BOOKS_PAGE_SIZE): Promise<Page<ApiBook>> {
  // No JPA o título do livro é a propriedade `name` (herdada de Product): `sort=title` dá erro 500.
  const { data } = await apiClient.get<ApiResponse<Page<ApiBook>>>('/book', {
    params: { page, size, sort: 'name,asc' },
  });
  return unwrap(data);
}

/** Todos os livros activos (várias páginas grandes). */
export async function fetchAllBooks(): Promise<ApiBook[]> {
  const size = 200;
  const first = await fetchBooksPage(0, size);
  const books = [...first.content];

  if (first.totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: first.totalPages - 1 }, (_, index) => fetchBooksPage(index + 1, size)),
    );
    rest.forEach((page) => books.push(...page.content));
  }

  return books;
}

/** POST multipart: `dto` em texto JSON e `imagem` obrigatória. */
export async function createBook(dto: CreateBookDto, image: File): Promise<ApiBook> {
  const form = new FormData();
  form.append('dto', JSON.stringify(dto));
  form.append('imagem', image);

  const { data } = await apiClient.post<ApiResponse<ApiBook>>('/book', form);
  return unwrap(data);
}

/** Eliminação definitiva. */
export async function deleteBook(id: string): Promise<void> {
  await apiClient.delete(`/book/${id}`);
}
