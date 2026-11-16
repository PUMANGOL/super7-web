import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrderStatus } from '../api/orders';
import type { ApiOrder } from '../types/api';

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order, statusId }: { order: ApiOrder; statusId: number }) => updateOrderStatus(order.id, statusId),
    onSuccess: (updated) => {
      queryClient.setQueryData<ApiOrder[]>(['orders'], (current = []) =>
        current.map((order) => (order.id === updated.id ? updated : order)),
      );
      queryClient.setQueryData(['order', updated.id], updated);
    },
  });
}
