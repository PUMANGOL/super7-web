type FbqFunction = (
  command: 'track' | 'trackCustom' | 'init',
  eventOrId: string,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    fbq?: FbqFunction;
  }
}

export function trackMetaEvent(
  event: string,
  params?: Record<string, unknown>,
): void {
  window.fbq?.('track', event, params);
}

export function trackMetaPageView(): void {
  trackMetaEvent('PageView');
}

export function trackMetaPurchase(params: {
  value: number;
  currency?: string;
  contentIds?: Array<string | number>;
  numItems?: number;
  orderId?: string | number;
}): void {
  trackMetaEvent('Purchase', {
    value: params.value,
    currency: params.currency ?? 'AOA',
    content_ids: params.contentIds,
    content_type: 'product',
    num_items: params.numItems,
    order_id: params.orderId,
  });
}
