/* Leitura de uma encomenda para a lista e o detalhe do back-office: estado, pagamento, entrega e artigos em texto
   curto, com o tom da etiqueta (as cores dos alertas vêm do tema). */
import { shortOrderId } from '../../../api/orders';
import { toOrderView, type OrderView } from '../../../catalog/orderView';
import { PAYMENT_METHOD_LABELS } from '../../../config/store';
import { ORDER_STATUS, ORDER_STATUS_ID } from '../../../constants/orderStatus';
import type { ApiOrder } from '../../../types/api';
import { parseInstant } from '../dashboard/time';

export type Tone = 'neutro' | 'info' | 'primario' | 'sucesso' | 'atencao' | 'critico';

export const ORDERS_PATH = '/backoffice/encomendas';

export function orderPath(id: string): string {
  return `${ORDERS_PATH}/${id}`;
}

/** Referência da compra (a do pagamento e dos e-mails) ou, nas encomendas antigas, o início do n.º. */
export function orderReference(order: Pick<ApiOrder, 'id' | 'compraRef'>): string {
  return order.compraRef || shortOrderId(order.id);
}

/** "Activo" (posto por PUT /order/{id}) conta como pendente. */
export function orderStatus(order: Pick<ApiOrder, 'status'>): string {
  return order.status === ORDER_STATUS.ACTIVE ? ORDER_STATUS.PENDING : order.status;
}

export const STATUS_TONE: Record<string, Tone> = {
  [ORDER_STATUS.PENDING]: 'atencao',
  [ORDER_STATUS.PROCESSING]: 'info',
  [ORDER_STATUS.READY]: 'primario',
  [ORDER_STATUS.DELIVERED]: 'sucesso',
  [ORDER_STATUS.CANCELLED]: 'critico',
};

/** Separadores da lista, por estado; `null` = todas. */
export const STATUS_TABS: { id: string; label: string; status: string | null }[] = [
  { id: 'todas', label: 'Todas', status: null },
  { id: 'pendentes', label: 'Por tratar', status: ORDER_STATUS.PENDING },
  { id: 'preparacao', label: 'Em preparação', status: ORDER_STATUS.PROCESSING },
  { id: 'prontas', label: 'Prontas', status: ORDER_STATUS.READY },
  { id: 'entregues', label: 'Entregues', status: ORDER_STATUS.DELIVERED },
  { id: 'canceladas', label: 'Canceladas', status: ORDER_STATUS.CANCELLED },
];

export interface PaymentState {
  /** Para os filtros: comprovativo por verificar, por pagar, pago, recusado ou expirado. */
  key: 'proof' | 'pending' | 'paid' | 'failed' | 'expired' | 'none';
  label: string;
  tone: Tone;
  method: string;
}

const SHORT_METHOD: Record<string, string> = {
  MULTICAIXA_EXPRESS: 'Multicaixa Express',
  IBAN: 'Transferência (IBAN)',
  REFERENCE: 'Referência',
  IN_STORE: 'Na loja',
};

export function paymentState(view: OrderView): PaymentState {
  const { payment } = view;
  const cancelled = view.status === ORDER_STATUS.CANCELLED;
  const method = SHORT_METHOD[payment.method] ?? PAYMENT_METHOD_LABELS[payment.method] ?? payment.method;
  if (!payment.fromApi) return { key: 'none', label: 'Sem registo', tone: 'neutro', method };
  switch (payment.status) {
    case 'PAID':
      return { key: 'paid', label: 'Pago', tone: 'sucesso', method };
    case 'FAILED':
      return { key: 'failed', label: 'Recusado', tone: 'critico', method };
    case 'EXPIRED':
      return { key: 'expired', label: 'Expirado', tone: 'critico', method };
    default:
      if (cancelled) return { key: 'pending', label: 'Não pago', tone: 'neutro', method };
      return payment.method === 'IBAN' && payment.proofUploadedAt
        ? { key: 'proof', label: 'Comprovativo por verificar', tone: 'atencao', method }
        : { key: 'pending', label: 'Por pagar', tone: 'neutro', method };
  }
}

export const PAYMENT_FILTERS: { value: PaymentState['key'] | 'problem'; label: string }[] = [
  { value: 'proof', label: 'Comprovativos por verificar' },
  { value: 'pending', label: 'Por pagar' },
  { value: 'paid', label: 'Pagos' },
  { value: 'problem', label: 'Recusados ou expirados' },
];

export function matchesPaymentFilter(state: PaymentState, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'problem') return state.key === 'failed' || state.key === 'expired';
  return state.key === filter;
}

/** "Cesta de Natal Ouro" e "+2 artigos · 5 un.". */
export function itemsSummary(view: OrderView): { first: string; more: string } {
  const units = view.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const first = view.items[0]?.book ?? 'Sem artigos';
  const others = view.items.length - 1;
  const parts = [others > 0 ? `+${others} ${others === 1 ? 'artigo' : 'artigos'}` : '', `${units} un.`].filter(Boolean);
  return { first, more: parts.join(' · ') };
}

/** Data da encomenda em hora de Luanda: "18/11" e "05:31". */
export function orderMoment(view: OrderView): { instant: number | null; day: string; time: string } {
  const instant = parseInstant(view.createdAt);
  if (instant === null) return { instant, day: view.createdAt ?? '', time: '' };
  const luanda = new Date(instant + 60 * 60 * 1000).toISOString();
  return { instant, day: `${luanda.slice(8, 10)}/${luanda.slice(5, 7)}`, time: luanda.slice(11, 16) };
}

/** Acção do botão principal para cada estado seguinte. */
export const NEXT_STEP_LABEL: Record<string, string> = {
  [ORDER_STATUS.PROCESSING]: 'Começar a preparar',
  [ORDER_STATUS.READY]: 'Marcar como pronta',
  [ORDER_STATUS.DELIVERED]: 'Marcar como entregue',
};

export const CANCELLED_ID = ORDER_STATUS_ID[ORDER_STATUS.CANCELLED];

export function viewOf(order: ApiOrder): OrderView {
  return toOrderView(order, null);
}
