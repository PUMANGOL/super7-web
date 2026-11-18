/* Cores do back-office. O ADMIN escolhe cinco cores (Aparência); os tons derivados (texto legível sobre cada
   fundo, realces, hover) são calculados aqui e aplicados como variáveis CSS no <body>, para chegarem também às
   janelas e listas abertas em portal. */

export type ThemeKey = 'primary' | 'accent' | 'sidebar' | 'hero' | 'background';
export type BackofficeTheme = Record<ThemeKey, string>;

/** Cores do layout de referência (People Connect). `null` na API = estas. */
export const DEFAULT_THEME: BackofficeTheme = {
  primary: '#1a5334',
  accent: '#3dd68c',
  sidebar: '#0f172a',
  hero: '#12343f',
  background: '#f5f7fa',
};

export const THEME_KEYS: ThemeKey[] = ['primary', 'accent', 'sidebar', 'hero', 'background'];

export const THEME_FIELDS: Record<ThemeKey, { label: string; help: string }> = {
  primary: { label: 'Cor principal', help: 'Barra do topo, opção activa do menu, botões e ligações.' },
  accent: { label: 'Cor de destaque', help: 'Linha por baixo da barra do topo, data do painel e pequenos destaques.' },
  sidebar: { label: 'Menu lateral', help: 'Fundo do menu à esquerda. O texto passa a claro ou escuro conforme a cor.' },
  hero: { label: 'Faixa de boas-vindas', help: 'Faixa "Bom dia" no topo do Painel.' },
  background: { label: 'Fundo das páginas', help: 'Tem de ser claro: o texto das páginas é escuro.' },
};

export const THEME_PRESETS: { id: string; label: string; theme: BackofficeTheme }[] = [
  { id: 'original', label: 'Original', theme: DEFAULT_THEME },
  {
    id: 'super7',
    label: 'Super7',
    theme: { primary: '#017649', accent: '#de1827', sidebar: '#063323', hero: '#01502f', background: '#f5f6f2' },
  },
  {
    id: 'azul',
    label: 'Azul',
    theme: { primary: '#1e3a8a', accent: '#38bdf8', sidebar: '#0f172a', hero: '#1e3a5f', background: '#f5f7fb' },
  },
  {
    id: 'grafite',
    label: 'Grafite',
    theme: { primary: '#334155', accent: '#f59e0b', sidebar: '#111827', hero: '#1f2937', background: '#f6f7f9' },
  },
];

/** Mesmo limite da API (BackofficeThemeService.MIN_BACKGROUND_LUMINANCE). */
const MIN_BACKGROUND_LUMINANCE = 0.7;
/** Texto branco dos botões e ligações na cor principal sobre branco (WCAG AA, texto normal). */
const MIN_PRIMARY_CONTRAST = 4.5;

const LIGHT_TEXT = '#ffffff';
const DARK_TEXT = '#0b2a1c';

/** "#1A5334", "1a5334" ou "#1a5" → "#1a5334"; outra coisa → null. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  let hex = value.trim().toLowerCase();
  if (!hex.startsWith('#')) hex = `#${hex}`;
  if (/^#[0-9a-f]{3}$/.test(hex)) hex = `#${[...hex.slice(1)].map((c) => c + c).join('')}`;
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

/** Cores da API (ou guardadas no browser) → tema completo; o que faltar ou for inválido fica com a cor original. */
export function resolveTheme(colors: Partial<Record<ThemeKey, string | null>> | null | undefined): BackofficeTheme {
  const theme = { ...DEFAULT_THEME };
  if (!colors) return theme;
  for (const key of THEME_KEYS) {
    const value = normalizeHex(colors[key]);
    if (value) theme[key] = value;
  }
  return theme;
}

export function sameTheme(a: BackofficeTheme, b: BackofficeTheme): boolean {
  return THEME_KEYS.every((key) => a[key] === b[key]);
}

/** Para gravar: as cores iguais às originais seguem como `null` (a equipa acompanha o layout se ele mudar). */
export function themeToColors(theme: BackofficeTheme): Record<ThemeKey, string | null> {
  const colors = {} as Record<ThemeKey, string | null>;
  for (const key of THEME_KEYS) colors[key] = theme[key] === DEFAULT_THEME[key] ? null : theme[key];
  return colors;
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [number, number, number];
}

