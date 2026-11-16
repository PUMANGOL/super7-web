import { useMemo, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { getOrderTotal, getOrderUnits, shortOrderId } from '../../api/orders';
import { OrderItemsModal } from '../../components/backoffice/OrderItemsModal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Select } from '../../components/ui/Select';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../../config/store';
import { nextOrderStatuses, ORDER_STATUS, ORDER_STATUS_ID, orderStatusColors } from '../../constants/orderStatus';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useOrders } from '../../hooks/useOrders';
import { useUpdateOrderStatus } from '../../hooks/useUpdateOrderStatus';
import type { ApiOrder } from '../../types/api';
import { exportOrdersToXlsx, formatDate, formatPrice } from '../../utils/helpers';

const STATUS_FILTER_OPTIONS = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.READY,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
].map((status) => ({ value: status, label: status }));

export function BackofficeOrdersPage() {
  const { data: orders = [], isLoading, isError, refetch } = useOrders();
  const { mutate: updateStatus, isPending, variables } = useUpdateOrderStatus();
  const { can } = useAuth();
  const { showToast } = useToast();
  const canChangeStatus = can('changeOrderStatus');
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<ApiOrder | null>(null);

  const stores = useMemo(
    () => [...new Set(orders.map((order) => order.pickupPost).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const query = search.toLowerCase().trim();
    return orders.filter((order) => {
      const matchesSearch =
        !query ||
        order.id.toLowerCase().includes(query) ||
        order.customer.fullName.toLowerCase().includes(query) ||
        order.customer.email.toLowerCase().includes(query) ||
        order.customer.phone.includes(query);
      const matchesStore = !storeFilter || order.pickupPost === storeFilter;
      const status = order.status === ORDER_STATUS.ACTIVE ? ORDER_STATUS.PENDING : order.status;
      const matchesStatus = !statusFilter || status === statusFilter;
      return matchesSearch && matchesStore && matchesStatus;
    });
  }, [orders, search, storeFilter, statusFilter]);

  const count = (status: string) => orders.filter((order) => order.status === status).length;
  const volume = orders
    .filter((order) => order.status !== ORDER_STATUS.CANCELLED)
    .reduce((sum, order) => sum + getOrderTotal(order), 0);

  const changeStatus = (order: ApiOrder, statusId: number) => {
    updateStatus(
      { order, statusId },
      {
        onSuccess: (updated) => {
          if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
          setOrderToCancel(null);
          showToast(`Encomenda ${shortOrderId(updated.id)}: ${updated.status}. O cliente foi avisado por e-mail.`);
        },
        onError: (error) => {
          showToast(getApiErrorMessage(error, 'Não foi possível actualizar o estado da encomenda.'), 'error');
        },
      },
    );
  };

  const onStatusSelected = (order: ApiOrder, value: string) => {
    const statusId = Number(value);
    if (!statusId) return;
    if (statusId === ORDER_STATUS_ID[ORDER_STATUS.CANCELLED]) {
      setOrderToCancel(order);
      return;
    }
    changeStatus(order, statusId);
  };

  return (
    <div className="backoffice-page">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title">Encomendas</h1>
              <p className="section-subtitle">Encomendas da loja Super7 Digital, das mais recentes para as mais antigas.</p>
            </div>
            <button className="btn btn-primary" onClick={() => exportOrdersToXlsx(filteredOrders)} disabled={filteredOrders.length === 0}>
              <Download size={18} />
              Exportar Excel
            </button>
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
            <div className="backoffice-stats">
              <div className="stat-card">
                <span className="stat-value">{orders.length}</span>
                <span className="stat-label">Encomendas</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{count(ORDER_STATUS.PENDING) + count(ORDER_STATUS.ACTIVE)}</span>
                <span className="stat-label">Por tratar</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{count(ORDER_STATUS.READY)}</span>
                <span className="stat-label">Prontas a levantar</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{formatPrice(volume)}</span>
                <span className="stat-label">Volume (sem canceladas)</span>
              </div>
            </div>

            <div className="backoffice-filters">
              <div className="backoffice-search">
                <Search size={18} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Pesquisar por n.º, cliente, e-mail ou telefone…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="backoffice-filter-group">
                <Filter size={16} />
                <Select
                  value={storeFilter}
                  onChange={setStoreFilter}
                  placeholder="Todas as lojas"
                  options={stores.map((store) => ({ value: store, label: store }))}
                />
                <Select value={statusFilter} onChange={setStatusFilter} placeholder="Todos os estados" options={STATUS_FILTER_OPTIONS} />
              </div>
            </div>

            {filteredOrders.length > 0 ? (
              <div className="backoffice-table-wrap">
                <table className="backoffice-table">
                  <thead>
                    <tr>
                      <th>N.º</th>
                      <th>Cliente</th>
                      <th>Contacto</th>
                      <th>Loja e entrega</th>
                      <th>Artigos</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Data</th>
                      <th>Acções</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => {
                      const options = canChangeStatus ? nextOrderStatuses(order.status) : [];
                      const updatingThis = isPending && variables?.order.id === order.id;

                      return (
                        <tr key={order.id}>
                          <td className="mono" title={order.id}>
                            {shortOrderId(order.id)}
                          </td>
                          <td>{order.customer.fullName}</td>
                          <td>
                            <div className="contact-cell">
                              <span>{order.customer.phone}</span>
                              <span className="contact-email">{order.customer.email}</span>
                            </div>
                          </td>
                          <td>
                            {order.pickupPost}
                            {order.deliveryType === 'HOME_DELIVERY' && (
                              <div className="backoffice-book-meta">Entrega ao domicílio</div>
                            )}
                            {order.payment && (
                              <div className="backoffice-book-meta">
                                {PAYMENT_METHOD_LABELS[order.payment.method]} · {PAYMENT_STATUS_LABELS[order.payment.status]}
                              </div>
                            )}
                          </td>
                          <td>{getOrderUnits(order)}</td>
                          <td className="price">{formatPrice(getOrderTotal(order))}</td>
                          <td className="backoffice-status-cell">
                            {options.length > 0 ? (
                              <Select
                                className="backoffice-status-select"
                                value=""
                                onChange={(value) => onStatusSelected(order, value)}
                                options={options}
                                disabled={updatingThis}
                                clearable={false}
                                placeholder={updatingThis ? 'A actualizar…' : order.status}
                              />
                            ) : (
                              <span className={`badge ${orderStatusColors[order.status] ?? 'badge-gray'}`}>{order.status}</span>
                            )}
                          </td>
                          <td className="date">{formatDate(order.createAt)}</td>
                          <td>
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedOrder(order)}>
                              Ver detalhe
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="backoffice-empty">
                <p>{orders.length === 0 ? 'Ainda não existem encomendas.' : 'Nenhuma encomenda corresponde aos filtros.'}</p>
              </div>
            )}
          </>
        )}
      </div>

      <OrderItemsModal isOpen={selectedOrder !== null} onClose={() => setSelectedOrder(null)} order={selectedOrder} />

      <ConfirmModal
        isOpen={orderToCancel !== null}
        onClose={() => !isPending && setOrderToCancel(null)}
        onConfirm={() => orderToCancel && changeStatus(orderToCancel, ORDER_STATUS_ID[ORDER_STATUS.CANCELLED])}
        title="Cancelar encomenda"
        message={
          orderToCancel
            ? `Cancelar a encomenda ${shortOrderId(orderToCancel.id)} de ${orderToCancel.customer.fullName}? O cliente recebe um e-mail e a encomenda deixa de poder avançar.`
            : ''
        }
        confirmLabel="Cancelar encomenda"
        cancelLabel="Voltar"
        variant="danger"
        isPending={isPending}
      />
    </div>
  );
}
