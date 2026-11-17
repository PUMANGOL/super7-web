const oneDecimal = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });

/** 1234 → "1234", 12500 → "12 500". */
export function formatCount(value: number): string {
  return integer.format(value);
}

/** Eixos e rótulos curtos: 5000 → "5000", 250 000 → "250 mil", 1 250 000 → "1,3 M". */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${oneDecimal.format(value / 1e9)} mil M`;
  if (abs >= 1e6) return `${oneDecimal.format(value / 1e6)} M`;
  if (abs >= 1e4) return `${oneDecimal.format(value / 1e3)} mil`;
  return integer.format(value);
}

/** 0,625 → "62,5%". */
export function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  return `${oneDecimal.format(ratio * 100)}%`;
}

/** Diferença entre duas taxas, em pontos percentuais: "+3,2 p.p.". */
export function formatPoints(diff: number): string {
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  return `${sign}${oneDecimal.format(Math.abs(diff * 100))} p.p.`;
}

/** Variação relativa: "+12%", "−4,5%". */
export function formatChange(ratio: number): string {
  const sign = ratio > 0 ? '+' : ratio < 0 ? '−' : '';
  return `${sign}${oneDecimal.format(Math.abs(ratio * 100))}%`;
}

/** 1 → "1 encomenda", 3 → "3 encomendas". */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}

export type DeltaTone = 'good' | 'bad' | 'neutral';

export interface KpiDelta {
  text: string;
  direction: 'up' | 'down' | 'flat';
  tone: DeltaTone;
}

function toneOf(direction: KpiDelta['direction'], upIsGood: boolean): DeltaTone {
  if (direction === 'flat') return 'neutral';
  return (direction === 'up') === upIsGood ? 'good' : 'bad';
}

/** Variação relativa de um valor (receita, encomendas, ticket médio). */
export function changeDelta(current: number | null, previous: number | null, upIsGood = true): KpiDelta | null {
  if (current === null || previous === null) return null;
  if (previous === 0) {
    if (current === 0) return { text: 'sem alteração', direction: 'flat', tone: 'neutral' };
    return { text: 'sem base anterior', direction: 'up', tone: 'neutral' };
  }
  const ratio = (current - previous) / previous;
  const direction = Math.abs(ratio) < 0.0005 ? 'flat' : ratio > 0 ? 'up' : 'down';
  return { text: direction === 'flat' ? 'sem alteração' : formatChange(ratio), direction, tone: toneOf(direction, upIsGood) };
}

/** Diferença entre duas taxas, em pontos percentuais. */
export function pointsDelta(current: number | null, previous: number | null, upIsGood = true): KpiDelta | null {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  const direction = Math.abs(diff) < 0.0005 ? 'flat' : diff > 0 ? 'up' : 'down';
  return { text: direction === 'flat' ? 'sem alteração' : formatPoints(diff), direction, tone: toneOf(direction, upIsGood) };
}
