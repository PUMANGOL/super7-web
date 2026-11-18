/* Cores do back-office. O ADMIN escolhe nove cores (Aparência): estrutura, gráficos e alertas. Os tons derivados
   (texto legível sobre cada fundo, realces, escala ordinal do funil, texto dos alertas) são calculados aqui e
   aplicados como variáveis CSS no <body>, para chegarem também às janelas e listas abertas em portal.

   As regras das cores dos gráficos seguem o método da paleta de referência do painel: luminosidade OKLCH entre
   0,43 e 0,77, croma de pelo menos 0,10, as duas séries distinguíveis com visão normal (ΔE ≥ 15) e com daltonismo
   (protanopia/deuteranopia, Machado 2009: ΔE ≥ 8, mínimo 6), escala ordinal com o tom mais claro a 2:1 do fundo. */

export type ThemeKey = 'primary' | 'accent' | 'menu' | 'background' | 'chart1' | 'chart2' | 'success' | 'warning' | 'danger';
export type BackofficeTheme = Record<ThemeKey, string>;

/** Cores do layout de referência (People Connect) e paleta validada do painel. Chave em falta na API = esta. */
export const DEFAULT_THEME: BackofficeTheme = {
  primary: '#1a5334',
  accent: '#3dd68c',
  menu: '#0f172a',
  background: '#f5f7fa',
  chart1: '#2a78d6',
  chart2: '#eb6834',
  success: '#0ca30c',
  warning: '#fab219',
  danger: '#d03b3b',
};

export const THEME_KEYS = Object.keys(DEFAULT_THEME) as ThemeKey[];

export const THEME_GROUPS: { id: string; label: string; help: string; keys: ThemeKey[] }[] = [
  {
    id: 'estrutura',
    label: 'Barra e menu',
    help: 'A moldura do back-office.',
    keys: ['primary', 'accent', 'menu', 'background'],
  },
  {
    id: 'graficos',
    label: 'Gráficos',
    help: 'Tons médios e bem diferentes entre si, para se lerem sobre branco e por quem não distingue cores.',
    keys: ['chart1', 'chart2'],
  },
  {
    id: 'alertas',
    label: 'Alertas',
    help: 'Vão sempre com um ícone e um texto. O texto escrito nestas cores é escurecido para se ler.',
    keys: ['success', 'warning', 'danger'],
  },
];

export const THEME_FIELDS: Record<ThemeKey, { label: string; help: string }> = {
  primary: { label: 'Cor principal', help: 'Barra do topo, opção activa do menu, botões e ligações.' },
  accent: { label: 'Cor de destaque', help: 'Linha por baixo da barra do topo e pequenos destaques.' },
  menu: { label: 'Barra do menu', help: 'Fundo da barra com as páginas. O texto passa a claro ou escuro conforme a cor.' },
  background: { label: 'Fundo das páginas', help: 'Tem de ser claro: o texto das páginas é escuro.' },
  chart1: { label: 'Série principal', help: 'Receita, rankings e o funil (em tons mais claros e mais escuros).' },
  chart2: { label: 'Segunda série', help: 'A outra parte das repartições, como a transferência bancária.' },
  success: { label: 'Concluído', help: 'Pagamentos confirmados, variações boas, listas sem pendentes.' },
  warning: { label: 'Atenção', help: 'Comprovativos por verificar, prazos a terminar.' },
  danger: { label: 'Crítico', help: 'Pagamentos recusados, prazos terminados, erros e cancelamentos.' },
};

const CHARTS_AND_ALERTS = {
  chart1: DEFAULT_THEME.chart1,
  chart2: DEFAULT_THEME.chart2,
  success: DEFAULT_THEME.success,
  warning: DEFAULT_THEME.warning,
  danger: DEFAULT_THEME.danger,
};

