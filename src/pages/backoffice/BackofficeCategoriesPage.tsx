import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { useCatalog } from '../../catalog/useCatalog';
import { CategoryModal } from '../../components/backoffice/CategoryModal';
import { Icon } from '../../components/store/Icon';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CATEGORY_ICONS, type CategoryIcon } from '../../config/store';
import { useToast } from '../../context/toast';
import { useCategories } from '../../hooks/useCategories';
import { useDeleteCategory } from '../../hooks/useDeleteCategory';
import type { Category } from '../../types/api';
import './BackofficeProductFormPage.css';

const ICON_NAMES = new Set<string>(CATEGORY_ICONS.map((icon) => icon.value));

export function BackofficeCategoriesPage() {
  const { data: categories = [], isLoading, isError, refetch } = useCategories();
  const catalog = useCatalog();
  const { mutate: deleteCategory, isPending: deleting, variables: deletingId } = useDeleteCategory();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; category: Category | null }>({ open: false, category: null });
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (catalog.data?.products ?? []).forEach((product) => {
      if (product.categoryId) counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    });
    return counts;
  }, [catalog.data]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return categories;
    return categories.filter((category) =>
      [category.name, category.slug, category.description ?? ''].some((value) => value.toLowerCase().includes(query)),
    );
  }, [categories, search]);

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteCategory(toDelete.id, {
      onSuccess: () => {
        showToast('Categoria eliminada.');
        setToDelete(null);
      },
      onError: (error) =>
        showToast(getApiErrorMessage(error, 'Não foi possível eliminar a categoria. Pode ainda ter produtos.'), 'error'),
    });
  };

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Categorias</h1>
              <p className="section-subtitle">Organizam o catálogo e o menu da loja. Só aparecem na loja as que têm produtos.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setModal({ open: true, category: null })}>
              <Plus size={18} />
              Nova categoria
            </button>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        {isLoading ? (
          <div className="backoffice-empty">
            <p>A carregar categorias…</p>
          </div>
        ) : isError ? (
          <div className="backoffice-empty">
            <p>Não foi possível carregar as categorias.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <div className="backoffice-filters">
              <div className="backoffice-search">
                <Search size={18} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Pesquisar por nome, slug ou descrição…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            {filtered.length > 0 ? (
              <div className="backoffice-table-wrap">
                <table className="backoffice-table backoffice-table--categories">
                  <thead>
                    <tr>
                      <th>Ícone</th>
                      <th>Nome</th>
                      <th>Slug</th>
                      <th>Produtos</th>
                      <th>Descrição</th>
                      <th>Acções</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((category) => (
                      <tr key={category.id}>
                        <td>
                          {category.icon && ICON_NAMES.has(category.icon) ? (
                            <Icon name={category.icon as CategoryIcon} />
                          ) : (
                            <span className="backoffice-book-meta">Automático</span>
                          )}
                        </td>
                        <td>
                          <div className="backoffice-book-title">{category.name}</div>
                        </td>
                        <td className="mono">{category.slug}</td>
                        <td>{productCounts.get(category.id) ?? 0}</td>
                        <td>{category.description || '—'}</td>
                        <td>
                          <div className="backoffice-actions">
                            <button
                              type="button"
                              className="backoffice-book-delete"
                              onClick={() => setModal({ open: true, category })}
                              aria-label={`Editar ${category.name}`}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="backoffice-book-delete"
                              onClick={() => setToDelete(category)}
                              disabled={deleting && deletingId === category.id}
                              aria-label={`Eliminar ${category.name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="backoffice-empty">
                <p>{categories.length === 0 ? 'Ainda não existem categorias.' : 'Nenhuma categoria corresponde à pesquisa.'}</p>
              </div>
            )}
          </>
        )}
      </div>

      <CategoryModal
        isOpen={modal.open}
        category={modal.category}
        onClose={() => setModal({ open: false, category: null })}
      />

      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar categoria"
        message={toDelete ? `Eliminar "${toDelete.name}"? A eliminação é definitiva e falha se a categoria ainda tiver produtos.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        isPending={deleting}
      />
    </div>
  );
}
