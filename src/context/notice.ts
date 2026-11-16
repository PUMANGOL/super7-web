import { createContext, useContext } from 'react';

export interface NoticeAction {
  label: string;
  to: string;
}

export interface NoticeContextValue {
  /** Mostra um aviso no fundo do ecrã da loja (substitui o anterior). */
  notify: (message: string, action?: NoticeAction) => void;
}

export const NoticeContext = createContext<NoticeContextValue | null>(null);

export function useNotice(): NoticeContextValue {
  const context = useContext(NoticeContext);
  if (!context) throw new Error('useNotice tem de ser usado dentro de NoticeProvider');
  return context;
}
