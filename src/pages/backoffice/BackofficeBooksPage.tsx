import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, Search, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { fetchStoreSettings, updateStoreSettings } from '../../api/settings';
import { Thumbnail } from '../../components/backoffice/Thumbnail';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import { CATALOG_QUERY_KEY } from '../../catalog/useCatalog';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useBooksPage, useSetBookVisibility } from '../../hooks/useBooks';
import { useDeleteBook } from '../../hooks/useDeleteBook';
import { useLevels } from '../../hooks/useLevels';
import type { ApiBook } from '../../types/api';
import { formatBookEducationLevels, formatBookGradeNames } from '../../utils/bookGrades';
import { formatPrice } from '../../utils/helpers';
import './BackofficeProductFormPage.css';

/** A mesma chave das Definições da loja: as duas páginas partilham os dados. */
const SETTINGS_KEY = ['store-settings'];

/**
 * Livros na loja, todos de uma vez (definição `booksVisible`, só o ADMIN muda). Ocultos, saem do catálogo e a API
 * recusa-os nas encomendas; cada livro guarda a sua visibilidade para quando voltarem.
 */
function BooksInStore() {
  const { can } = useAuth();
  const canEdit = can('manageSettings');
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchStoreSettings });
  const supported = typeof settings.data?.booksVisible === 'boolean';
  const visible = settings.data?.booksVisible !== false;
  const save = useMutation({
    mutationFn: (booksVisible: boolean) => updateStoreSettings({ booksVisible }),
    onSuccess: (saved) => {
      queryClient.setQueryData(SETTINGS_KEY, saved);
      void queryClient.invalidateQueries({ queryKey: ['checkout-options'] });
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      showToast(
        saved.booksVisible === false
          ? 'Os livros ficaram ocultos na loja: já não aparecem no catálogo nem podem ser encomendados.'
          : 'Os livros voltaram à loja. Os que estão ocultos um a um continuam ocultos.',
      );
    },
    onError: (error) => showToast(getApiErrorMessage(error, 'Não foi possível mudar a visibilidade dos livros.'), 'error'),
  });

  let help: string;
  if (settings.isError) help = 'Não foi possível ler as definições da loja.';
  else if (settings.isLoading) help = 'A carregar…';
  else if (!supported) help = 'Disponível com a versão nova da API (Definições da loja: livros visíveis).';
  else if (visible) help = 'Os livros aparecem no catálogo, na pesquisa e nas categorias. Pode ocultar cada um na lista.';
  else help = 'Nenhum livro aparece na loja nem pode ser encomendado. Cada livro guarda a sua visibilidade para quando voltarem.';

  return (
    <section className={visible ? 'books-store' : 'books-store books-store--ocultos'} aria-labelledby="books-store-title">
      <span className="books-store__icon" aria-hidden="true">
        {visible ? <Eye size={18} /> : <EyeOff size={18} />}
      </span>
      <div className="books-store__text">
        <h2 id="books-store-title">Livros na loja</h2>
        <p>{help}</p>
        {supported && !canEdit && <p className="books-store__note">Só o ADMIN muda esta opção.</p>}
      </div>
      <label className="books-store__switch">
        <input
          type="checkbox"
          role="switch"
          checked={visible}
          disabled={!supported || !canEdit || save.isPending}
          aria-describedby="books-store-title"
          onChange={(event) => save.mutate(event.target.checked)}
        />
        <span>{save.isPending ? 'A gravar…' : visible ? 'Visíveis' : 'Ocultos'}</span>
      </label>
    </section>
  );
}

