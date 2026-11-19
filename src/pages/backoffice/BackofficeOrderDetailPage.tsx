import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Check,
  CreditCard,
  Gift,
  Mail,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  Printer,
  Truck,
  User,
} from 'lucide-react';
import { getApiErrorMessage } from '../../api/client';
import { fetchOrder, shortOrderId } from '../../api/orders';
import { OrderPaymentProof } from '../../components/backoffice/OrderPaymentProof';
import { Thumbnail } from '../../components/backoffice/Thumbnail';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PAYMENT_METHOD_LABELS } from '../../config/store';
import { nextOrderStatuses, ORDER_STATUS } from '../../constants/orderStatus';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useUpdateOrderStatus } from '../../hooks/useUpdateOrderStatus';
import type { ApiOrder } from '../../types/api';
import { formatDate as formatDay } from '../../utils/format';
import { formatDate, formatPrice } from '../../utils/helpers';
import { useNow } from './dashboard/hooks';
import { timeAgo } from './dashboard/time';
import { StatusBadge, ToneBadge } from './orders/OrderBadges';
import {
  CANCELLED_ID,
  NEXT_STEP_LABEL,
  ORDERS_PATH,
  orderMoment,
  orderReference,
  orderStatus,
  paymentState,
  viewOf,
} from './orders/orderInfo';
import './orders/orders.css';

