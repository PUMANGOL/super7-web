import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBackofficeTheme, updateBackofficeTheme } from '../../../api/backofficeTheme';
import { hasApiFeature } from '../../../config/store';
import type { BackofficeThemeColors } from '../../../types/api';
import { resolveTheme, themeToColors, themeVariables, type BackofficeTheme } from './theme';
import { BackofficeThemeContext, type BackofficeThemeContextValue } from './themeContext';

const BACKOFFICE_THEME_QUERY_KEY = ['backoffice-theme'];

/** Última resposta da API (para as cores aparecerem logo na visita seguinte) ou, sem a API, as cores deste browser. */
const STORAGE_KEY = 's7-backoffice-cores';

function readStored(): BackofficeThemeColors | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BackofficeThemeColors) : null;
  } catch {
    return null;
  }
}

function writeStored(colors: BackofficeThemeColors) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    /* Sem armazenamento (navegação privada): as cores valem só nesta visita. */
  }
}

/**
 * Cores do back-office. Com `backoffice-theme` em `api_features` vêm de GET /settings/theme e valem para toda a
 * equipa; sem ela, as que o ADMIN escolhe ficam guardadas só no browser dele. Aplica-as como variáveis CSS no
 * <body> (classe `bo-tema`), para chegarem também às janelas e listas abertas em portal.
 */
export function BackofficeThemeProvider({ children }: { children: ReactNode }) {
  const shared = hasApiFeature('backoffice-theme');
  const queryClient = useQueryClient();
  const [stored, setStored] = useState(readStored);
  const [preview, setPreview] = useState<BackofficeTheme | null>(null);

  const remote = useQuery({
    queryKey: BACKOFFICE_THEME_QUERY_KEY,
    queryFn: fetchBackofficeTheme,
    enabled: shared,
    staleTime: 5 * 60_000,
  });
  const { mutateAsync, isPending } = useMutation({
    mutationFn: updateBackofficeTheme,
    onSuccess: (saved) => queryClient.setQueryData(BACKOFFICE_THEME_QUERY_KEY, saved),
  });

  const colors = shared && remote.data ? remote.data : stored;
  const theme = useMemo(() => resolveTheme(colors), [colors]);

  useEffect(() => {
    if (shared && remote.data) writeStored(remote.data);
  }, [shared, remote.data]);

  const saveTheme = useCallback(
    async (next: BackofficeTheme) => {
      const chosen = themeToColors(next);
      if (shared) {
        await mutateAsync(chosen);
        return;
      }
      const local: BackofficeThemeColors = { ...chosen, updatedAt: new Date().toISOString(), updatedBy: null };
      writeStored(local);
      setStored(local);
    },
    [shared, mutateAsync],
  );

  const variables = useMemo(() => themeVariables(preview ?? theme), [preview, theme]);

  useLayoutEffect(() => {
    const body = document.body;
    body.classList.add('bo-tema');
    for (const [name, value] of Object.entries(variables)) body.style.setProperty(name, value);
    return () => {
      body.classList.remove('bo-tema');
      for (const name of Object.keys(variables)) body.style.removeProperty(name);
    };
  }, [variables]);

  const value = useMemo<BackofficeThemeContextValue>(
    () => ({
      theme,
      shared,
      updatedAt: colors?.updatedAt ?? null,
      updatedBy: colors?.updatedBy ?? null,
      setPreview,
      saveTheme,
      saving: isPending,
    }),
    [theme, shared, colors, saveTheme, isPending],
  );

  return <BackofficeThemeContext.Provider value={value}>{children}</BackofficeThemeContext.Provider>;
}
