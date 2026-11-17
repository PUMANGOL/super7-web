/**
 * Indicadores da vista Executivo, calculados no browser a partir de todas as encomendas.
 * Regras:
 * - O período filtra pela data da encomenda (`createAt`, hora de Luanda).
 * - Venda confirmada = pagamento PAID e encomenda não cancelada. A receita soma o total
 *   dessas encomendas (inclui a taxa de entrega quando a API a devolve).
 * - `Activo` conta como `Pendente`, como na página Encomendas.
 */
import { getOrderTotal } from '../../../api/orders';
import type { PaymentMethod } from '../../../config/store';
import { ORDER_STATUS } from '../../../constants/orderStatus';
import type { ApiOrder, ApiOrderItem, PickupPost } from '../../../types/api';
import { addDays, DAY_MS, dayKey, dayStart, hourOf, longDay, parseInstant, shortDay, weekKey } from './time';

export interface PreparedOrder {
  order: ApiOrder;
  /** Instante da encomenda; null se a data não for válida. */
  createdAt: number | null;
  total: number;
  /** Estado com `Activo` convertido em `Pendente`. */
  status: string;
}

export function prepareOrders(orders: ApiOrder[]): PreparedOrder[] {
  return orders.map((order) => ({
    order,
    createdAt: parseInstant(order.createAt),
    total: getOrderTotal(order),
    status: order.status === ORDER_STATUS.ACTIVE ? ORDER_STATUS.PENDING : order.status,
  }));
}

export const isCancelled = (entry: PreparedOrder) => entry.status === ORDER_STATUS.CANCELLED;
export const isPaid = (entry: PreparedOrder) => entry.order.payment?.status === 'PAID';
export const isConfirmedSale = (entry: PreparedOrder) => isPaid(entry) && !isCancelled(entry);

/* ---------- Períodos ---------- */

export type PeriodId = 'hoje' | '7d' | '30d' | '90d' | 'tudo';

export const PERIOD_OPTIONS: { id: PeriodId; label: string; days: number | null }[] = [
  { id: 'hoje', label: 'Hoje', days: 1 },
  { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: '90d', label: '90 dias', days: 90 },
  { id: 'tudo', label: 'Tudo', days: null },
];

export function isPeriodId(value: string | null): value is PeriodId {
  return PERIOD_OPTIONS.some((option) => option.id === value);
}

export type Granularity = 'hour' | 'day' | 'week';

export interface TimeRange {
  start: number;
  end: number;
}

export interface PeriodRange extends TimeRange {
  /** Período anterior com a mesma duração e a mesma hora de corte; null em "Tudo". */
  previous: TimeRange | null;
  granularity: Granularity;
  /** "vs. ontem à mesma hora", "vs. os 7 dias anteriores". */
  comparisonLabel: string | null;
  /** "hoje", "nos últimos 7 dias", "desde 3 de Março de 2026". */
  description: string;
}

/** "Tudo" mostra dias até este número; acima disso, semanas. */
const MAX_DAILY_BUCKETS = 92;

export function periodRange(period: PeriodId, now: number, orders: PreparedOrder[]): PeriodRange {
  const today = dayKey(now);
  const option = PERIOD_OPTIONS.find((item) => item.id === period) ?? PERIOD_OPTIONS[1];

  if (option.days === null) {
    const first = orders.reduce<number | null>(
      (min, entry) => (entry.createdAt !== null && (min === null || entry.createdAt < min) ? entry.createdAt : min),
      null,
    );
    const startKey = first === null ? today : dayKey(first);
    const start = dayStart(startKey);
    const days = Math.round((dayStart(today) - start) / DAY_MS) + 1;
    return {
      start,
      end: now,
      previous: null,
      granularity: days > MAX_DAILY_BUCKETS ? 'week' : 'day',
      comparisonLabel: null,
      description: first === null ? 'desde sempre' : `desde ${longDay(startKey).replace(/^[^,]+, /, '')}`,
    };
  }

  const days = option.days;
  const start = dayStart(addDays(today, -(days - 1)));
  const shift = days * DAY_MS;
  return {
    start,
    end: now,
    previous: { start: start - shift, end: now - shift },
    granularity: days === 1 ? 'hour' : 'day',
    comparisonLabel: days === 1 ? 'vs. ontem à mesma hora' : `vs. os ${days} dias anteriores`,
    description: days === 1 ? 'hoje' : `nos últimos ${days} dias`,
  };
}

