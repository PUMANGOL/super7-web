import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error';

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/** Avisos do back-office e do login. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast tem de ser usado dentro de ToastProvider');
  return context;
}
