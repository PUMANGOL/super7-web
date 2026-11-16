import { apiClient, unwrap } from './client';
import type { ApiOrder, ApiResponse, OrderRequest, Page } from '../types/api';

/** Checkout público: responde 201 com a encomenda em estado `Pendente`. */
export async function createOrder(payload: OrderRequest): Promise<ApiOrder> {
  const { data } = await apiClient.post<ApiResponse<ApiOrder>>('/order', payload);
  return unwrap(data);
}

/** Só para a equipa (ADMIN, MANAGER, SUPPORT, FINANCE, AUDITOR). */
export async function fetchOrder(id: string): Promise<ApiOrder> {
  const { data } = await apiClient.get<ApiResponse<ApiOrder>>(`/order/${id}`);
  return unwrap(data);
}

/**
 * Proposto: estado da encomenda para o cliente, sem sessão e com dados limitados
 * (sem telefone nem e-mail completos). Só é chamado com `api_features=order-tracking`.
 */
export async function fetchOrderTracking(id: string): Promise<ApiOrder> {
  const { data } = await apiClient.get<ApiResponse<ApiOrder>>(`/order/${id}/tracking`);
  return unwrap(data);
}

/** Todas as encomendas, em qualquer estado, das mais recentes para as mais antigas. */
export async function fetchAllOrders(): Promise<ApiOrder[]> {
  const all: ApiOrder[] = [];
  let page = 0;
  let last = false;

  while (!last) {
    const { data } = await apiClient.get<ApiResponse<Page<ApiOrder>>>('/order', {
      params: { page, size: 100, sort: 'createAt,desc' },
    });
    const pageData = unwrap(data);
    all.push(...pageData.content);
    last = pageData.last || pageData.content.length === 0;
    page += 1;
  }

  return all;
}

/** Muda o estado e envia um email ao cliente. */
export async function updateOrderStatus(id: string, statusId: number): Promise<ApiOrder> {
  const { data } = await apiClient.put<ApiResponse<ApiOrder>>(`/order/${id}/status`, null, {
    params: { statusId },
  });
  return unwrap(data);
}

export function getOrderTotal(order: Pick<ApiOrder, 'items' | 'total'>): number {
  if (order.total != null) return Number(order.total);
  return order.items.reduce((sum, item) => sum + (item.subTotal ?? item.price * item.quantity), 0);
}

/** Primeiros 8 caracteres do UUID, em maiúsculas: forma curta para listas. */
export function shortOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function getOrderUnits(order: Pick<ApiOrder, 'items'>): number {
  return order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
}