export function inRange(orders: PreparedOrder[], range: TimeRange | null): PreparedOrder[] {
  if (!range) return [];
  return orders.filter((entry) => entry.createdAt !== null && entry.createdAt >= range.start && entry.createdAt <= range.end);
}

/* ---------- Indicadores ---------- */

export interface Summary {
  orders: number;
  /** Vendas confirmadas (pagas e não canceladas). */
  sales: number;
  revenue: number;
  avgTicket: number | null;
  paid: number;
  /** Pagamentos num estado final: pago, falhou ou expirou. */
  settled: number;
  paymentRate: number | null;
  cancelled: number;
  cancelRate: number | null;
  /** Encomendas sem dados de pagamento (antigas). */
  withoutPayment: number;
}

export function summarise(orders: PreparedOrder[]): Summary {
  let sales = 0;
  let revenue = 0;
  let paid = 0;
  let settled = 0;
  let cancelled = 0;
  let withoutPayment = 0;

  orders.forEach((entry) => {
    const payment = entry.order.payment;
    if (!payment) withoutPayment += 1;
    if (payment?.status === 'PAID') paid += 1;
    if (payment && payment.status !== 'PENDING') settled += 1;
    if (isCancelled(entry)) cancelled += 1;
    if (isConfirmedSale(entry)) {
      sales += 1;
      revenue += entry.total;
    }
  });

  return {
    orders: orders.length,
    sales,
    revenue,
    avgTicket: sales > 0 ? revenue / sales : null,
    paid,
    settled,
    paymentRate: settled > 0 ? paid / settled : null,
    cancelled,
    cancelRate: orders.length > 0 ? cancelled / orders.length : null,
    withoutPayment,
  };
}

/* ---------- Série temporal ---------- */

export interface Bucket {
  key: string;
  /** Rótulo curto do eixo: "17 Nov", "14h". */
  label: string;
  /** Rótulo do tooltip e da tabela. */
  longLabel: string;
  orders: number;
  sales: number;
  revenue: number;
}

export function buildBuckets(range: PeriodRange, orders: PreparedOrder[], now: number): Bucket[] {
  const buckets: Bucket[] = [];
  const index = new Map<string, number>();
  const push = (key: string, label: string, longLabel: string) => {
    index.set(key, buckets.length);
    buckets.push({ key, label, longLabel, orders: 0, sales: 0, revenue: 0 });
  };

  let keyOf: (time: number) => string;

  if (range.granularity === 'hour') {
    const today = dayKey(now);
    const lastHour = hourOf(now);
    for (let hour = 0; hour <= lastHour; hour += 1) {
      const hh = String(hour).padStart(2, '0');
      push(`${today}T${hh}`, `${hour}h`, `Hoje, ${hh}:00–${hh}:59`);
    }
    keyOf = (time) => `${dayKey(time)}T${String(hourOf(time)).padStart(2, '0')}`;
  } else if (range.granularity === 'day') {
    const last = dayKey(now);
    for (let key = dayKey(range.start); key <= last; key = addDays(key, 1)) {
      push(key, shortDay(key), longDay(key));
    }
    keyOf = dayKey;
  } else {
    const last = weekKey(dayKey(now));
    for (let key = weekKey(dayKey(range.start)); key <= last; key = addDays(key, 7)) {
      push(key, shortDay(key), `Semana de ${longDay(key).replace(/^[^,]+, /, '')}`);
    }
    keyOf = (time) => weekKey(dayKey(time));
  }

  orders.forEach((entry) => {
    if (entry.createdAt === null) return;
    const position = index.get(keyOf(entry.createdAt));
    if (position === undefined) return;
    const bucket = buckets[position];
    bucket.orders += 1;
    if (isConfirmedSale(entry)) {
      bucket.sales += 1;
      bucket.revenue += entry.total;
    }
  });

  return buckets;
}

/** Duração de um intervalo da série, para o título ("por hora", "por dia", "por semana"). */
export const GRANULARITY_LABEL: Record<Granularity, string> = {
  hour: 'por hora',
  day: 'por dia',
  week: 'por semana',
};

/* ---------- Repartições ---------- */

