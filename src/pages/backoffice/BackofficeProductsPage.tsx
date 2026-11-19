import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import type { StaffProduct } from '../../catalog/catalog';
import { discountPercent, inCampaign, isInStock, searchText } from '../../catalog/query';
import { Thumbnail } from '../../components/backoffice/Thumbnail';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../context/toast';
import { useCategories } from '../../hooks/useCategories';
import { useDeleteProduct, useSetProductVisibility, useStaffProducts } from '../../hooks/useProducts';
import { formatPrice } from '../../utils/helpers';
import './BackofficeProductFormPage.css';

const PAGE_SIZE = 20;

const SEGMENTS = [
  { value: 'visivel', label: 'Visíveis na loja' },
  { value: 'oculto', label: 'Ocultos na loja' },
  { value: 'natal', label: 'Campanha de Natal' },
  { value: 'cabazes', label: 'Só cestas' },
  { value: 'escoamento', label: 'Escoamento' },
  { value: 'destaque', label: 'Destaques' },
  { value: 'esgotado', label: 'Esgotados' },
  { value: 'pouco', label: 'Stock baixo (≤ 5)' },
];

function matchesSegment(product: StaffProduct, segment: string): boolean {
  switch (segment) {
    case 'visivel':
      return !product.hidden;
    case 'oculto':
      return product.hidden;
    case 'natal':
      return inCampaign(product, 'natal');
    case 'cabazes':
      return product.isCabaz;
    case 'escoamento':
      return inCampaign(product, 'escoamento');
    case 'destaque':
      return product.featured;
    case 'esgotado':
      return !isInStock(product);
    case 'pouco':
      return product.stock !== null && product.stock > 0 && product.stock <= 5;
    default:
      return true;
  }
}