/** Detalhe de uma encomenda: artigos, estado (com as acções seguintes), pagamento, cliente e entrega. */
export function BackofficeOrderDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id),
    // Vinda da lista, a encomenda aparece logo; o pedido traz a versão actual.
    initialData: () => queryClient.getQueryData<ApiOrder[]>(['orders'])?.find((order) => order.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(['orders'])?.dataUpdatedAt,
    staleTime: 15_000,
  });
  useDocumentTitle(query.data ? `Encomenda ${orderReference(query.data)}` : 'Encomenda');

  if (!query.data) {
    return (
      <div className="backoffice-page">
        <div className="backoffice-empty">
          {query.isLoading ? (
            <p>A carregar a encomenda…</p>
          ) : (
            <>
              <p>{getApiErrorMessage(query.error, 'Não foi possível carregar a encomenda.')}</p>
              <div className="encomenda-vazio-accoes">
                <Link to={ORDERS_PATH} className="btn btn-outline btn-sm">
                  <ArrowLeft size={14} aria-hidden="true" /> Voltar às encomendas
                </Link>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => query.refetch()}>
                  Tentar novamente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return <OrderDetail order={query.data} />;
}

const STEPS = [
  { id: 'registada', label: 'Registada' },
  { id: 'paga', label: 'Paga' },
  { id: 'preparacao', label: 'Em preparação' },
  { id: 'pronta', label: 'Pronta' },
  { id: 'entregue', label: 'Entregue' },
];

/** Etapas já cumpridas: o pagamento e o estado andam em paralelo (pode preparar-se uma encomenda por pagar). */
function doneSteps(status: string, paid: boolean): Set<string> {
  const done = new Set(['registada']);
  if (paid) done.add('paga');
  const order = [ORDER_STATUS.PROCESSING, ORDER_STATUS.READY, ORDER_STATUS.DELIVERED] as string[];
  const reached = order.indexOf(status);
  if (reached >= 0) done.add('preparacao');
  if (reached >= 1) done.add('pronta');
  if (reached >= 2) done.add('entregue');
  return done;
}

function Card({ title, icon: Icon, children, className }: { title: string; icon: typeof User; children: ReactNode; className?: string }) {
  return (
    <section className={`encomenda-cartao${className ? ` ${className}` : ''}`}>
      <h2 className="encomenda-cartao__titulo">
        <Icon size={15} aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function OrderDetail({ order }: { order: ApiOrder }) {
  const { can } = useAuth();
  const { showToast } = useToast();
  const now = useNow(60_000);
  const { mutate: updateStatus, isPending, variables } = useUpdateOrderStatus();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const view = viewOf(order);
  const pay = paymentState(view);
  const status = orderStatus(order);
  const moment = orderMoment(view);
  const reference = orderReference(order);
  const home = view.deliveryType === 'HOME_DELIVERY';
  const cancelled = status === ORDER_STATUS.CANCELLED;
  const done = doneSteps(status, pay.key === 'paid');
  const options = can('changeOrderStatus') ? nextOrderStatuses(order.status) : [];
  const forward = options.find((option) => Number(option.value) !== CANCELLED_ID);
  const canCancel = options.some((option) => Number(option.value) === CANCELLED_ID);
  const updating = isPending && variables?.order.id === order.id;
  const units = view.items.reduce((sum, item) => sum + Number(item.quantity), 0);

  const changeStatus = (statusId: number) =>
    updateStatus(
      { order, statusId },
      {
        onSuccess: (updated) => {
          setConfirmCancel(false);
          showToast(`Encomenda ${orderReference(updated)}: ${updated.status}. O cliente foi avisado por e-mail.`);
        },
        onError: (error) => showToast(getApiErrorMessage(error, 'Não foi possível mudar o estado da encomenda.'), 'error'),
      },
    );

  return (
    <div className="backoffice-page encomenda">
      <div className="backoffice-header">
        <div className="backoffice-header-inner">
          <div className="backoffice-header-row">
            <div>
              <h1 className="section-title encomenda-titulo">
                Encomenda {reference}
                <StatusBadge status={status} />
                <ToneBadge tone={pay.tone}>{pay.label}</ToneBadge>
              </h1>
              <p className="section-subtitle">
                N.º {shortOrderId(order.id)} · registada a {moment.day} às {moment.time}
                {moment.instant !== null && ` (${timeAgo(moment.instant, now)})`}
              </p>
            </div>
            <div className="encomenda-accoes">
              <Link to={ORDERS_PATH} className="btn btn-outline btn-sm">
                <ArrowLeft size={14} aria-hidden="true" /> Encomendas
              </Link>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
                <Printer size={14} aria-hidden="true" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="backoffice-body">
        {cancelled ? (
          <p className="encomenda-cancelada" role="status">
            <Ban size={16} aria-hidden="true" />
            Encomenda cancelada.
            {(pay.key === 'failed' || pay.key === 'expired') && ' O pagamento foi recusado ou expirou e o stock foi devolvido.'}
          </p>
        ) : (
          <ol className="encomenda-etapas" aria-label="Etapas da encomenda">
            {STEPS.map((step) => (
              <li key={step.id} className={done.has(step.id) ? 'is-feita' : undefined}>
                <span className="encomenda-etapas__marca" aria-hidden="true">
                  {done.has(step.id) && <Check size={12} strokeWidth={3} />}
                </span>
                {step.label}
                <span className="sr-only">{done.has(step.id) ? ' (feita)' : ' (por fazer)'}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="encomenda-grelha">
          <div className="encomenda-principal">
            <Card title={`Artigos (${units} ${units === 1 ? 'unidade' : 'unidades'})`} icon={Package} className="encomenda-artigos">
              <div className="encomenda-tabela-wrap">
                <table className="encomenda-tabela">
                  <thead>
                    <tr>
                      <th scope="col">Artigo</th>
                      <th scope="col" className="num">
                        Preço
                      </th>
                      <th scope="col" className="num">
                        Qtd.
                      </th>
                      <th scope="col" className="num">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="encomenda-artigo">
                            <Thumbnail title={item.book} src={item.coverImage} className="encomenda-artigo__imagem" />
                            {item.productId && can('manageCatalog') ? (
                              <Link to={`/backoffice/produtos/${item.productId}`} title="Abrir o produto">
                                {item.book}
                              </Link>
                            ) : (
                              <span>{item.book}</span>
                            )}
                          </span>
                        </td>
                        <td className="num">{formatPrice(item.price)}</td>
                        <td className="num">× {Number(item.quantity)}</td>
                        <td className="num encomenda-forte">{formatPrice(item.subTotal ?? item.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="encomenda-totais">
                <div>
                  <dt>Artigos</dt>
                  <dd>{formatPrice(view.subtotal)}</dd>
                </div>
                {(home || view.deliveryFee > 0) && (
                  <div>
                    <dt>Taxa de entrega</dt>
                    <dd>{formatPrice(view.deliveryFee)}</dd>
                  </div>
                )}
                <div className="encomenda-totais__total">
                  <dt>Total</dt>
                  <dd>{formatPrice(view.total)}</dd>
                </div>
              </dl>
            </Card>

            <div className="encomenda-par">
              <Card title="Cliente" icon={User}>
                <p className="encomenda-forte">{view.customer.fullName}</p>
                <ul className="encomenda-contactos">
                  {view.customer.phone && (
                    <li>
                      <Phone size={13} aria-hidden="true" />
                      <a href={`tel:${view.customer.phone.replace(/\s/g, '')}`}>{view.customer.phone}</a>
                    </li>
                  )}
                  {view.customer.email && (
                    <li>
                      <Mail size={13} aria-hidden="true" />
                      <a href={`mailto:${view.customer.email}`}>{view.customer.email}</a>
                    </li>
                  )}
                  {order.customer.location && (
                    <li>
                      <MapPin size={13} aria-hidden="true" />
                      {order.customer.location}
                    </li>
                  )}
                </ul>
                {view.customer.nif && <p className="encomenda-sub">NIF {view.customer.nif}</p>}
                {view.customer.phone && (
                  <Link to={`${ORDERS_PATH}?q=${encodeURIComponent(view.customer.phone)}`} className="encomenda-ligacao">
                    Outras encomendas deste cliente
                  </Link>
                )}
              </Card>

              <Card title={home ? 'Entrega ao domicílio' : 'Levantamento na loja'} icon={home ? Truck : MapPin}>
                {home && view.deliveryAddress ? (
                  <>
                    <p className="encomenda-forte">{view.deliveryAddress.address}</p>
                    <p className="encomenda-sub">
                      {[view.deliveryAddress.district, view.deliveryAddress.reference].filter(Boolean).join(' · ')}
                    </p>
                    <p className="encomenda-sub">Preparada em {order.pickupPost}</p>
                  </>
                ) : (
                  <>
                    <p className="encomenda-forte">{order.pickupPost || 'Loja não indicada'}</p>
                    {view.pickupDate && (
                      <p className="encomenda-sub">
                        A partir de {formatDay(view.pickupDate, { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    )}
                  </>
                )}
              </Card>
            </div>

            {view.gift && (
              <Card title="Oferta" icon={Gift}>
                <p className="encomenda-linha">
                  Para <strong>{view.gift.recipient}</strong>
                </p>
                {view.gift.message && <blockquote className="encomenda-mensagem">“{view.gift.message}”</blockquote>}
              </Card>
            )}

            {order.notes?.trim() && (
              <Card title="Observações do cliente" icon={MessageSquareText}>
                <p className="encomenda-notas">{order.notes}</p>
              </Card>
            )}
          </div>

          <aside className="encomenda-lateral">
            <Card title="Estado" icon={Check} className="encomenda-estado">
              <div className="encomenda-estado__actual">
                <StatusBadge status={status} />
                {!cancelled && status !== ORDER_STATUS.DELIVERED && (
                  <span className="encomenda-sub">
                    {status === ORDER_STATUS.PENDING ? 'À espera de ser preparada' : status === ORDER_STATUS.PROCESSING ? 'A ser preparada na loja' : 'À espera do cliente ou do estafeta'}
                  </span>
                )}
                {status === ORDER_STATUS.DELIVERED && order.customerConfirmedAt && (
                  <span className="encomenda-sub">
                    {view.deliveryType === 'HOME_DELIVERY' ? 'Entrega' : 'Levantamento'} confirmado pelo cliente a{' '}
                    {formatDate(order.customerConfirmedAt)}
                  </span>
                )}
              </div>
              {forward && (
                <>
                  {status === ORDER_STATUS.PENDING && pay.key !== 'paid' && (
                    <p className="encomenda-aviso">O pagamento ainda não está confirmado.</p>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary encomenda-estado__botao"
                    onClick={() => changeStatus(Number(forward.value))}
                    disabled={updating}
                  >
                    {updating && variables?.statusId !== CANCELLED_ID ? 'A actualizar…' : (NEXT_STEP_LABEL[forward.label] ?? forward.label)}
                  </button>
                </>
              )}
              {canCancel && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm encomenda-estado__cancelar"
                  onClick={() => setConfirmCancel(true)}
                  disabled={updating}
                >
                  <Ban size={14} aria-hidden="true" /> Cancelar encomenda
                </button>
              )}
              {options.length > 0 && <p className="encomenda-sub">O cliente recebe um e-mail a cada mudança.</p>}
            </Card>

            <Card title="Pagamento" icon={CreditCard}>
              <dl className="encomenda-dados">
                <div>
                  <dt>Método</dt>
                  <dd>{PAYMENT_METHOD_LABELS[view.payment.method] ?? pay.method}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <ToneBadge tone={pay.tone}>{pay.label}</ToneBadge>
                  </dd>
                </div>
                <div>
                  <dt>Valor</dt>
                  <dd className="encomenda-forte">{formatPrice(view.payment.amount ?? view.total)}</dd>
                </div>
                {view.payment.phone && (
                  <div>
                    <dt>Telemóvel</dt>
                    <dd>{view.payment.phone}</dd>
                  </div>
                )}
                {view.payment.reference && (
                  <div>
                    <dt>Referência</dt>
                    <dd>
                      Entidade {view.payment.entity} · {view.payment.reference}
                    </dd>
                  </div>
                )}
                {order.payment?.paidAt && pay.key === 'paid' && (
                  <div>
                    <dt>Confirmado</dt>
                    <dd>{formatDate(order.payment.paidAt)}</dd>
                  </div>
                )}
              </dl>
              {(pay.key === 'failed' || pay.key === 'expired') && (view.payment.failureMessage || view.payment.failureCode) && (
                <p className="encomenda-erro">
                  {view.payment.failureMessage ?? 'Sem descrição'}
                  {view.payment.failureCode && ` · ${view.payment.failureCode}`}
                  {view.payment.failureType && ` (${view.payment.failureType})`}
                </p>
              )}
              <OrderPaymentProof key={`${order.id}-${order.payment?.proofUploadedAt ?? ''}`} order={order} onUpdated={() => undefined} />
            </Card>

          </aside>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => !updating && setConfirmCancel(false)}
        onConfirm={() => changeStatus(CANCELLED_ID)}
        title="Cancelar encomenda"
        message={`Cancelar a encomenda ${reference} de ${view.customer.fullName}? O cliente recebe um e-mail e a encomenda deixa de poder avançar.`}
        confirmLabel="Cancelar encomenda"
        cancelLabel="Voltar"
        variant="danger"
        isPending={updating}
      />
    </div>
  );
}