/** Cor da parte: as duas primeiras cores categóricas ou o cinzento de "Outros". */
export type SplitColour = 'series-1' | 'series-2' | 'other';

export interface SplitPart {
  id: string;
  label: string;
  colour: SplitColour;
  orders: number;
  share: number;
  sales: number;
  revenue: number;
  paymentRate: number | null;
}

function buildSplit(
  orders: PreparedOrder[],
  groups: { id: string; label: string; colour: SplitColour; hideWhenEmpty?: boolean }[],
  groupOf: (entry: PreparedOrder) => string,
): SplitPart[] {
  const totals = new Map(groups.map((group) => [group.id, { orders: 0, sales: 0, revenue: 0, paid: 0, settled: 0 }]));

  orders.forEach((entry) => {
    const total = totals.get(groupOf(entry));
    if (!total) return;
    total.orders += 1;
    const status = entry.order.payment?.status;
    if (status === 'PAID') total.paid += 1;
    if (status && status !== 'PENDING') total.settled += 1;
    if (isConfirmedSale(entry)) {
      total.sales += 1;
      total.revenue += entry.total;
    }
  });

  return groups
    .filter((group) => !(group.hideWhenEmpty && !totals.get(group.id)?.orders))
    .map((group) => {
      const total = totals.get(group.id) ?? { orders: 0, sales: 0, revenue: 0, paid: 0, settled: 0 };
      return {
        id: group.id,
        label: group.label,
        colour: group.colour,
        orders: total.orders,
        share: orders.length > 0 ? total.orders / orders.length : 0,
        sales: total.sales,
        revenue: total.revenue,
        paymentRate: total.settled > 0 ? total.paid / total.settled : null,
      };
    });
}

const STORE_METHODS: PaymentMethod[] = ['MULTICAIXA_EXPRESS', 'IBAN'];

export function paymentMethodSplit(orders: PreparedOrder[]): SplitPart[] {
  return buildSplit(
    orders,
    [
      { id: 'MULTICAIXA_EXPRESS', label: 'Multicaixa Express', colour: 'series-1' },
      { id: 'IBAN', label: 'Transferência (IBAN)', colour: 'series-2' },
      { id: 'OTHER', label: 'Outros ou sem dados', colour: 'other', hideWhenEmpty: true },
    ],
    (entry) => {
      const method = entry.order.payment?.method;
      return method && STORE_METHODS.includes(method) ? method : 'OTHER';
    },
  );
}

/** Encomendas sem `deliveryType` são levantamentos (o checkout antigo só tinha levantamento). */
export function deliverySplit(orders: PreparedOrder[]): SplitPart[] {
  return buildSplit(
    orders,
    [
      { id: 'PICKUP', label: 'Levantamento na loja', colour: 'series-1' },
      { id: 'HOME_DELIVERY', label: 'Entrega ao domicílio', colour: 'series-2' },
    ],
    (entry) => (entry.order.deliveryType === 'HOME_DELIVERY' ? 'HOME_DELIVERY' : 'PICKUP'),
  );
}

/* ---------- Rankings ---------- */

export interface StoreRow {
  id: string;
  label: string;
  orders: number;
  sales: number;
  revenue: number;
}

/** Receita confirmada por loja; as lojas sem vendas no período também aparecem. */
export function storeRanking(orders: PreparedOrder[], posts: PickupPost[]): StoreRow[] {
  const rows = new Map<string, StoreRow>();
  posts.forEach((post) => rows.set(post.id, { id: post.id, label: post.name, orders: 0, sales: 0, revenue: 0 }));

  orders.forEach((entry) => {
    const { pickupPostId, pickupPost } = entry.order;
    const id = pickupPostId || `nome:${pickupPost}`;
    const row = rows.get(id) ?? { id, label: pickupPost || 'Loja sem nome', orders: 0, sales: 0, revenue: 0 };
    row.orders += 1;
    if (isConfirmedSale(entry)) {
      row.sales += 1;
      row.revenue += entry.total;
    }
    rows.set(id, row);
  });

  return [...rows.values()].sort(
    (a, b) => b.revenue - a.revenue || b.orders - a.orders || a.label.localeCompare(b.label, 'pt'),
  );
}

export interface ProductInfo {
  name: string;
  categoryName: string;
}

export interface ItemRow {
  id: string;
  label: string;
  revenue: number;
  units: number;
  orders: number;
}

