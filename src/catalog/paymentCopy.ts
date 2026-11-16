import type { PaymentMethod } from '../config/store';

const LONG: Record<PaymentMethod, string> = {
  MULTICAIXA_EXPRESS: 'Multicaixa Express',
  REFERENCE: 'pagamento por referência',
  IN_STORE: 'na loja, no acto do levantamento',
};

const SHORT: Record<PaymentMethod, string> = {
  MULTICAIXA_EXPRESS: 'Express',
  REFERENCE: 'referência',
  IN_STORE: 'na loja',
};

function joinWithOr(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ou ${parts[parts.length - 1]}`;
}

export function hasOnlinePayment(methods: PaymentMethod[]): boolean {
  return methods.some((method) => method !== 'IN_STORE');
}

/** "Multicaixa Express, pagamento por referência ou na loja, no acto do levantamento". */
export function paymentMethodsSentence(methods: PaymentMethod[]): string {
  return joinWithOr(methods.map((method) => LONG[method]));
}

/** "Express, referência ou na loja" (para o selo "Pagamento Multicaixa" da página inicial). */
export function paymentMethodsShort(methods: PaymentMethod[]): string {
  return joinWithOr(methods.map((method) => SHORT[method]));
}
