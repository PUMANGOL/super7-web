import { useEffect, useState } from 'react';

/**
 * Hora do servidor. Os prazos (como os 5 minutos do Multicaixa Express) vêm da API em hora absoluta; com o relógio do
 * dispositivo adiantado ou atrasado, a contagem ficava errada (num PC 40 s atrasado, começava em 2:40 e o ponteiro
 * ficava parado). A diferença mede-se uma vez por carregamento, pelo cabeçalho Date do próprio site (mesma origem, por
 * isso legível sem CORS). Os servidores do site e da API acertam a hora pela rede.
 */
let offsetMs = 0;
let sync: Promise<void> | null = null;

/** Diferenças até 2 s ficam por corrigir: o cabeçalho Date só tem segundos. */
const MIN_CORRECTION_MS = 2000;
/** Com a resposta tão lenta, a medição não é fiável. */
const MAX_ROUND_TRIP_MS = 4000;

/** Agora, na hora do servidor (ms desde 1970). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** Mede a diferença para a hora do servidor (só uma vez; os pedidos seguintes esperam pela mesma medição). */
export function syncServerClock(): Promise<void> {
  if (!sync) {
    sync = (async () => {
      try {
        const sent = Date.now();
        const response = await fetch(import.meta.env.BASE_URL || '/', { method: 'HEAD', cache: 'no-store' });
        const received = Date.now();
        const header = Date.parse(response.headers.get('date') ?? '');
        if (Number.isNaN(header) || received - sent > MAX_ROUND_TRIP_MS) return;
        // O servidor escreveu o cabeçalho a meio do pedido, algures dentro desse segundo.
        const measured = header + 500 - (sent + received) / 2;
        if (Math.abs(measured) >= MIN_CORRECTION_MS) offsetMs = Math.round(measured);
      } catch {
        // Sem rede: fica a hora do dispositivo.
      }
    })();
  }
  return sync;
}

/** Hora do servidor, actualizada a cada `intervalMs` (desligado com `enabled` a false). */
export function useServerNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    void syncServerClock().then(() => {
      if (active) setNow(serverNow());
    });
    const timer = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [intervalMs, enabled]);

  return now;
}