export const NO_CATEGORY = 'Sem categoria';

function itemAmount(item: ApiOrderItem): number {
  const subTotal = Number(item.subTotal);
  if (Number.isFinite(subTotal) && item.subTotal != null) return subTotal;
  return (Number(item.price) || 0) * (Number(item.quantity) || 0);
}

function itemProductId(item: ApiOrderItem): string | null {
  return item.productId ?? item.bookId ?? null;
}

/** Soma dos artigos das vendas confirmadas, agrupada por `keyOf`. */
function aggregateItems(
  orders: PreparedOrder[],
  keyOf: (item: ApiOrderItem) => { id: string; label: string },
): ItemRow[] {
  const rows = new Map<string, ItemRow>();
  const lastOrder = new Map<string, string>();

  orders.filter(isConfirmedSale).forEach((entry) => {
    entry.order.items.forEach((item) => {
      const { id, label } = keyOf(item);
      const row = rows.get(id) ?? { id, label, revenue: 0, units: 0, orders: 0 };
      row.revenue += itemAmount(item);
      row.units += Number(item.quantity) || 0;
      if (lastOrder.get(id) !== entry.order.id) {
        row.orders += 1;
        lastOrder.set(id, entry.order.id);
      }
      rows.set(id, row);
    });
  });

  return [...rows.values()];
}

export function categoryRanking(orders: PreparedOrder[], products: Map<string, ProductInfo>): ItemRow[] {
  return aggregateItems(orders, (item) => {
    const productId = itemProductId(item);
    const name = (productId && products.get(productId)?.categoryName) || NO_CATEGORY;
    return { id: name, label: name };
  }).sort((a, b) => b.revenue - a.revenue || b.units - a.units || a.label.localeCompare(b.label, 'pt'));
}

export function productRanking(orders: PreparedOrder[], products: Map<string, ProductInfo>): ItemRow[] {
  return aggregateItems(orders, (item) => {
    const productId = itemProductId(item);
    const label = (productId && products.get(productId)?.name) || item.book || 'Produto';
    return { id: productId ?? `nome:${item.book}`, label };
  });
}

/* ---------- Funil ---------- */

export interface FunnelStage {
  id: string;
  label: string;
  count: number;
  /** Fracção das encomendas registadas. */
  share: number;
  /** Fracção da etapa anterior. */
  stepRate: number | null;
}

export interface FunnelData {
  stages: FunnelStage[];
  cancelled: number;
  expired: number;
  failed: number;
  total: number;
}

const STAGES = [
  { id: 'registadas', label: 'Registadas' },
  { id: 'pagas', label: 'Pagas' },
  { id: 'preparacao', label: 'Em preparação' },
  { id: 'prontas', label: 'Prontas' },
  { id: 'entregues', label: 'Entregues' },
];

/** Etapa mais avançada a que a encomenda chegou (0 = registada … 4 = entregue). */
function stageOf(entry: PreparedOrder): number {
  let stage = isPaid(entry) ? 1 : 0;
  if (entry.status === ORDER_STATUS.PROCESSING) stage = Math.max(stage, 2);
  if (entry.status === ORDER_STATUS.READY) stage = Math.max(stage, 3);
  if (entry.status === ORDER_STATUS.DELIVERED) stage = Math.max(stage, 4);
  return stage;
}

/** Funil acumulado: cada etapa conta as encomendas que já lá chegaram. */
export function buildFunnel(orders: PreparedOrder[]): FunnelData {
  const reached = STAGES.map(() => 0);
  let cancelled = 0;
  let expired = 0;
  let failed = 0;

  orders.forEach((entry) => {
    const stage = stageOf(entry);
    for (let index = 0; index <= stage; index += 1) reached[index] += 1;
    if (isCancelled(entry)) cancelled += 1;
    if (entry.order.payment?.status === 'EXPIRED') expired += 1;
    if (entry.order.payment?.status === 'FAILED') failed += 1;
  });

  const total = orders.length;
  return {
    stages: STAGES.map((stage, index) => ({
      ...stage,
      count: reached[index],
      share: total > 0 ? reached[index] / total : 0,
      stepRate: index === 0 ? null : reached[index - 1] > 0 ? reached[index] / reached[index - 1] : null,
    })),
    cancelled,
    expired,
    failed,
    total,
  };
}