export const THEME_PRESETS: { id: string; label: string; theme: BackofficeTheme }[] = [
  { id: 'original', label: 'Original', theme: DEFAULT_THEME },
  {
    id: 'super7',
    label: 'Super7',
    theme: { primary: '#017649', accent: '#de1827', menu: '#063323', background: '#f5f6f2', ...CHARTS_AND_ALERTS },
  },
  {
    id: 'azul',
    label: 'Azul',
    theme: { primary: '#1e3a8a', accent: '#38bdf8', menu: '#0f172a', background: '#f5f7fb', ...CHARTS_AND_ALERTS },
  },
  {
    id: 'grafite',
    label: 'Grafite',
    theme: { primary: '#334155', accent: '#f59e0b', menu: '#111827', background: '#f6f7f9', ...CHARTS_AND_ALERTS },
  },
];

/* Tons documentados da paleta de referência: com as cores originais, o painel fica exactamente como foi validado. */
const REFERENCE_ORDINAL = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
const REFERENCE_SERIES_1_STRONG = '#1c5cab';
const REFERENCE_SUCCESS_INK = '#006300';
const REFERENCE_WARNING_INK = '#b45309';
const REFERENCE_WARNING_SURFACE = '#fffbeb';
const REFERENCE_SERIOUS = '#ec835a';

/** Mesmo limite da API (BackofficeThemeService.MIN_BACKGROUND_LUMINANCE). */
const MIN_BACKGROUND_LUMINANCE = 0.7;
/** Texto branco dos botões e da barra do topo, e ligações na cor principal sobre branco (WCAG AA). */
const MIN_TEXT_CONTRAST = 4.5;
const CHART_BAND: [number, number] = [0.43, 0.77];
const CHROMA_FLOOR = 0.1;
const NORMAL_FLOOR = 15;
const CVD_TARGET = 8;
const CVD_FLOOR = 6;

const WHITE = '#ffffff';
const BLACK = '#000000';
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

/** Nomes antigos das chaves (cores guardadas no browser antes da barra horizontal). */
const LEGACY_KEYS: Record<string, ThemeKey> = { sidebar: 'menu' };

/** Cores da API (ou guardadas no browser) → tema completo; o que faltar ou for inválido fica com a cor original. */
export function resolveTheme(colors: Record<string, string | null | undefined> | null | undefined): BackofficeTheme {
  const theme = { ...DEFAULT_THEME };
  if (!colors) return theme;
  for (const [rawKey, rawValue] of Object.entries(colors)) {
    const key = (LEGACY_KEYS[rawKey] ?? rawKey) as ThemeKey;
    const value = normalizeHex(rawValue);
    if (value && key in DEFAULT_THEME) theme[key] = value;
  }
  return theme;
}

export function sameTheme(a: BackofficeTheme, b: BackofficeTheme): boolean {
  return THEME_KEYS.every((key) => a[key] === b[key]);
}

/** Para gravar: só as cores diferentes das originais (a equipa acompanha o layout se ele mudar). */
export function themeToColors(theme: BackofficeTheme): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const key of THEME_KEYS) if (theme[key] !== DEFAULT_THEME[key]) colors[key] = theme[key];
  return colors;
}

/* ---------- Contas de cor ---------- */

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [number, number, number];
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (hex: string) => channels(hex).map((value) => toLinear(value / 255)) as [number, number, number];

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
  const [r, g, b] = linear(hex);
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

/** A cor, escurecida o mínimo para chegar a `min` de contraste com `background` (texto sobre branco). */
function darkenTo(color: string, background: string, min: number): string {
  for (let amount = 0; amount <= 1; amount += 0.05) {
    const candidate = mix(color, BLACK, amount);
    if (contrast(candidate, background) >= min) return candidate;
  }
  return BLACK;
}

function oklabFromLinear([r, g, b]: [number, number, number]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLCH: luminosidade (0–1) e croma. */
export function oklch(hex: string): { l: number; c: number } {
  const [l, a, b] = oklabFromLinear(linear(hex));
  return { l, c: Math.hypot(a, b) };
}

/** Machado, Oliveira & Fernandes (2009), severidade 1, em RGB linear. */
const CVD: Record<'protan' | 'deutan', number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

function simulated(hex: string, kind: 'protan' | 'deutan'): [number, number, number] {
  const rgb = linear(hex);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return CVD[kind].map((row) => clamp(row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])) as [number, number, number];
}