export function BackofficeBooksPage() {
  const [page, setPage] = useState(0);
  const { data: booksPage, isLoading, isFetching } = useBooksPage(page);
  const books = useMemo(() => booksPage?.content ?? [], [booksPage]);
  const totalPages = booksPage?.totalPages ?? 1;
  const totalElements = booksPage?.totalElements ?? 0;
  const { mutate: deleteBook, isPending: isDeleting, variables: deletingId } = useDeleteBook();
  const visibility = useSetBookVisibility();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [bookToDelete, setBookToDelete] = useState<ApiBook | null>(null);
  const { data: levels = [] } = useLevels();
  const levelNames = useMemo(() => new Map(levels.map((level) => [level.id, level.name])), [levels]);
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchStoreSettings });
  // Partilha a consulta com BooksInStore: muda logo que a definição é gravada.
  const booksHidden = settings.data?.booksVisible === false;

  const filteredBooks = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return books;

    return books.filter(
      (book) =>
        [book.title, book.author, book.isbn, book.category].some((value) => (value ?? '').toLowerCase().includes(query)),
    );
  }, [books, search]);

  const handleDeleteClick = (book: ApiBook) => {
    setBookToDelete(book);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setBookToDelete(null);
  };

  const handleConfirmDelete = () => {
    if (!bookToDelete) return;

    deleteBook(bookToDelete.id, {
      onSuccess: () => {
        showToast('Livro eliminado com sucesso.');
        setBookToDelete(null);
      },
      onError: (error) => {
        showToast(getApiErrorMessage(error, 'Não foi possível eliminar o livro. Pode estar em encomendas.'), 'error');
      },
    });
  };

  const toggleVisibility = (book: ApiBook) => {
    const show = !book.available;
    visibility.mutate(
      { book, visible: show },
      {
        onSuccess: () =>
          showToast(
            show
              ? `"${book.title}" voltou a estar visível na loja${booksHidden ? ' (quando os livros voltarem à loja)' : ''}.`
              : `"${book.title}" ficou oculto: já não aparece na loja nem pode ser encomendado.`,
          ),
        onError: (error) =>
          showToast(
            getApiErrorMessage(error, show ? 'Não foi possível mostrar o livro.' : 'Não foi possível ocultar o livro.'),
            'error',
          ),
      },
    );
  };
  const changingId = visibility.isPending ? visibility.variables?.book.id : undefined;

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Livros</h1>
              <p className="section-subtitle">
                Os livros também são produtos da loja e aparecem na categoria que lhes atribuir.
              </p>
            </div>
            <Link
              to="/backoffice/livros/novo"
              className="btn btn-primary"
            >
              <Plus size={18} />
              Adicionar livro
            </Link>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        <BooksInStore />

        {isLoading ? (
          <div className="backoffice-empty">
            <p>A carregar livros...</p>
          </div>
        ) : (
          <>
            <div className="backoffice-stats">
              <div className="stat-card">
                <span className="stat-value">{totalElements}</span>
                <span className="stat-label">Total Livros</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">
                  {books.filter((book) => book.available).length}
                </span>
                <span className="stat-label">Visíveis (página)</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">
                  {books.filter((book) => !book.available).length}
                </span>
                <span className="stat-label">Ocultos (página)</span>
              </div>
            </div>

            <p className="backoffice-note">
              Para tirar um livro da loja sem o eliminar, use{' '}
              <EyeOff size={14} aria-hidden="true" className="backoffice-note-icon" /> <strong>Ocultar da loja</strong>:
              deixa de aparecer no catálogo, na pesquisa e nas categorias, e a API recusa-o nas encomendas. Volta à loja
              com <Eye size={14} aria-hidden="true" className="backoffice-note-icon" /> <strong>Mostrar na loja</strong>.
            </p>

            <div className="backoffice-filters">
              <div className="backoffice-search">
                <Search size={18} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Pesquisar por título, autor, ISBN ou categoria..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {filteredBooks.length > 0 ? (
              <>
                <div className="backoffice-table-wrap">
                  <table className="backoffice-table backoffice-table--books">
                    <thead>
                      <tr>
                        <th>Capa</th>
                        <th>Título</th>
                        <th>Autor</th>
                        <th>Categoria</th>
                        <th>Classe</th>
                        <th>Preço</th>
                        <th>Na loja</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBooks.map((book) => {
                        const hidden = !book.available;
                        const changing = changingId === book.id;
                        return (
                          <tr key={book.id} className={hidden || booksHidden ? 'backoffice-row--oculto' : undefined}>
                            <td>
                              <Thumbnail title={book.title} src={book.coverImage} className="backoffice-book-thumb" />
                            </td>
                            <td>
                              <div className="backoffice-book-title">{book.title}</div>
                              <div className="backoffice-book-isbn">{book.isbn}</div>
                            </td>
                            <td>{book.author}</td>
                            <td>{book.category}</td>
                            <td>
                              <div>{formatBookGradeNames(book.grades)}</div>
                              <div className="backoffice-book-meta">
                                {formatBookEducationLevels(book.grades, levelNames)}
                              </div>
                            </td>
                            <td className="price">{formatPrice(book.price)}</td>
                            <td>
                              {hidden ? (
                                <span className="badge badge-gray backoffice-badge-oculto">
                                  <EyeOff size={12} aria-hidden="true" />
                                  Oculto
                                </span>
                              ) : (
                                <span
                                  className={`badge ${booksHidden ? 'badge-gray' : 'badge-green'}`}
                                  title={booksHidden ? 'Todos os livros estão ocultos na loja' : undefined}
                                >
                                  {booksHidden ? 'Visível (livros ocultos)' : 'Visível'}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="backoffice-actions">
                                <button
                                  type="button"
                                  className={
                                    hidden
                                      ? 'backoffice-book-delete backoffice-visibility backoffice-visibility--oculto'
                                      : 'backoffice-book-delete backoffice-visibility'
                                  }
                                  onClick={() => toggleVisibility(book)}
                                  disabled={visibility.isPending}
                                  aria-busy={changing || undefined}
                                  aria-label={hidden ? `Mostrar ${book.title} na loja` : `Ocultar ${book.title} da loja`}
                                  title={hidden ? 'Mostrar na loja' : 'Ocultar da loja'}
                                >
                                  {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                                <button
                                  type="button"
                                  className="backoffice-book-delete"
                                  onClick={() => handleDeleteClick(book)}
                                  disabled={isDeleting && deletingId === book.id}
                                  aria-label={`Eliminar ${book.title}`}
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  disabled={isLoading || isFetching}
                />
              </>
            ) : (
              <div className="backoffice-empty">
                <p>
                  {books.length === 0 && totalElements === 0
                    ? 'Ainda não existem livros.'
                    : 'Nenhum livro corresponde à pesquisa.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={bookToDelete !== null}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Eliminar livro"
        message={
          bookToDelete
            ? `Tem a certeza de que quer eliminar "${bookToDelete.title}"? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        isPending={isDeleting}
      />
    </div>
  );
}
