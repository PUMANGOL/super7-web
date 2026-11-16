import * as XLSX from 'xlsx';
import { toOrderView } from '../catalog/orderView';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../config/store';
import type { ApiOrder } from '../types/api';

/** Formato do back-office: "16 000 Kz". A loja usa `formatKz` (src/utils/format.ts). */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency',
    currency: 'AOA',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat('pt-AO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function exportOrdersToXlsx(orders: ApiOrder[]): void {
  const headers = [
    'N.º', 'Cliente', 'Telefone', 'E-mail', 'Localização', 'NIF', 'Loja', 'Entrega', 'Morada', 'Data de levantamento',
    'Pagamento', 'Estado do pagamento', 'Taxa de entrega (Kz)', 'Total (Kz)', 'Estado', 'Data', 'Artigos', 'Oferta', 'Observações',
  ];
  // Entrega, pagamento e oferta só ficam preenchidos quando a API os devolver (ver docs/api-campos-em-falta.md).
  const rows = orders.map((order) => {
    const view = toOrderView(order, null);
    const address = view.deliveryAddress
      ? [view.deliveryAddress.address, view.deliveryAddress.district, view.deliveryAddress.reference].filter(Boolean).join(', ')
      : '';
    return [
      order.id,
      order.customer.fullName,
      order.customer.phone,
      order.customer.email,
      order.customer.location,
      view.customer.nif ?? '',
      order.pickupPost,
      order.deliveryType ? (order.deliveryType === 'HOME_DELIVERY' ? 'Domicílio' : 'Levantamento') : '',
      address,
      view.pickupDate ?? '',
      order.payment ? PAYMENT_METHOD_LABELS[order.payment.method] : '',
      order.payment ? PAYMENT_STATUS_LABELS[order.payment.status] : '',
      view.deliveryFee,
      view.total,
      order.status,
      order.createAt,
      order.items.map((item) => `${item.book} (x${Number(item.quantity)})`).join('; '),
      view.gift ? `${view.gift.recipient}${view.gift.message ? `: ${view.gift.message}` : ''}` : '',
      order.notes ?? '',
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Encomendas');
  XLSX.writeFile(workbook, `encomendas-super7-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
