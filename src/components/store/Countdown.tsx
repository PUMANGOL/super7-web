import { useEffect, useState } from 'react';
import { formatDate } from '../../utils/format';
import { Icon } from './Icon';

interface CountdownProps {
  /** Prazo em ISO 8601 com fuso, por exemplo "2026-12-23T18:00:00+01:00". */
  until: string;
  label: string;
}

type Digito = number | '–';

/** Número que rola quando muda: o valor antigo sai por cima e o novo entra por baixo (super7-hero.css). */
function Rolo({ value }: { value: Digito }) {
  const [estado, setEstado] = useState<{ value: Digito; anterior: Digito | null }>({ value, anterior: null });
  if (estado.value !== value) setEstado({ value, anterior: estado.value });
  // O primeiro valor real (depois do "–") aparece sem rolar.
  const rola = estado.anterior !== null && estado.anterior !== '–';

  return (
    <b>
      {rola && (
        <span key={`sai-${estado.anterior}`} className="s7-contagem__sai" aria-hidden="true">
          {estado.anterior}
        </span>
      )}
      <span key={`entra-${estado.value}`} className={rola ? 's7-contagem__entra' : undefined}>
        {estado.value}
      </span>
    </b>
  );
}

/** Contagem decrescente do hero (dias, horas, minutos e segundos). Desaparece quando o prazo passa. */
export function Countdown({ until, label }: CountdownProps) {
  const deadline = new Date(until).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  const remaining = now === null ? null : deadline - now;
  if (Number.isNaN(deadline) || (remaining !== null && remaining <= 0)) return null;

  const seconds = remaining === null ? null : Math.floor(remaining / 1000);
  const blocks: { value: Digito; unit: string }[] = [
    { value: seconds === null ? '–' : Math.floor(seconds / 86_400), unit: 'dias' },
    { value: seconds === null ? '–' : Math.floor((seconds % 86_400) / 3600), unit: 'horas' },
    { value: seconds === null ? '–' : Math.floor((seconds % 3600) / 60), unit: 'min' },
    { value: seconds === null ? '–' : seconds % 60, unit: 'seg' },
  ];

  return (
    <div className="s7-contagem">
      <p className="s7-contagem__titulo">
        <Icon name="relogio" />
        <span>
          {label} <strong>{formatDate(until)}</strong>
        </span>
      </p>
      <div className="s7-contagem__blocos" role="timer" aria-live="off">
        {blocks.map((block) => (
          <p className="s7-contagem__bloco" key={block.unit}>
            <Rolo value={block.value} />
            <span>{block.unit}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
