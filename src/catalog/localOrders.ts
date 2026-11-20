import type { DeliveryType, PaymentMethod } from '../config/store';
import type { ApiOrder, DeliveryAddress, OrderGift, OrderPayment } from '../types/api';

/**
 * Encomendas feitas neste browser. `GET /order/{id}` é só para a equipa, por isso a
 * página de confirmação usa a resposta do checkout guardada aqui, junto com o que o
 * cliente escolheu e a API ainda não devolve (entrega, pagamento, oferta).
 */
const STORAGE_KEY = 's7.encomendas';
const MAX_ORDERS = 20;

export interface LocalOrderExtras {
  deliveryType?: DeliveryType;
  /** Data prevista de levantamento (AAAA-MM-DD). */
  pickupDate?: string;
  deliveryAddress?: DeliveryAddress;
  /** Taxa de entrega mostrada no checkout. */
  deliveryFee?: number;
  paymentMethod?: PaymentMethod;
  paymentPhone?: string;
  nif?: string;
  via?: string;
  gift?: OrderGift;
}

export interface LocalOrder {
  order: ApiOrder;
  extras: LocalOrderExtras;
  savedAt: string;
}

function readAll(): LocalOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalOrder[]) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.order?.id) : [];
  } catch {
    return [];
  }
}

export function saveLocalOrder(order: ApiOrder, extras: LocalOrderExtras): void {
  const entry: LocalOrder = { order, extras, savedAt: new Date().toISOString() };
  const others = readAll().filter((existing) => existing.order.id !== order.id);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...others].slice(0, MAX_ORDERS)));
  } catch {
    // Sem armazenamento (modo privado): a confirmação continua a chegar por email.
  }
}

/**
 * Junta à cópia local o pagamento devolvido pela API (ex.: depois de enviar o comprovativo do IBAN), para a página
 * da encomenda o mostrar mesmo sem o seguimento público. Devolve a cópia actualizada, ou null se não existir.
 */
export function updateLocalOrderPayment(
  id: string,
  payment: OrderPayment,
  extras: Partial<LocalOrderExtras> = {},
): LocalOrder | null {
  const target = id.trim().toLowerCase();
  const all = readAll();
  const index = all.findIndex((entry) => entry.order.id.toLowerCase() === target);
  if (index < 0) return null;
  const saved = all[index];
  const updated: LocalOrder = {
    ...saved,
    order: { ...saved.order, payment: { ...saved.order.payment, ...payment } },
    extras: { ...saved.extras, ...extras },
  };
  all[index] = updated;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Sem armazenamento: a página mostra o comprovativo até ser recarregada.
  }
  return updated;
}

export function getLocalOrder(id: string): LocalOrder | null {
  const target = id.trim().toLowerCase();
  return readAll().find((entry) => entry.order.id.toLowerCase() === target) ?? null;
}

export function listLocalOrders(): LocalOrder[] {
  return readAll();
}

/** Aceita o número com ou sem "#" e devolve o UUID em minúsculas, ou null se não for válido. */
export function normaliseOrderId(value: string): string | null {
  const id = value.trim().replace(/^#/, '').toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : null;
}
