import type { ReactNode } from 'react';
import { STATUS_TONE, type Tone } from './orderInfo';

/** Etiqueta com o tom de um alerta (cores do tema: concluído, atenção, crítico) ou neutro. */
export function ToneBadge({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`bo-etiqueta bo-etiqueta--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <ToneBadge tone={STATUS_TONE[status] ?? 'neutro'}>{status}</ToneBadge>;
}
