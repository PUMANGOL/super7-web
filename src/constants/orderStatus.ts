/**
 * Estados da encomenda. `Order.status` vem em texto; `PUT /order/{id}/status` recebe o código.
 * Fluxo: Pendente → Em Processamento → Pronto para Entrega → Entregue.
 * Qualquer estado antes de Entregue pode passar a Cancelado.
 */
export const ORDER_STATUS = {
  PENDING: 'Pendente',
  PROCESSING: 'Em Processamento',
  READY: 'Pronto para Entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  /** Posto por PUT /order/{id}; tratado como uma encomenda recebida. */
  ACTIVE: 'Activo',
} as const;

export const ORDER_STATUS_ID: Record<string, number> = {
  [ORDER_STATUS.PENDING]: 3,
  [ORDER_STATUS.PROCESSING]: 4,
  [ORDER_STATUS.READY]: 5,
  [ORDER_STATUS.DELIVERED]: 6,
  [ORDER_STATUS.CANCELLED]: 7,
};

/** Estados que a loja e o painel mostram, por ordem do fluxo. */
export const ORDER_STATUS_FLOW = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.READY,
  ORDER_STATUS.DELIVERED,
] as const;

export const orderStatusColors: Record<string, string> = {
  [ORDER_STATUS.PENDING]: 'badge-yellow',
  [ORDER_STATUS.ACTIVE]: 'badge-yellow',
  [ORDER_STATUS.PROCESSING]: 'badge-blue',
  [ORDER_STATUS.READY]: 'badge-teal',
  [ORDER_STATUS.DELIVERED]: 'badge-green',
  [ORDER_STATUS.CANCELLED]: 'badge-red',
};

/** Próximos estados possíveis a partir do estado actual (para o painel). */
export function nextOrderStatuses(status: string): { value: string; label: string }[] {
  const toOption = (label: string) => ({ value: String(ORDER_STATUS_ID[label]), label });

  switch (status) {
    case ORDER_STATUS.PENDING:
    case ORDER_STATUS.ACTIVE:
      return [toOption(ORDER_STATUS.PROCESSING), toOption(ORDER_STATUS.CANCELLED)];
    case ORDER_STATUS.PROCESSING:
      return [toOption(ORDER_STATUS.READY), toOption(ORDER_STATUS.CANCELLED)];
    case ORDER_STATUS.READY:
      return [toOption(ORDER_STATUS.DELIVERED), toOption(ORDER_STATUS.CANCELLED)];
    default:
      return [];
  }
}