/** Distância OKLab ×100; com `kind`, como a vê quem tem protanopia ou deuteranopia. */
export function deltaE(a: string, b: string, kind?: 'protan' | 'deutan'): number {
  const x = oklabFromLinear(kind ? simulated(a, kind) : linear(a));
  const y = oklabFromLinear(kind ? simulated(b, kind) : linear(b));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/* ---------- Validação ---------- */

export interface ThemeCheck {
  /** Impedem gravar. */
  errors: string[];
  /** Avisos: grava-se, mas convém rever. */
  warnings: string[];
}

const quoted = (key: ThemeKey) => `«${THEME_FIELDS[key].label}»`;

export function checkTheme(theme: BackofficeTheme): ThemeCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (contrast(theme.primary, LIGHT_TEXT) < MIN_TEXT_CONTRAST) {
    errors.push('A cor principal é demasiado clara: o texto branco dos botões e da barra do topo não se lê. Escolha um tom mais escuro.');
  }
  if (luminance(theme.background) < MIN_BACKGROUND_LUMINANCE) {
    errors.push('O fundo das páginas tem de ser claro: o texto das páginas é escuro.');
  }

  for (const key of ['chart1', 'chart2'] as const) {
    const { l, c } = oklch(theme[key]);
    if (l < CHART_BAND[0]) errors.push(`${quoted(key)} é escura demais para um gráfico: escolha um tom médio.`);
    else if (l > CHART_BAND[1]) errors.push(`${quoted(key)} é clara demais: as barras deixam de se ver sobre o branco.`);
    if (c < CHROMA_FLOOR) errors.push(`${quoted(key)} é quase cinzenta: escolha uma cor mais viva.`);
  }
  const cvd = Math.min(deltaE(theme.chart1, theme.chart2, 'protan'), deltaE(theme.chart1, theme.chart2, 'deutan'));
  if (deltaE(theme.chart1, theme.chart2) < NORMAL_FLOOR) {
    errors.push('As duas cores dos gráficos são parecidas demais: escolha cores de famílias diferentes (ex.: azul e laranja).');
  } else if (cvd < CVD_FLOOR) {
    errors.push('As duas cores dos gráficos confundem-se para quem não distingue o vermelho do verde. Evite o par vermelho e verde.');
  } else if (cvd < CVD_TARGET) {
    warnings.push('As duas cores dos gráficos distinguem-se mal para quem não distingue o vermelho do verde. Os gráficos têm legendas, mas um par como azul e laranja é mais seguro.');
  }

  const alerts = ['success', 'warning', 'danger'] as const;
  for (const key of alerts) {
    if (oklch(theme[key]).c < CHROMA_FLOOR) errors.push(`${quoted(key)} é quase cinzenta: um alerta precisa de uma cor viva.`);
  }
  for (let i = 0; i < alerts.length; i++) {
    for (let j = i + 1; j < alerts.length; j++) {
      if (deltaE(theme[alerts[i]], theme[alerts[j]]) < NORMAL_FLOOR) {
        errors.push(`${quoted(alerts[i])} e ${quoted(alerts[j])} são parecidas demais: os alertas têm de se distinguir.`);
      }
    }
  }
  return { errors, warnings };
}

/* ---------- Variáveis CSS ---------- */

/** Escala ordinal do funil a partir da série principal: dois tons mais claros, a cor, dois mais escuros. */
function ordinalRamp(color: string): string[] {
  if (color === DEFAULT_THEME.chart1) return REFERENCE_ORDINAL;
  // O tom mais claro ainda a 2:1 do branco (o funil desenha-se num cartão branco).
  let lightest = 0.45;
  while (lightest > 0 && contrast(mix(color, WHITE, lightest), WHITE) < 2) lightest -= 0.05;
  return [
    mix(color, WHITE, lightest),
    mix(color, WHITE, lightest / 2),
    color,
    mix(color, BLACK, 0.25),
    mix(color, BLACK, 0.45),
  ];
}

