import { useMemo, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Download, FileCheck, MapPin, RefreshCw, Search, Truck, X } from 'lucide-react';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import { ORDER_STATUS } from '../../constants/orderStatus';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useOrders } from '../../hooks/useOrders';
import { exportOrdersToXlsx, formatPrice } from '../../utils/helpers';
import { useNow } from './dashboard/hooks';
import { timeAgo } from './dashboard/time';
import { StatusBadge, ToneBadge } from './orders/OrderBadges';
import {
  itemsSummary,
  matchesPaymentFilter,
  orderMoment,
  orderPath,
  orderReference,
  orderStatus,
  PAYMENT_FILTERS,
  paymentState,
  STATUS_TABS,
  viewOf,
} from './orders/orderInfo';
import './orders/orders.css';

const PAGE_SIZE = 25;

const SORTS: { value: string; label: string }[] = [
  { value: 'recentes', label: 'Mais recentes primeiro' },
  { value: 'antigas', label: 'Mais antigas primeiro' },
  { value: 'total-maior', label: 'Maior total primeiro' },
  { value: 'total-menor', label: 'Menor total primeiro' },
];

const DELIVERY_FILTERS = [
  { value: 'PICKUP', label: 'Levantamento na loja' },
  { value: 'HOME_DELIVERY', label: 'Entrega ao domicílio' },
];

/**
 * Lista de encomendas: separadores por estado com contagens, pesquisa e filtros (loja, pagamento, entrega), uma
 * linha por encomenda com o que a equipa precisa de ver e a ligação para o detalhe. Os filtros, a ordem e a página
 * ficam no endereço: ao voltar do detalhe, a lista está como estava.
 */
