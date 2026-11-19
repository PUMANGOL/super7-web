import { createContext, useContext } from 'react';
import { CHRISTMAS_THEME_DEFAULT } from '../../../config/store';

/** Tema de Natal da loja (adereços natalícios). Calculado em StoreLayout e lido pelos componentes. */
export const TemaNatalContext = createContext(false);

export function useTemaNatal(): boolean {
  return useContext(TemaNatalContext);
}

const PREVIEW_KEY = 's7-tema-preview';

/**
 * Pré-visualização a partir do back-office: `?tema=natal` ou `?tema=classico` fica para o resto da visita
 * neste separador; `?tema=auto` volta à definição da loja. Não grava nada na API.
 */
function previewChoice(search: string): boolean | null {
  try {
    const asked = new URLSearchParams(search).get('tema');
    if (asked === 'natal' || asked === 'classico') sessionStorage.setItem(PREVIEW_KEY, asked);
    else if (asked === 'auto') sessionStorage.removeItem(PREVIEW_KEY);
    const stored = sessionStorage.getItem(PREVIEW_KEY);
    return stored === 'natal' ? true : stored === 'classico' ? false : null;
  } catch {
    return null;
  }
}

/** Só durante a campanha de Natal: a pré-visualização, depois a definição da loja e, sem ela, o valor por omissão. */
export function resolveTemaNatal(natalActive: boolean, setting: boolean | null, search: string): boolean {
  if (!natalActive) return false;
  return previewChoice(search) ?? setting ?? CHRISTMAS_THEME_DEFAULT;
}