export function BackofficeProductsPage() {
  const staffProducts = useStaffProducts();
  const { data: categories = [] } = useCategories();
  const { mutate: deleteProduct, isPending: deleting } = useDeleteProduct();
  const visibility = useSetProductVisibility();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [segment, setSegment] = useState('');
  const [page, setPage] = useState(0);
  const [toDelete, setToDelete] = useState<StaffProduct | null>(null);

  // Os livros têm a sua própria página.
  const products = useMemo(() => (staffProducts.data ?? []).filter((product) => !product.isBook), [staffProducts.data]);

  const filtered = useMemo(() => {
    const terms = searchText(search).split(/\s+/).filter(Boolean);
    return products
      .filter((product) => {
        if (categoryId && product.categoryId !== categoryId) return false;
        if (segment && !matchesSegment(product, segment)) return false;
        if (terms.length) {
          const haystack = searchText(`${product.name} ${product.sku} ${product.categoryName}`);
          if (!terms.every((term) => haystack.includes(term))) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  }, [products, categoryId, segment, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const setFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(0);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteProduct(toDelete.id, {
      onSuccess: () => {
        showToast(`"${toDelete.name}" retirado da loja.`);
        setToDelete(null);
      },
      onError: (error) => showToast(getApiErrorMessage(error, 'Não foi possível eliminar o produto.'), 'error'),
    });
  };

  const toggleVisibility = (product: StaffProduct) => {
    const show = product.hidden;
    visibility.mutate(
      { product, visible: show },
      {
        onSuccess: () =>
          showToast(
            show
              ? `"${product.name}" voltou a estar visível na loja.`
              : `"${product.name}" ficou oculto: já não aparece na loja nem pode ser encomendado.`,
          ),
        onError: (error) =>
          showToast(
            getApiErrorMessage(error, show ? 'Não foi possível mostrar o produto.' : 'Não foi possível ocultar o produto.'),
            'error',
          ),
      },
    );
  };
  const changingId = visibility.isPending ? visibility.variables?.product.id : undefined;

  const count = (predicate: (product: StaffProduct) => boolean) => products.filter(predicate).length;
  const hiddenCount = count((product) => product.hidden);

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Produtos</h1>
              <p className="section-subtitle">Catálogo da loja: cestas, escoamento e produtos do dia-a-dia.</p>
            </div>
            <Link to="/backoffice/produtos/novo" className="btn btn-primary">
              <Plus size={18} />
              Novo produto
            </Link>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        {staffProducts.isLoading ? (
          <div className="backoffice-empty">
            <p>A carregar produtos…</p>
          </div>
        ) : staffProducts.isError ? (
          <div className="backoffice-empty">
            <p>{getApiErrorMessage(staffProducts.error, 'Não foi possível carregar os produtos.')}</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => staffProducts.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <div className="backoffice-stats backoffice-stats--produtos">
              <div className="stat-card">
                <span className="stat-value">{products.length - hiddenCount}</span>
                <span className="stat-label">Visíveis na loja</span>
              </div>
              <button
                type="button"
                className={segment === 'oculto' ? 'stat-card stat-card--botao stat-card--activo' : 'stat-card stat-card--botao'}
                aria-pressed={segment === 'oculto'}
                onClick={() => setFilter(setSegment)(segment === 'oculto' ? '' : 'oculto')}
              >
                <span className="stat-value">{hiddenCount}</span>
                <span className="stat-label">Ocultos na loja</span>
              </button>
              <div className="stat-card">
                <span className="stat-value">{count((product) => product.isCabaz)}</span>
                <span className="stat-label">Cestas</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{count((product) => inCampaign(product, 'escoamento'))}</span>
                <span className="stat-label">Em escoamento</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{count((product) => !isInStock(product))}</span>
                <span className="stat-label">Esgotados</span>
              </div>
            </div>

            <p className="backoffice-note">
              Para tirar um produto da loja sem o eliminar, use{' '}
              <EyeOff size={14} aria-hidden="true" className="backoffice-note-icon" /> <strong>Ocultar da loja</strong>:
              deixa de aparecer no catálogo, na pesquisa e nas categorias, sai dos carrinhos (com aviso ao cliente) e a
              API recusa-o nas encomendas. Fica nesta lista, assinalado como Oculto, e volta à loja com{' '}
              <Eye size={14} aria-hidden="true" className="backoffice-note-icon" /> <strong>Mostrar na loja</strong>.
            </p>

            <div className="backoffice-filters">
              <div className="backoffice-search">
                <Search size={18} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Pesquisar por nome, SKU ou categoria…"
                  value={search}
                  onChange={(event) => setFilter(setSearch)(event.target.value)}
                />
              </div>
              <div className="backoffice-filter-group">
                <Select
                  value={categoryId}
                  onChange={setFilter(setCategoryId)}
                  placeholder="Todas as categorias"
                  options={categories
                    .map((category) => ({ value: category.id, label: category.name }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'pt'))}
                />
                <Select value={segment} onChange={setFilter(setSegment)} placeholder="Todos" options={SEGMENTS} />
              </div>
            </div>

            {visible.length > 0 ? (
              <>
                <div className="backoffice-table-wrap">
                  <table className="backoffice-table backoffice-table--books">
                    <thead>
                      <tr>
                        <th>Imagem</th>
                        <th>Produto</th>
                        <th>Categoria</th>
                        <th>Preço</th>
                        <th>Stock</th>
                        <th>Loja</th>
                        <th>Acções</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((product) => {
                        const discount = discountPercent(product);
                        const changing = changingId === product.id;
                        return (
                          <tr key={product.id} className={product.hidden ? 'backoffice-row--oculto' : undefined}>
                            <td>
                              <Thumbnail title={product.name} src={product.image} className="backoffice-book-thumb" />
                            </td>
                            <td>
                              <div className="backoffice-book-title">{product.name}</div>
                              <div className="backoffice-book-isbn">
                                {product.sku}
                                {product.format ? ` · ${product.format}` : ''}
                              </div>
                            </td>
                            <td>{product.categoryName || '—'}</td>
                            <td className="price">
                              {formatPrice(product.price)}
                              {product.previousPrice && (
                                <span className="backoffice-product-price-old">{formatPrice(product.previousPrice)}</span>
                              )}
                            </td>
                            <td>
                              {product.stock === 0 ? (
                                <span className="badge badge-gray">Esgotado</span>
                              ) : (
                                product.stock
                              )}
                              {product.limitedStock && product.stock !== 0 && (
                                <span className="badge badge-orange backoffice-stock-limitado">Limitado</span>
                              )}
                            </td>
                            <td>
                              <div className="backoffice-tags">
                                {product.hidden && (
                                  <span className="badge badge-gray backoffice-badge-oculto">
                                    <EyeOff size={12} aria-hidden="true" />
                                    Oculto
                                  </span>
                                )}
                                {product.level && <span className="badge badge-yellow">Cesta {product.level}</span>}
                                {!product.level && product.isCabaz && <span className="badge badge-yellow">Cesta</span>}
                                {inCampaign(product, 'natal') && !product.isCabaz && <span className="badge badge-pink">Natal</span>}
                                {inCampaign(product, 'escoamento') && (
                                  <span className="badge badge-orange">Escoamento{discount > 0 ? ` −${discount}%` : ''}</span>
                                )}
                                {product.featured && <span className="badge badge-teal">Destaque</span>}
                              </div>
                            </td>
                            <td>
                              <div className="backoffice-actions">
                                <button
                                  type="button"
                                  className={
                                    product.hidden
                                      ? 'backoffice-book-delete backoffice-visibility backoffice-visibility--oculto'
                                      : 'backoffice-book-delete backoffice-visibility'
                                  }
                                  onClick={() => toggleVisibility(product)}
                                  disabled={visibility.isPending}
                                  aria-busy={changing || undefined}
                                  aria-label={product.hidden ? `Mostrar ${product.name} na loja` : `Ocultar ${product.name} da loja`}
                                  title={product.hidden ? 'Mostrar na loja' : 'Ocultar da loja'}
                                >
                                  {product.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                                <Link
                                  to={`/backoffice/produtos/${product.id}`}
                                  className="backoffice-book-delete"
                                  aria-label={`Editar ${product.name}`}
                                  title="Editar"
                                >
                                  <Pencil size={16} />
                                </Link>
                                <button
                                  type="button"
                                  className="backoffice-book-delete"
                                  onClick={() => setToDelete(product)}
                                  aria-label={`Eliminar ${product.name}`}
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
                <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
              </>
            ) : (
              <div className="backoffice-empty">
                <p>
                  {products.length === 0
                    ? 'Ainda não há produtos. Comece por criar as cestas de Natal.'
                    : segment === 'oculto' && hiddenCount === 0
                      ? 'Não há produtos ocultos: todos aparecem na loja.'
                      : 'Nenhum produto corresponde aos filtros.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        onConfirm={confirmDelete}
        title="Eliminar produto"
        message={
          toDelete
            ? `Eliminar "${toDelete.name}"? O produto fica como eliminado na API e sai também desta lista. Para o retirar só por algum tempo, prefira ocultá-lo.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        isPending={deleting}
      />
    </div>
  );
}
