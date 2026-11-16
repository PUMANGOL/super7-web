import type { DeliveryType, PaymentMethod } from '../config/store';
import type { ApiOrder, DeliveryAddress, OrderGift } from '../types/api';

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
