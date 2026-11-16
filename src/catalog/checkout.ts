import { CHECKOUT_LIMITS, PAYMENT_METHOD_LABELS, type DeliveryType, type PaymentMethod } from '../config/store';
import type { DeliveryAddress, OrderGift } from '../types/api';
import { NBSP, formatDate, formatKz, formatPhone, toLocalIsoDate } from '../utils/format';

/**
 * Cópia de segurança nas observações (`notes`, até 500 caracteres) dos dados que a API
 * ainda não guarda: entrega, pagamento, NIF e oferta. Os mesmos dados também seguem nos
 * campos próprios do pedido; com `api_features=order-fields` as notas levam só as observações.
 */
export interface OrderNoteParts {
  deliveryType: DeliveryType;
  pickupDate: string;
  deliveryAddress: DeliveryAddress | null;
  deliveryFee: number;
  paymentMethod: PaymentMethod;
  paymentPhone: string;
  nif: string;
  gift: OrderGift | null;
  observations: string;
  onlyObservations: boolean;
}

interface FreeText {
  message: string;
  observations: string;
  reference: string;
}

function composeNotes(parts: OrderNoteParts, text: FreeText): string {
  if (parts.onlyObservations) return text.observations.trim();

  const lines: string[] = [];
  if (parts.deliveryType === 'HOME_DELIVERY' && parts.deliveryAddress) {
    lines.push(`Entrega ao domicílio: ${parts.deliveryAddress.address.trim()}, ${parts.deliveryAddress.district.trim()}`);
    if (text.reference.trim()) lines.push(`Ponto de referência: ${text.reference.trim()}`);
    lines.push(`Taxa de entrega: ${formatKz(parts.deliveryFee).replaceAll(NBSP, ' ')}`);
  } else if (parts.pickupDate) {
    lines.push(
      `Levantamento previsto: ${formatDate(parts.pickupDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    );
  }

  const payment = PAYMENT_METHOD_LABELS[parts.paymentMethod];
  lines.push(
    parts.paymentMethod === 'MULTICAIXA_EXPRESS' && parts.paymentPhone
      ? `Pagamento: ${payment} (${formatPhone(parts.paymentPhone)})`
      : `Pagamento: ${payment}`,
  );
  if (parts.nif.trim()) lines.push(`NIF: ${parts.nif.trim()}`);
  if (parts.gift) {
    lines.push(`Oferta para: ${parts.gift.recipient.trim()}`);
    if (text.message.trim()) lines.push(`Mensagem do cartão: "${text.message.trim()}"`);
  }
  if (text.observations.trim()) lines.push(`Observações: ${text.observations.trim()}`);

  return lines.join('\n');
}

/** Monta as observações e, se passarem dos 500 caracteres, encurta o texto livre (mensagem, observações, referência). */
export function buildOrderNotes(parts: OrderNoteParts): string {
  const text: FreeText = {
    message: parts.gift?.message ?? '',
    observations: parts.observations,
    reference: parts.deliveryAddress?.reference ?? '',
  };
  let notes = composeNotes(parts, text);

  for (const key of ['message', 'observations', 'reference'] as const) {
    const overflow = notes.length - CHECKOUT_LIMITS.notes;
    if (overflow <= 0) break;
    const value = text[key];
    if (!value) continue;
    text[key] = value.length > overflow + 1 ? `${value.slice(0, value.length - overflow - 1).trimEnd()}…` : '';
    notes = composeNotes(parts, text);
  }

  return notes.slice(0, CHECKOUT_LIMITS.notes);
}

/** "+244 923 000 000" → "923000000". */
export function normalisePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('244') ? digits.slice(3) : digits;
}

export function isValidMobile(value: string): boolean {
  return /^9\d{8}$/.test(normalisePhone(value));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Amanhã, no formato AAAA-MM-DD (primeiro dia possível de levantamento). */
export function tomorrowIsoDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toLocalIsoDate(date);
}
