import { useCallback } from 'react';
import { isInStock, maxOrderQuantity } from '../catalog/query';
import type { Product } from '../catalog/types';
import { useCart } from '../context/cart';
import { useNotice } from '../context/notice';

const VIEW_CART = { label: 'Ver carrinho', to: '/carrinho' };

/** Junta um produto ao carrinho, respeitando o stock, e mostra o aviso. Devolve `false` se não juntou. */
export function useAddToCart() {
  const { lines, add } = useCart();
  const { notify } = useNotice();

  return useCallback(
    (product: Product, qty = 1, { silent = false }: { silent?: boolean } = {}) => {
      if (!isInStock(product)) {
        notify(`${product.name} está esgotado.`);
        return false;
      }

      const max = maxOrderQuantity(product);
      const inCart = lines.find((line) => line.id === product.id)?.qty ?? 0;

      if (inCart >= max) {
        notify(`Já tem no carrinho todas as unidades disponíveis de ${product.name}.`, VIEW_CART);
        return false;
      }

      add(product.id, qty, max);
      if (!silent) notify(`${product.name} adicionado ao carrinho`, VIEW_CART);
      return true;
    },
    [lines, add, notify],
  );
}
