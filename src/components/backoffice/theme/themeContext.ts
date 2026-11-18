import { createContext, useContext } from 'react';
import type { BackofficeTheme } from './theme';

export interface BackofficeThemeContextValue {
  /** Cores gravadas: as que a equipa vê. */
  theme: BackofficeTheme;
  /** `true`: as cores vêm da API e valem para toda a equipa; `false`: ficam só neste browser. */
  shared: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  /** Pré-visualização na página Aparência (`null` volta às cores gravadas). */
  setPreview: (theme: BackofficeTheme | null) => void;
  saveTheme: (theme: BackofficeTheme) => Promise<void>;
  saving: boolean;
}

export const BackofficeThemeContext = createContext<BackofficeThemeContextValue | null>(null);

export function useBackofficeTheme(): BackofficeThemeContextValue {
  const value = useContext(BackofficeThemeContext);
  if (!value) throw new Error('useBackofficeTheme fora do BackofficeThemeProvider');
  return value;
}