/** Mistura `amount` (0–1) de `other` em `base`. */
export function mix(base: string, other: string, amount: number): string {
  const a = channels(base);
  const b = channels(other);
  return `#${a
    .map((value, i) => Math.round(value + (b[i] - value) * amount))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Luminância relativa (WCAG 2), de 0 (preto) a 1 (branco). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Branco ou tinta escura, o que se ler melhor sobre `background`. */
export function readableOn(background: string): string {
  return contrast(background, LIGHT_TEXT) >= contrast(background, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}

/** O que impede gravar: o fundo escuro esconde o texto, uma cor principal clara esconde o texto dos botões. */
export function themeProblems(theme: BackofficeTheme): string[] {
  const problems: string[] = [];
  if (contrast(theme.primary, LIGHT_TEXT) < MIN_PRIMARY_CONTRAST) {
    problems.push('A cor principal é demasiado clara: o texto branco dos botões e da barra do topo não se lê. Escolha um tom mais escuro.');
  }
  if (luminance(theme.background) < MIN_BACKGROUND_LUMINANCE) {
    problems.push('O fundo das páginas tem de ser claro: o texto das páginas é escuro.');
  }
  return problems;
}

/** Variáveis CSS do tema (aplicadas no <body> enquanto o back-office está aberto). */
export function themeVariables(theme: BackofficeTheme): Record<string, string> {
  const { primary, accent, sidebar, hero, background } = theme;
  const onPrimary = readableOn(primary);
  const onHero = readableOn(hero);
  const darkSidebar = readableOn(sidebar) === LIGHT_TEXT;
  const lightHero = onHero === LIGHT_TEXT;

  // Texto verde dos subtítulos (no original #1f7444): a principal com um pouco do destaque, se se ler sobre branco.
  const primaryText = mix(primary, accent, 0.25);

  return {
    '--bo-primary': primary,
    '--bo-primary-deep': mix(primary, '#000000', 0.2),
    '--bo-primary-soft': mix(primary, '#ffffff', 0.9),
    '--bo-primary-ring': `${primary}33`,
    '--bo-primary-text': contrast(primaryText, LIGHT_TEXT) >= MIN_PRIMARY_CONTRAST ? primaryText : primary,
    '--bo-avatar': mix(accent, '#ffffff', 0.72),
    '--bo-on-primary': onPrimary,
    '--bo-on-primary-muted': onPrimary === LIGHT_TEXT ? 'rgba(255, 255, 255, 0.78)' : 'rgba(11, 42, 28, 0.72)',
    '--bo-on-primary-line': onPrimary === LIGHT_TEXT ? 'rgba(255, 255, 255, 0.32)' : 'rgba(11, 42, 28, 0.25)',

    '--bo-accent': accent,
    '--bo-on-accent': readableOn(accent),

    '--bo-sidebar': sidebar,
    '--bo-sidebar-label': darkSidebar ? '#94a3b8' : '#64748b',
    '--bo-sidebar-text': darkSidebar ? '#cbd5e1' : '#334155',
    '--bo-sidebar-icon': darkSidebar ? '#a5afbc' : '#64748b',
    '--bo-sidebar-strong': darkSidebar ? '#ffffff' : '#0f172a',
    '--bo-sidebar-hover': darkSidebar ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.06)',
    '--bo-sidebar-line': darkSidebar ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.1)',

    '--bo-hero': hero,
    '--bo-on-hero': onHero,
    '--bo-on-hero-soft': lightHero ? '#d0d6d9' : '#24414d',
    '--bo-on-hero-muted': lightHero ? '#b8c1c6' : '#3d5560',
    '--bo-hero-accent': contrast(accent, hero) >= 3 ? accent : onHero,
    '--bo-hero-ring': mix(hero, accent, 0.08),
    '--bo-hero-emblem': mix(accent, hero, 0.25),
    '--bo-hero-blob': mix(hero, primary, 0.5),

    '--bo-bg': background,
  };
}
