import { useEffect, useMemo } from 'react';
import { isInStock, maxOrderQuantity } from '../catalog/query';
import type { Product } from '../catalog/types';
import { useCatalog } from '../catalog/useCatalog';
import { useCart, type CartLine } from '../context/cart';
import { useNotice } from '../context/notice';
import { plural } from '../utils/format';

export interface CartDetailLine {
  product: Product;
  qty: number;
  subtotal: number;
}

export interface CartDetail {
  lines: CartDetailLine[];
  units: number;
  subtotal: number;
  /** Quanto o cliente poupa nos produtos com preço de escoamento. */
  savings: number;
}

/** Linhas do carrinho com os dados do catálogo. Os preços finais são sempre calculados pela API. */
export function useCartDetail() {
  const { lines } = useCart();
  const catalog = useCatalog();

  const detail = useMemo<CartDetail>(() => {
    const result: CartDetail = { lines: [], units: 0, subtotal: 0, savings: 0 };
    const byId = catalog.data?.byId;
    if (!byId) return result;

    lines.forEach((line) => {
      const product = byId.get(line.id);
      if (!product || !isInStock(product)) return;

      const qty = Math.min(line.qty, maxOrderQuantity(product));
      const subtotal = product.price * qty;
      result.lines.push({ product, qty, subtotal });
      result.units += qty;
      result.subtotal += subtotal;
      if (product.previousPrice) result.savings += (product.previousPrice - product.price) * qty;
    });

    return result;
  }, [lines, catalog.data]);

  return {
    detail,
    isLoading: catalog.isLoading,
    isError: catalog.isError,
    refetch: catalog.refetch,
  };
}

/**
 * Acerta o carrinho ao catálogo carregado: retira produtos que deixaram de existir
 * ou esgotaram e reduz quantidades acima do stock. Usado uma vez, no layout da loja.
 */
export function useCartSync() {
  const { lines, replace } = useCart();
  const { notify } = useNotice();
  const { data: catalog } = useCatalog();

  useEffect(() => {
    if (!catalog || lines.length === 0) return;

    const removed: string[] = [];
    let changed = false;
    const next: CartLine[] = [];

    lines.forEach((line) => {
      const product = catalog.byId.get(line.id);
      if (!product || !isInStock(product)) {
        removed.push(product?.name ?? '');
        changed = true;
        return;
      }
      const qty = Math.min(line.qty, maxOrderQuantity(product));
      if (qty !== line.qty) changed = true;
      next.push({ id: line.id, qty });
    });

    if (!changed) return;
    replace(next);

    if (removed.length > 0) {
      const names = removed.filter(Boolean);
      notify(
        names.length === removed.length && names.length <= 2
          ? `Retirámos do carrinho o que esgotou: ${names.join(' e ')}.`
          : `Retirámos do carrinho ${plural(removed.length, 'artigo que esgotou', 'artigos que esgotaram')}.`,
      );
    } else {
      notify('Ajustámos as quantidades do carrinho ao stock disponível.');
    }
  }, [catalog, lines, replace, notify]);
}
