/**
 * Vista Operacional: o estado actual das encomendas e do stock, sem filtro de período.
 * Uma encomenda "aberta" ainda não foi entregue nem cancelada.
 */
import type { Product } from '../../../catalog/types';
import { ORDER_STATUS } from '../../../constants/orderStatus';
import { isCancelled, type PreparedOrder } from './metrics';
import { addDays, DAY_MS, dayKey, parseInstant } from './time';

export interface OpsRow {
  entry: PreparedOrder;
  /** Instante de referência do "há quanto tempo" desta lista. */
  since: number | null;
  /** Multicaixa Express: fim da validade do pedido de pagamento. */
  deadline?: number | null;
}

export type LostReason = 'cancelled' | 'expired' | 'failed';

export interface LostRow extends OpsRow {
  reason: LostReason;
}

export interface OpsData {
  /** Multicaixa Express por pagar, a expirar primeiro. */
  expressPending: OpsRow[];
  /** IBAN por pagar, ainda sem comprovativo. */
  ibanWithoutProof: OpsRow[];
  /** IBAN por pagar com comprovativo enviado: a equipa tem de verificar a transferência. */
  ibanToVerify: OpsRow[];
  /** Pagamentos pendentes com métodos antigos (referência, pagar na loja). */
  otherPending: OpsRow[];
  paidToPrepare: OpsRow[];
  /** Encomendas pendentes sem dados de pagamento (antigas). */
  pendingWithoutPayment: number;
  processing: OpsRow[];
  ready: OpsRow[];
  pickupsToday: OpsRow[];
  pickupsTomorrow: OpsRow[];
  deliveriesToDo: OpsRow[];
  lostLast24h: LostRow[];
}

const isOpen = (entry: PreparedOrder) =>
  entry.status !== ORDER_STATUS.CANCELLED && entry.status !== ORDER_STATUS.DELIVERED;

const bySince = (a: OpsRow, b: OpsRow) => (a.since ?? Infinity) - (b.since ?? Infinity);

export function buildOperations(orders: PreparedOrder[], now: number): OpsData {
  const today = dayKey(now);
  const tomorrow = addDays(today, 1);
  const data: OpsData = {
    expressPending: [],
    ibanWithoutProof: [],
    ibanToVerify: [],
    otherPending: [],
    paidToPrepare: [],
    pendingWithoutPayment: 0,
    processing: [],
    ready: [],
    pickupsToday: [],
    pickupsTomorrow: [],
    deliveriesToDo: [],
    lostLast24h: [],
  };

  orders.forEach((entry) => {
    const { order } = entry;
    const payment = order.payment;
    const created = { entry, since: entry.createdAt };

    if (isOpen(entry) && payment?.status === 'PENDING') {
      if (payment.method === 'MULTICAIXA_EXPRESS') {
        data.expressPending.push({ ...created, deadline: parseInstant(payment.expiresAt) });
      } else if (payment.method === 'IBAN') {
        if (payment.proofUploadedAt) data.ibanToVerify.push({ entry, since: parseInstant(payment.proofUploadedAt) });
        else data.ibanWithoutProof.push(created);
      } else {
        data.otherPending.push(created);
      }
    }

    if (entry.status === ORDER_STATUS.PENDING) {
      if (payment?.status === 'PAID') data.paidToPrepare.push({ entry, since: parseInstant(payment.paidAt) ?? entry.createdAt });
      if (!payment) data.pendingWithoutPayment += 1;
    }
    if (entry.status === ORDER_STATUS.PROCESSING) data.processing.push(created);
    if (entry.status === ORDER_STATUS.READY) data.ready.push(created);

    if (isOpen(entry)) {
      if (order.deliveryType === 'HOME_DELIVERY') {
        data.deliveriesToDo.push(created);
      } else if (order.pickupDate) {
        const pickupDay = order.pickupDate.slice(0, 10);
        if (pickupDay === today) data.pickupsToday.push(created);
        if (pickupDay === tomorrow) data.pickupsTomorrow.push(created);
      }
    }

    const reason: LostReason | null =
      payment?.status === 'EXPIRED' ? 'expired' : payment?.status === 'FAILED' ? 'failed' : isCancelled(entry) ? 'cancelled' : null;
    if (reason) {
      // A API não devolve a data do cancelamento: usa-se o fim do prazo do Express ou a data da encomenda.
      const since = (reason === 'expired' ? parseInstant(payment?.expiresAt) : null) ?? entry.createdAt;
      if (since !== null && since >= now - DAY_MS && since <= now) data.lostLast24h.push({ entry, since, reason });
    }
  });

  data.expressPending.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity) || bySince(a, b));
  data.ibanToVerify.sort(bySince);
  data.ibanWithoutProof.sort(bySince);
  data.otherPending.sort(bySince);
  data.paidToPrepare.sort(bySince);
  data.processing.sort(bySince);
  data.ready.sort(bySince);
  data.pickupsToday.sort(bySince);
  data.pickupsTomorrow.sort(bySince);
  data.deliveriesToDo.sort(
    (a, b) =>
      (a.entry.order.pickupDate ?? '9999').localeCompare(b.entry.order.pickupDate ?? '9999') || bySince(a, b),
  );
  data.lostLast24h.sort((a, b) => (b.since ?? 0) - (a.since ?? 0));

  return data;
}

export interface StockData {
  soldOut: Product[];
  low: Product[];
}

/** Limite do "stock baixo", igual ao filtro da página Produtos. */
export const LOW_STOCK_LIMIT = 5;

/** Produtos à venda com stock controlado (os livros não contam, como na página Produtos). */
export function buildStock(products: Product[]): StockData {
  const tracked = products.filter((product) => !product.isBook && product.stock !== null);
  return {
    soldOut: tracked
      .filter((product) => (product.stock ?? 0) <= 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    low: tracked
      .filter((product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= LOW_STOCK_LIMIT)
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0) || a.name.localeCompare(b.name, 'pt')),
  };
}
