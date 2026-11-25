import { useSyncExternalStore } from 'react';

/** `lateral`: menu à esquerda, com os grupos recolhíveis (por omissão). `horizontal`: barra por baixo do topo. */
export type MenuLayout = 'lateral' | 'horizontal';

export interface MenuPreferences {
  layout: MenuLayout;
  /** Menu lateral reduzido aos ícones, para dar mais largura ao conteúdo. */
  compact: boolean;
  /**
   * Grupos abertos (`true`) ou fechados (`false`) à mão. Um grupo sem escolha fica fechado, excepto o da página
   * actual: assim o menu ocupa pouco mesmo com muitas páginas.
   */
  groups: Record<string, boolean>;
}

const STORAGE_KEY = 's7-backoffice-menu';
const DEFAULTS: MenuPreferences = {
  layout: 'lateral',
  compact: false,
  groups: {},
};

function read(): MenuPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Partial<MenuPreferences>;
    const groups =
      saved.groups && typeof saved.groups === 'object'
        ? Object.fromEntries(
            Object.entries(saved.groups).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
          )
        : {};
    return {
      layout: saved.layout === 'horizontal' ? 'horizontal' : 'lateral',
      compact: saved.compact === true,
      groups,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: MenuPreferences = read();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Outro separador mudou o menu: este acompanha.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    current = read();
    emit();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Grava neste browser: cada pessoa da equipa escolhe o seu menu. */
export function updateMenuPreferences(change: Partial<MenuPreferences>) {
  current = { ...current, ...change };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* Sem armazenamento (navegação privada): a escolha vale só nesta visita. */
  }
  emit();
}

export function setMenuGroupOpen(groupId: string, open: boolean) {
  updateMenuPreferences({ groups: { ...current.groups, [groupId]: open } });
}

export function useMenuPreferences(): MenuPreferences {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULTS,
  );
}
