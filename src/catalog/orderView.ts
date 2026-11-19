import type { DeliveryType, PaymentMethod, PaymentStatus } from '../config/store';
import type { ApiOrder, ApiOrderItem, DeliveryAddress, OrderGift } from '../types/api';
import type { LocalOrderExtras } from './localOrders';

export interface OrderPaymentView {
  method: PaymentMethod;
  status: PaymentStatus;
  phone: string | null;
  entity: string | null;
  reference: string | null;
  amount: number | null;
  expiresAt: string | null;
  /** IBAN: comprovativo enviado (nome e data); null enquanto não houver. */
  proofFileName: string | null;
  proofUploadedAt: string | null;
  /** Fim da reserva: até lá o cliente pode pedir outro pagamento. null sem novas tentativas. */
  holdUntil: string | null;
  /** Pedido recusado ou expirado: motivo, código e origem do erro enviados pelo Multicaixa Express. */
  failureMessage: string | null;
  failureCode: string | null;
  failureType: string | null;
  /** `false` enquanto a API não gere pagamentos: o método vem do que o cliente escolheu. */
  fromApi: boolean;
}

/** Encomenda pronta a mostrar: campos da API quando existem, senão o que ficou guardado no checkout. */
export interface OrderView {
  id: string;
  /** Referência da compra (5 caracteres); null nas encomendas antigas. */
  compraRef: string | null;
  status: string;
  createdAt: string;
  /** Quando o cliente confirmou que levantou (ou recebeu) a encomenda ("Levantei!"); null se foi a equipa. */
  customerConfirmedAt: string | null;
  customer: { fullName: string; phone: string; email: string; nif: string | null };
  pickupPostId: string;
  pickupPost: string;
  deliveryType: DeliveryType;
  pickupDate: string | null;
  deliveryAddress: DeliveryAddress | null;
  gift: OrderGift | null;
  payment: OrderPaymentView;
  items: ApiOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  notes: string | null;
}

function itemsTotal(items: ApiOrderItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.subTotal ?? item.price * item.quantity), 0);
}

export function toOrderView(order: ApiOrder, extras: LocalOrderExtras | null): OrderView {
  const items = order.items ?? [];

  // Com `deliveryFee` na resposta, a API já soma a taxa ao total; sem ele, `total` são só os itens.
  const apiHasFee = order.deliveryFee != null;
  const subtotal = apiHasFee ? Number(order.subtotal ?? itemsTotal(items)) : Number(order.total ?? itemsTotal(items));
  const deliveryFee = apiHasFee ? Number(order.deliveryFee) : Number(extras?.deliveryFee ?? 0);
  const total = apiHasFee ? Number(order.total) : subtotal + deliveryFee;

  const payment: OrderPaymentView = order.payment
    ? {
        method: order.payment.method,
        status: order.payment.status,
        // O seguimento público não traz o telemóvel: usa-se o que ficou guardado no checkout.
        phone: order.payment.phone ?? extras?.paymentPhone ?? null,
        entity: order.payment.entity ?? null,
        reference: order.payment.reference ?? null,
        amount: order.payment.amount ?? null,
        expiresAt: order.payment.expiresAt ?? null,
        proofFileName: order.payment.proofFileName ?? null,
        proofUploadedAt: order.payment.proofUploadedAt ?? null,
        holdUntil: order.payment.holdUntil ?? null,
        failureMessage: order.payment.failureMessage?.trim() || null,
        failureCode: order.payment.failureCode?.trim() || null,
        failureType: order.payment.failureType?.trim() || null,
        fromApi: true,
      }
    : {
        method: extras?.paymentMethod ?? 'IN_STORE',
        status: 'PENDING',
        phone: extras?.paymentPhone ?? null,
        entity: null,
        reference: null,
        amount: null,
        expiresAt: null,
        proofFileName: null,
        proofUploadedAt: null,
        holdUntil: null,
        failureMessage: null,
        failureCode: null,
        failureType: null,
        fromApi: false,
      };

  return {
    id: order.id,
    compraRef: order.compraRef ?? null,
    status: order.status,
    createdAt: order.createAt,
    customerConfirmedAt: order.customerConfirmedAt ?? null,
    customer: {
      fullName: order.customer?.fullName ?? '',
      phone: order.customer?.phone ?? '',
      email: order.customer?.email ?? '',
      nif: order.customer?.nif ?? extras?.nif ?? null,
    },
    pickupPostId: order.pickupPostId,
    pickupPost: order.pickupPost ?? '',
    deliveryType: order.deliveryType ?? extras?.deliveryType ?? 'PICKUP',
    pickupDate: order.pickupDate ?? extras?.pickupDate ?? null,
    deliveryAddress: order.deliveryAddress ?? extras?.deliveryAddress ?? null,
    gift: order.gift ?? extras?.gift ?? null,
    payment,
    items,
    subtotal,
    deliveryFee,
    total,
    notes: order.notes ?? null,
  };
}
