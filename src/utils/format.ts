/** Espaço que não parte (U+00A0): junta o valor e o "Kz" na mesma linha. */
export const NBSP = String.fromCharCode(160);

/** 16000 → "16.000 Kz" (formato do layout Super7). */
export function formatKz(value: number | string | null | undefined): string {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? '−' : '';
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${digits}${NBSP}Kz`;
}

/** Datas sem hora ("2026-12-05") são lidas ao meio-dia para não mudarem de dia com o fuso. */
function toDate(iso: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
}

/** "23 de Dezembro"; aceita outras opções de `Intl.DateTimeFormat`. */
export function formatDate(
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
): string {
  const date = toDate(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat('pt-PT', options)
    .format(date)
    .replace(/ de ([a-zç])/g, (_match, letter: string) => ` de ${letter.toUpperCase()}`);
}

/** 1 → "1 artigo", 3 → "3 artigos". */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Contagem decrescente em minutos e segundos: 95 → "1:35". */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** "923000000" → "923 000 000". */
export function formatPhone(value: string): string {
  return String(value ?? '')
    .replace(/\D/g, '')
    .replace(/(\d{3})(?=\d)/g, '$1 ');
}

/** Data local no formato AAAA-MM-DD (para `<input type="date">`). */
export function toLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const NAME_PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

function nameWords(name: string): string[] {
  return name.trim().split(/\s+/).filter((word) => word && !NAME_PARTICLES.has(word.toLowerCase()));
}

/** "Joao Paulo dos Santos Zinga" → "Joao". */
export function firstName(name: string | null | undefined): string {
  return nameWords(name ?? '')[0] ?? '';
}

/** "Joao Paulo dos Santos Zinga" → "JP" (as duas primeiras palavras, como no People Connect). */
export function initials(name: string | null | undefined): string {
  return nameWords(name ?? '')
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
