/**
 * Datas e horas do painel no fuso da loja (Africa/Luanda).
 * Angola está sempre em UTC+1, sem hora de Verão, por isso o desvio é fixo.
 */
const LUANDA_OFFSET_MS = 60 * 60 * 1000;

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const NAIVE_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Instante (ms) de uma data da API. As datas sem fuso (`createAt` vem como LocalDateTime)
 * são lidas como hora de Luanda, como o resto do back-office faz nos computadores da loja.
 */
export function parseInstant(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = value.trim();
  if (DATE_ONLY.test(text)) return Date.parse(`${text}T00:00:00+01:00`);

  const naive = NAIVE_DATE_TIME.exec(text);
  if (naive) {
    const [, date, time, fraction = ''] = naive;
    const seconds = time.length === 5 ? `${time}:00` : time;
    const millis = fraction ? fraction.slice(0, 4).padEnd(4, '0') : '';
    return Date.parse(`${date}T${seconds}${millis}+01:00`);
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

/** "2026-11-17": o dia em Luanda de um instante. */
export function dayKey(time: number): string {
  return new Date(time + LUANDA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Meia-noite de Luanda do dia `key`. */
export function dayStart(key: string): number {
  return Date.parse(`${key}T00:00:00+01:00`);
}

export function addDays(key: string, days: number): string {
  return dayKey(dayStart(key) + days * DAY_MS + HOUR_MS);
}

/** Hora do dia em Luanda (0–23). */
export function hourOf(time: number): number {
  return new Date(time + LUANDA_OFFSET_MS).getUTCHours();
}

/** "14:05" em Luanda. */
export function clockTime(time: number): string {
  return new Date(time + LUANDA_OFFSET_MS).toISOString().slice(11, 16);
}

/** Segunda-feira da semana do dia `key`. */
export function weekKey(key: string): string {
  const weekday = keyParts(key).weekday;
  return addDays(key, -((weekday + 6) % 7));
}

function keyParts(key: string): { year: number; month: number; day: number; weekday: number } {
  const date = new Date(`${key}T12:00:00Z`);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate(), weekday: date.getUTCDay() };
}

/** "17 Nov" */
export function shortDay(key: string): string {
  const { month, day } = keyParts(key);
  return `${day} ${MONTHS_SHORT[month]}`;
}

/** "terça-feira, 17 de Novembro de 2026" */
export function longDay(key: string): string {
  const { year, month, day, weekday } = keyParts(key);
  return `${WEEKDAYS[weekday]}, ${day} de ${MONTHS_LONG[month]} de ${year}`;
}

/** "17 de Novembro" */
export function dayMonth(key: string): string {
  const { month, day } = keyParts(key);
  return `${day} de ${MONTHS_LONG[month]}`;
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias". */
export function timeAgo(time: number | null, now: number): string {
  if (time === null) return '';
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE_MS) return 'agora';
  if (elapsed < HOUR_MS) return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  const days = Math.floor(elapsed / DAY_MS);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

/** Tempo até `time`: "1:23" (minutos:segundos) ou, acima de uma hora, "2 h 05 min". */
export function timeLeft(time: number, now: number): string {
  const remaining = Math.max(0, time - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