function statusVariables(name: 'success' | 'warning' | 'danger', color: string, ink: string): Record<string, string> {
  return {
    [`--bo-${name}`]: color,
    [`--bo-${name}-ink`]: ink,
    [`--bo-${name}-soft`]: mix(color, WHITE, 0.9),
    [`--bo-on-${name}`]: readableOn(color),
  };
}

/** Variáveis CSS do tema (aplicadas no <body> enquanto o back-office está aberto). */
export function themeVariables(theme: BackofficeTheme): Record<string, string> {
  const { primary, accent, menu, background, chart1, chart2, success, warning, danger } = theme;
  const onPrimary = readableOn(primary);
  const darkMenu = readableOn(menu) === LIGHT_TEXT;
  // Texto verde dos subtítulos (no original #1f7444): a principal com um pouco do destaque, se se ler sobre branco.
  const primaryText = mix(primary, accent, 0.25);
  const ordinal = ordinalRamp(chart1);
  const defaultAlerts = success === DEFAULT_THEME.success && warning === DEFAULT_THEME.warning && danger === DEFAULT_THEME.danger;

  return {
    '--bo-primary': primary,
    '--bo-primary-deep': mix(primary, BLACK, 0.2),
    '--bo-primary-soft': mix(primary, WHITE, 0.9),
    '--bo-primary-ring': `${primary}33`,
    '--bo-primary-text': contrast(primaryText, WHITE) >= MIN_TEXT_CONTRAST ? primaryText : primary,
    '--bo-on-primary': onPrimary,
    '--bo-on-primary-muted': onPrimary === LIGHT_TEXT ? 'rgba(255, 255, 255, 0.78)' : 'rgba(11, 42, 28, 0.72)',
    '--bo-on-primary-line': onPrimary === LIGHT_TEXT ? 'rgba(255, 255, 255, 0.32)' : 'rgba(11, 42, 28, 0.25)',
    '--bo-avatar': mix(accent, WHITE, 0.72),

    '--bo-accent': accent,
    '--bo-on-accent': readableOn(accent),

    '--bo-menu': menu,
    '--bo-menu-label': darkMenu ? '#94a3b8' : '#64748b',
    '--bo-menu-text': darkMenu ? '#cbd5e1' : '#334155',
    '--bo-menu-icon': darkMenu ? '#a5afbc' : '#64748b',
    '--bo-menu-strong': darkMenu ? '#ffffff' : '#0f172a',
    '--bo-menu-hover': darkMenu ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)',
    '--bo-menu-line': darkMenu ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)',

    '--bo-bg': background,

    '--bo-chart-1': chart1,
    '--bo-chart-1-strong': chart1 === DEFAULT_THEME.chart1 ? REFERENCE_SERIES_1_STRONG : mix(chart1, BLACK, 0.25),
    '--bo-chart-2': chart2,
    ...Object.fromEntries(ordinal.map((value, i) => [`--bo-chart-ord-${i + 1}`, value])),

    ...statusVariables('success', success, success === DEFAULT_THEME.success ? REFERENCE_SUCCESS_INK : darkenTo(success, WHITE, MIN_TEXT_CONTRAST)),
    ...statusVariables('warning', warning, warning === DEFAULT_THEME.warning ? REFERENCE_WARNING_INK : darkenTo(warning, WHITE, MIN_TEXT_CONTRAST)),
    ...statusVariables('danger', danger, darkenTo(danger, WHITE, MIN_TEXT_CONTRAST)),
    '--bo-warning-soft': warning === DEFAULT_THEME.warning ? REFERENCE_WARNING_SURFACE : mix(warning, WHITE, 0.9),
    '--bo-serious': defaultAlerts ? REFERENCE_SERIOUS : mix(warning, danger, 0.5),
  };
}
