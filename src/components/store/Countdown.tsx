import { useEffect, useState } from 'react';
import { formatDate } from '../../utils/format';
import { Icon } from './Icon';

interface CountdownProps {
  /** Prazo em ISO 8601 com fuso, por exemplo "2026-12-23T18:00:00+01:00". */
  until: string;
  label: string;
}

/** Contagem decrescente do hero (dias, horas, minutos). Desaparece quando o prazo passa. */
export function Countdown({ until, label }: CountdownProps) {
  const deadline = new Date(until).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  const remaining = now === null ? null : deadline - now;
  if (Number.isNaN(deadline) || (remaining !== null && remaining <= 0)) return null;

  const minutes = remaining === null ? null : Math.floor(remaining / 60_000);
  const blocks = [
    { value: minutes === null ? '–' : Math.floor(minutes / 1440), unit: 'dias' },
    { value: minutes === null ? '–' : Math.floor((minutes % 1440) / 60), unit: 'horas' },
    { value: minutes === null ? '–' : minutes % 60, unit: 'min' },
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
            <b>{block.value}</b>
            <span>{block.unit}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
