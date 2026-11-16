import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContainer } from '../components/ui/ToastContainer';
import { ToastContext, type ToastType } from './toast';
import './ToastContext.css';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sequence = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      sequence.current += 1;
      const id = sequence.current;
      setToasts((current) => [...current, { id, message, type }]);
      window.setTimeout(() => dismissToast(id), 3500);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