export function BackofficeOrdersPage() {
  useDocumentTitle('Encomendas');
  const navigate = useNavigate();
  const { data: orders = [], isLoading, isError, isFetching, refetch } = useOrders();
  const now = useNow(60_000);
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const tab = STATUS_TABS.find((item) => item.id === params.get('estado')) ?? STATUS_TABS[0];
  const store = params.get('loja') ?? '';
  const payment = params.get('pagamento') ?? '';
  const delivery = params.get('entrega') ?? '';
  const sort = SORTS.some((item) => item.value === params.get('ordem')) ? (params.get('ordem') as string) : 'recentes';
  const page = Math.max(0, Number(params.get('pagina') ?? 1) - 1) || 0;

  /** Muda parâmetros do endereço; qualquer filtro novo volta à primeira página. */
  const update = (changes: Record<string, string | null>, keepPage = false) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!keepPage) next.delete('pagina');
        return next;
      },
      { replace: true },
    );

  const rows = useMemo(
    () =>
      orders.map((order) => {
        const view = viewOf(order);
        return { order, view, pay: paymentState(view), status: orderStatus(order), moment: orderMoment(view) };
      }),
    [orders],
  );

  const stores = useMemo(
    () => [...new Set(orders.map((order) => order.pickupPost).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')),
    [orders],
  );

  // Filtros sem o estado: as contagens dos separadores respeitam a pesquisa e os outros filtros.
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    const digits = query.replace(/\D/g, '');
    return rows.filter(({ order, view, pay }) => {
      const matchesSearch =
        !query ||
        order.id.toLowerCase().includes(query) ||
        (order.compraRef ?? '').toLowerCase().includes(query) ||
        view.customer.fullName.toLowerCase().includes(query) ||
        view.customer.email.toLowerCase().includes(query) ||
        (digits.length >= 3 && view.customer.phone.replace(/\D/g, '').includes(digits));
      return (
        matchesSearch &&
        (!store || order.pickupPost === store) &&
        (!delivery || view.deliveryType === delivery) &&
        matchesPaymentFilter(pay, payment)
      );
    });
  }, [rows, search, store, delivery, payment]);

  const counts = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const row of filtered) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
    return byStatus;
  }, [filtered]);

  const visible = useMemo(() => {
    const list = tab.status ? filtered.filter((row) => row.status === tab.status) : [...filtered];
    const byDate = (a: (typeof list)[number], b: (typeof list)[number]) => (a.moment.instant ?? 0) - (b.moment.instant ?? 0);
    switch (sort) {
      case 'antigas':
        return list.sort(byDate);
      case 'total-maior':
        return list.sort((a, b) => b.view.total - a.view.total);
      case 'total-menor':
        return list.sort((a, b) => a.view.total - b.view.total);
      default:
        return list.sort((a, b) => byDate(b, a));
    }
  }, [filtered, tab.status, sort]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const value = visible.filter((row) => row.status !== ORDER_STATUS.CANCELLED).reduce((sum, row) => sum + row.view.total, 0);
  const proofsToCheck = rows.filter((row) => row.pay.key === 'proof').length;
  const hasFilters = Boolean(search || store || payment || delivery);

  const openRow = (event: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((event.target as HTMLElement).closest('a, button')) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(orderPath(id), '_blank');
      return;
    }
    navigate(orderPath(id));
  };

  return (
    <div className="backoffice-page encomendas">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Encomendas</h1>
              <p className="section-subtitle">Clique numa encomenda para ver o detalhe, o pagamento e mudar o estado.</p>
            </div>
            <div className="encomendas__accoes">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw size={14} className={isFetching ? 'dash-spin' : undefined} aria-hidden="true" />
                {isFetching ? 'A actualizar…' : 'Actualizar'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => exportOrdersToXlsx(visible.map((row) => row.order))}
                disabled={visible.length === 0}
              >
                <Download size={14} aria-hidden="true" />
                Exportar Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        {isLoading ? (
          <div className="backoffice-empty">
            <p>A carregar encomendas…</p>
          </div>
        ) : isError ? (
          <div className="backoffice-empty">
            <p>Não foi possível carregar as encomendas.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            {proofsToCheck > 0 && payment !== 'proof' && (
              <div className="encomendas-alerta" role="status">
                <FileCheck size={16} aria-hidden="true" />
                <span>
                  <strong>{proofsToCheck}</strong>{' '}
                  {proofsToCheck === 1 ? 'comprovativo de transferência por verificar' : 'comprovativos de transferência por verificar'}
                </span>
                <button type="button" className="encomendas-alerta__accao" onClick={() => update({ pagamento: 'proof', estado: null })}>
                  Ver {proofsToCheck === 1 ? 'qual' : 'quais'}
                </button>
              </div>
            )}

            <div className="encomendas-separadores" role="tablist" aria-label="Estado das encomendas">
              {STATUS_TABS.map((item) => {
                const count = item.status ? (counts.get(item.status) ?? 0) : filtered.length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab.id === item.id}
                    className="encomendas-separador"
                    onClick={() => update({ estado: item.id === 'todas' ? null : item.id })}
                  >
                    {item.label}
                    <span className="encomendas-separador__n">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="encomendas-filtros">
              <div className="encomendas-pesquisa">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  className="form-input"
                  placeholder="N.º, referência, cliente, e-mail ou telefone"
                  aria-label="Pesquisar encomendas"
                  value={search}
                  onChange={(event) => update({ q: event.target.value })}
                />
              </div>
              <Select
                value={store}
                onChange={(next) => update({ loja: next })}
                placeholder="Todas as lojas"
                options={stores.map((name) => ({ value: name, label: name }))}
              />
              <Select
                value={payment}
                onChange={(next) => update({ pagamento: next })}
                placeholder="Todos os pagamentos"
                options={PAYMENT_FILTERS.map((item) => ({
                  value: item.value,
                  label: item.value === 'proof' ? `${item.label} (${proofsToCheck})` : item.label,
                }))}
              />
              <Select
                value={delivery}
                onChange={(next) => update({ entrega: next })}
                placeholder="Todas as entregas"
                options={DELIVERY_FILTERS}
              />
              <Select
                value={sort}
                onChange={(next) => update({ ordem: next === 'recentes' ? null : next })}
                options={SORTS}
                clearable={false}
              />
              {hasFilters && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => update({ q: null, loja: null, pagamento: null, entrega: null })}
                >
                  <X size={14} aria-hidden="true" />
                  Limpar filtros
                </button>
              )}
            </div>

            <p className="encomendas-resumo" aria-live="polite">
              {visible.length === 1 ? '1 encomenda' : `${visible.length} encomendas`}
              {visible.length > 0 && <> · {formatPrice(value)} sem as canceladas</>}
            </p>

            {pageRows.length > 0 ? (
              <>
                <div className="backoffice-table-wrap encomendas-tabela-wrap">
                  <table className="backoffice-table encomendas-tabela">
                    <thead>
                      <tr>
                        <th scope="col">Encomenda</th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Artigos</th>
                        <th scope="col">Entrega</th>
                        <th scope="col">Pagamento</th>
                        <th scope="col">Estado</th>
                        <th scope="col" className="num">
                          Total
                        </th>
                        <th scope="col">
                          <span className="sr-only">Abrir</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map(({ order, view, pay, status, moment }) => {
                        const reference = orderReference(order);
                        const items = itemsSummary(view);
                        const home = view.deliveryType === 'HOME_DELIVERY';
                        const ago = timeAgo(moment.instant, now);
                        return (
                          <tr key={order.id} className="encomendas-linha" onClick={(event) => openRow(event, order.id)}>
                            <td data-label="Encomenda">
                              <Link to={orderPath(order.id)} className="encomendas-ref">
                                {reference}
                              </Link>
                              <span className="encomendas-sub" title={order.id}>
                                {moment.day} · {moment.time}
                                {ago && ` · ${ago}`}
                              </span>
                            </td>
                            <td data-label="Cliente">
                              <span className="encomendas-forte">{view.customer.fullName}</span>
                              <span className="encomendas-sub">{view.customer.phone}</span>
                            </td>
                            <td data-label="Artigos">
                              <span className="encomendas-texto" title={view.items.map((item) => `${item.quantity} × ${item.book}`).join('\n')}>
                                {items.first}
                              </span>
                              <span className="encomendas-sub">{items.more}</span>
                            </td>
                            <td data-label="Entrega">
                              <span className="encomendas-entrega">
                                {home ? <Truck size={13} aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}
                                {home ? 'Domicílio' : 'Levantamento'}
                              </span>
                              <span className="encomendas-sub">
                                {home ? view.deliveryAddress?.district || order.pickupPost : order.pickupPost}
                                {!home && view.pickupDate && ` · ${view.pickupDate.slice(8, 10)}/${view.pickupDate.slice(5, 7)}`}
                              </span>
                            </td>
                            <td data-label="Pagamento">
                              <ToneBadge tone={pay.tone}>{pay.label}</ToneBadge>
                              <span className="encomendas-sub">{pay.method}</span>
                            </td>
                            <td data-label="Estado">
                              <StatusBadge status={status} />
                            </td>
                            <td data-label="Total" className="num encomendas-total">
                              {formatPrice(view.total)}
                            </td>
                            <td className="encomendas-abrir">
                              <Link to={orderPath(order.id)} aria-label={`Abrir a encomenda ${reference}`} tabIndex={-1}>
                                <ChevronRight size={16} aria-hidden="true" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPageChange={(next) => update({ pagina: next > 0 ? String(next + 1) : null }, true)}
                />
              </>
            ) : (
              <div className="backoffice-empty">
                <p>
                  {orders.length === 0
                    ? 'Ainda não existem encomendas.'
                    : hasFilters || tab.status
                      ? 'Nenhuma encomenda corresponde à pesquisa e aos filtros.'
                      : 'Não há encomendas.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
