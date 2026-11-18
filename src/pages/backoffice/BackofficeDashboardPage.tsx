import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChartColumn, ClipboardList, RefreshCw } from 'lucide-react';
import { useCatalog } from '../../catalog/useCatalog';
import { useAuth } from '../../context/auth';
import { useCategories } from '../../hooks/useCategories';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useOrders } from '../../hooks/useOrders';
import { usePickupPosts } from '../../hooks/usePickupPosts';
import { ExecutiveView } from './dashboard/ExecutiveView';
import { OperationalView } from './dashboard/OperationalView';
import { useNow, useProductsIncludingUnavailable } from './dashboard/hooks';
import { isPeriodId, prepareOrders, type PeriodId, type ProductInfo } from './dashboard/metrics';
import { buildOperations } from './dashboard/operations';
import { clockTime } from './dashboard/time';
import './BackofficeDashboardPage.css';

type ViewId = 'executivo' | 'operacional';

const DEFAULT_PERIOD: PeriodId = '30d';

const VIEWS: { id: ViewId; label: string; icon: typeof ChartColumn }[] = [
  { id: 'executivo', label: 'Executivo', icon: ChartColumn },
  { id: 'operacional', label: 'Operacional', icon: ClipboardList },
];

export function BackofficeDashboardPage() {
  useDocumentTitle('Painel');
  const { can } = useAuth();
  const canManageCatalog = can('manageCatalog');

  const ordersQuery = useOrders();
  const catalogQuery = useCatalog();
  const categoriesQuery = useCategories();
  const postsQuery = usePickupPosts();
  const hiddenProductsQuery = useProductsIncludingUnavailable(canManageCatalog);
  const now = useNow(60_000);

  const [searchParams, setSearchParams] = useSearchParams();
  const view: ViewId = searchParams.get('vista') === 'operacional' ? 'operacional' : 'executivo';
  const periodParam = searchParams.get('periodo');
  const period: PeriodId = isPeriodId(periodParam) ? periodParam : DEFAULT_PERIOD;

  const setParam = (key: string, value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const prepared = useMemo(() => prepareOrders(ordersQuery.data ?? []), [ordersQuery.data]);
  const ops = useMemo(() => buildOperations(prepared, now), [prepared, now]);

  /** Nome e categoria por ID de produto: catálogo à venda + produtos indisponíveis (perfis de catálogo). */
  const productInfo = useMemo(() => {
    const info = new Map<string, ProductInfo>();
    catalogQuery.data?.products.forEach((product) => {
      info.set(product.id, { name: product.name, categoryName: product.categoryName });
    });
    const categoryNames = new Map((categoriesQuery.data ?? []).map((category) => [category.id, category.name]));
    hiddenProductsQuery.data?.forEach((product) => {
      if (info.has(product.id)) return;
      const categoryName = (product.categoryId && categoryNames.get(product.categoryId)) || product.category || '';
      info.set(product.id, { name: product.name?.trim() || 'Produto', categoryName });
    });
    return info;
  }, [catalogQuery.data, categoriesQuery.data, hiddenProductsQuery.data]);

  const refresh = () => {
    void ordersQuery.refetch();
    void catalogQuery.refetch();
  };

  const orders = ordersQuery.data ?? [];

  return (
    <div className="backoffice-page dash">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Painel</h1>
              <p className="section-subtitle">Indicadores de gestão e o trabalho do dia na loja Super7 Digital.</p>
            </div>
            <div className="dash-header-actions">
              {ordersQuery.dataUpdatedAt > 0 && (
                <span className="dash-updated">Actualizado às {clockTime(ordersQuery.dataUpdatedAt)}</span>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={refresh} disabled={ordersQuery.isFetching}>
                <RefreshCw size={14} className={ordersQuery.isFetching ? 'dash-spin' : undefined} aria-hidden="true" />
                {ordersQuery.isFetching ? 'A actualizar…' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        <div className="dash-tabs" role="tablist" aria-label="Vistas do painel">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`dash-tab-${id}`}
              aria-selected={view === id}
              aria-controls="dash-panel"
              className="dash-tab"
              onClick={() => setParam('vista', id)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
              {id === 'operacional' && ops.ibanToVerify.length > 0 && (
                <span className="dash-tab-badge" title="Comprovativos IBAN por verificar">
                  {ops.ibanToVerify.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="dash-panel" aria-labelledby={`dash-tab-${view}`}>
          {ordersQuery.isLoading ? (
            <div className="backoffice-empty">
              <p>A carregar o painel…</p>
            </div>
          ) : ordersQuery.isError ? (
            <div className="backoffice-empty">
              <p>Não foi possível carregar as encomendas.</p>
              <button type="button" className="btn btn-outline btn-sm dash-retry" onClick={() => ordersQuery.refetch()}>
                Tentar novamente
              </button>
            </div>
          ) : view === 'executivo' ? (
            orders.length === 0 ? (
              <div className="backoffice-empty">
                <p>Ainda não existem encomendas. Os indicadores aparecem com a primeira encomenda.</p>
              </div>
            ) : (
              <ExecutiveView
                orders={prepared}
                now={now}
                period={period}
                onPeriodChange={(value) => setParam('periodo', value)}
                products={productInfo}
                productsLoading={catalogQuery.isLoading}
                productsError={catalogQuery.isError && !hiddenProductsQuery.data}
                onRetryProducts={() => catalogQuery.refetch()}
                pickupPosts={postsQuery.data ?? []}
              />
            )
          ) : (
            <OperationalView
              ops={ops}
              now={now}
              catalogProducts={catalogQuery.data?.products}
              catalogLoading={catalogQuery.isLoading}
              catalogError={catalogQuery.isError}
              onRetryCatalog={() => catalogQuery.refetch()}
              canManageCatalog={canManageCatalog}
            />
          )}
        </div>
      </div>
    </div>
  );
}
