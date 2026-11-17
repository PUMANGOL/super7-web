import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePaymentStatus } from '../api/orders';
import type { PaymentStatus } from '../config/store';
import type { ApiOrder } from '../types/api';

/** Confirmar (`PAID`) ou recusar (`FAILED`, cancela a encomenda) um pagamento no back-office. */
export function useUpdatePaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order, status }: { order: ApiOrder; status: PaymentStatus }) => updatePaymentStatus(order.id, status),
    onSuccess: (updated) => {
      queryClient.setQueryData<ApiOrder[]>(['orders'], (current = []) =>
        current.map((order) => (order.id === updated.id ? updated : order)),
      );
      queryClient.setQueryData(['order', updated.id], updated);
    },
  });
}
