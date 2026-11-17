import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '../../api/client';
import { retryPayment } from '../../api/orders';
import { isValidMobile, normalisePhone } from '../../catalog/checkout';
import type { ApiOrder } from '../../types/api';
import { formatDate, plural } from '../../utils/format';

/** Validade de cada pedido Multicaixa Express na API (app.payment.express-validity-minutes). */
const EXPRESS_WINDOW_SECONDS = 120;
const DIAL_RADIUS = 52;
const DIAL_LENGTH = 2 * Math.PI * DIAL_RADIUS;

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Ponteiro dos 2 minutos para aceitar o pedido Multicaixa Express: o ponteiro avança a cada segundo e o arco mostra o
 * tempo que falta (fica vermelho nos últimos 30 segundos).
 */
export function ExpressCountdown({ secondsLeft, expiresAt }: { secondsLeft: number; expiresAt: string }) {
  const fraction = Math.min(1, Math.max(0, secondsLeft / EXPRESS_WINDOW_SECONDS));
  const elapsed = DIAL_LENGTH * (1 - fraction);
  const urgent = secondsLeft <= 30;

  return (
    <div className={urgent ? 's7-cronometro s7-cronometro--fim' : 's7-cronometro'}>
      <svg className="s7-cronometro__mostrador" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="s7-cronometro__fundo" cx="60" cy="60" r={DIAL_RADIUS} />
        {/* Começa às 12 horas; o que já passou fica de fora do arco. */}
        <circle
          className="s7-cronometro__arco"
          cx="60"
          cy="60"
          r={DIAL_RADIUS}
          transform="rotate(-90 60 60)"
          style={{ strokeDasharray: `${DIAL_LENGTH - elapsed} ${DIAL_LENGTH}`, strokeDashoffset: -elapsed }}
        />
        {Array.from({ length: 12 }, (_, index) => (
          <line
            key={index}
            className="s7-cronometro__marca"
            x1="60"
            y1="15"
            x2="60"
            y2={index % 3 === 0 ? 23 : 19}
            transform={`rotate(${index * 30} 60 60)`}
          />
        ))}
        <line
          className="s7-cronometro__ponteiro"
          x1="60"
          y1="60"
          x2="60"
          y2="21"
          style={{ transform: `rotate(${(1 - fraction) * 360}deg)` }}
        />
        <circle className="s7-cronometro__eixo" cx="60" cy="60" r="4.5" />
      </svg>
      <p
        className="s7-cronometro__texto"
        role="timer"
        aria-label={`Faltam ${plural(Math.floor(secondsLeft / 60), 'minuto', 'minutos')} e ${plural(secondsLeft % 60, 'segundo', 'segundos')} para aceitar o pagamento`}
      >
        <strong>{formatCountdown(secondsLeft)}</strong>
        <span>para aceitar no telemóvel</span>
        <small>até às {formatDate(expiresAt, { hour: '2-digit', minute: '2-digit' })}</small>
      </p>
    </div>
  );
}

interface ExpressRetryFormProps {
  orderId: string;
  initialPhone: string | null;
  submitLabel: string;
  /** Recebe também o telemóvel usado: o seguimento público não o devolve. */
  onDone: (order: ApiOrder, phone?: string) => void;
}

/** Novo pedido Multicaixa Express (para o mesmo ou outro telemóvel). */
export function ExpressRetryForm({ orderId, initialPhone, submitLabel, onDone }: ExpressRetryFormProps) {
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [error, setError] = useState<string | null>(null);
  const retry = useMutation({
    mutationFn: (value: string) => retryPayment(orderId, { method: 'MULTICAIXA_EXPRESS', phone: value }),
    onSuccess: (order, value) => onDone(order, value),
    onError: (failure) => setError(getApiErrorMessage(failure, 'Não foi possível pedir o pagamento. Tente novamente.')),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValidMobile(phone)) {
      setError('Indique um número de telemóvel com 9 dígitos, começado por 9.');
      return;
    }
    setError(null);
    retry.mutate(normalisePhone(phone));
  };

  return (
    <form className="s7-comprovativo" noValidate onSubmit={submit}>
      <div className={error ? 's7-campo s7-campo--erro' : 's7-campo'}>
        <label htmlFor="s7-express-telemovel">Telemóvel associado ao Multicaixa Express</label>
        <input
          id="s7-express-telemovel"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9XX XXX XXX"
          value={phone}
          aria-invalid={error ? true : undefined}
          aria-describedby="s7-express-telemovel-ajuda s7-express-telemovel-erro"
          onChange={(event) => {
            setPhone(event.target.value);
            if (error) setError(null);
          }}
        />
        <p className="s7-campo__ajuda" id="s7-express-telemovel-ajuda">
          Recebe neste número um novo pedido de pagamento e tem 2 minutos para o aceitar.
        </p>
        <p className="s7-campo__erro" id="s7-express-telemovel-erro" role="alert">
          {error}
        </p>
      </div>
      <button className="s7-btn s7-btn--primario" type="submit" disabled={retry.isPending}>
        {retry.isPending ? 'A pedir o pagamento…' : submitLabel}
      </button>
    </form>
  );
}

/** Mudança para transferência bancária: a página passa a mostrar o IBAN e o envio do comprovativo. */
export function IbanSwitchButton({ orderId, onDone }: { orderId: string; onDone: (order: ApiOrder) => void }) {
  const [error, setError] = useState<string | null>(null);
  const retry = useMutation({
    mutationFn: () => retryPayment(orderId, { method: 'IBAN' }),
    onSuccess: onDone,
    onError: (failure) => setError(getApiErrorMessage(failure, 'Não foi possível mudar o pagamento. Tente novamente.')),
  });

  return (
    <div className="s7-comprovativo">
      <button
        className="s7-btn s7-btn--contorno"
        type="button"
        disabled={retry.isPending}
        onClick={() => {
          setError(null);
          retry.mutate();
        }}
      >
        {retry.isPending ? 'A mudar o pagamento…' : 'Pagar por transferência bancária'}
      </button>
      {error && (
        <p className="s7-campo__erro s7-campo__erro--visivel" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
