import { createContext, useContext } from 'react';

/** Linha do carrinho guardada no browser: só o ID do produto e a quantidade. */
export interface CartLine {
  id: string;
  qty: number;
}

export interface CartContextValue {
  lines: CartLine[];
  /** Total de unidades (para o contador do cabeçalho). */
  units: number;
  /** Soma `qty` à linha (cria-a se não existir), até `max`. */
  add: (id: string, qty?: number, max?: number) => void;
  /** Define a quantidade da linha; 0 ou menos remove-a. */
  setQuantity: (id: string, qty: number, max?: number) => void;
  remove: (id: string) => void;
  /** Substitui todas as linhas (usado para acertar o carrinho ao catálogo). */
  replace: (lines: CartLine[]) => void;
  clear: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart tem de ser usado dentro de CartProvider');
  return context;
}
