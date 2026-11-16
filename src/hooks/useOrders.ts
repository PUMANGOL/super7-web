import { useQuery } from '@tanstack/react-query';
import { fetchAllOrders } from '../api/orders';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: fetchAllOrders,
    staleTime: 30_000,
  });
}
