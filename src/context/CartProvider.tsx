import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORE } from '../config/store';
import { CartContext, type CartLine } from './cart';

const STORAGE_KEY = 's7.carrinho';

function parseLines(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((line): line is CartLine => typeof line?.id === 'string' && Number.isFinite(line?.qty))
      .map((line) => ({ id: line.id, qty: Math.min(STORE.maxQuantity, Math.max(1, Math.floor(line.qty))) }));
  } catch {
    return [];
  }
}

function readStoredLines(): CartLine[] {
  try {
    return parseLines(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function clamp(qty: number, max: number = STORE.maxQuantity): number {
  return Math.min(Math.max(0, max), STORE.maxQuantity, Math.floor(qty));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStoredLines);

  // Guarda no browser a cada alteração.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Sem armazenamento disponível: o carrinho vive só nesta página.
    }
  }, [lines]);

  // Mantém o carrinho igual entre separadores abertos.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(parseLines(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((id: string, qty = 1, max?: number) => {
    setLines((current) => {
      const existing = current.find((line) => line.id === id);
      const next = clamp((existing?.qty ?? 0) + Math.max(1, qty), max);
      if (next <= 0) return current;
      if (existing) return current.map((line) => (line.id === id ? { ...line, qty: next } : line));
      return [...current, { id, qty: next }];
    });
  }, []);

  const setQuantity = useCallback((id: string, qty: number, max?: number) => {
    setLines((current) => {
      const next = clamp(qty, max);
      if (next <= 0) return current.filter((line) => line.id !== id);
      return current.map((line) => (line.id === id ? { ...line, qty: next } : line));
    });
  }, []);

  const remove = useCallback((id: string) => {
    setLines((current) => current.filter((line) => line.id !== id));
  }, []);

  const replace = useCallback((next: CartLine[]) => setLines(next), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({
      lines,
      units: lines.reduce((sum, line) => sum + line.qty, 0),
      add,
      setQuantity,
      remove,
      replace,
      clear,
    }),
    [lines, add, setQuantity, remove, replace, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
