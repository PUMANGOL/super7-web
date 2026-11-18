import type { ReactNode } from 'react';
import { ShoppingBasket } from 'lucide-react';
import { useAuth } from '../../context/auth';
import { roleLabel } from '../../utils/auth';
import { firstName } from '../../utils/format';

/** Angola está sempre em UTC+1, sem hora de Verão (como no painel, dashboard/time.ts). */
const LUANDA_OFFSET_MS = 60 * 60 * 1000;
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function greeting(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 19) return 'Boa tarde';
  return 'Boa noite';
}

interface BackofficeWelcomeProps {
  /** Hora de referência (do servidor, `useNow`), para a data e o cumprimento. */
  now: number;
  phrase?: ReactNode;
  /** Última linha: hora da actualização, botões. */
  note?: ReactNode;
  /** Pré-visualização (Aparência): sem o emblema e com o título em parágrafo, fora da hierarquia da página. */
  compact?: boolean;
}

/** Faixa "Bom dia, <nome>" do Painel, com a data em destaque, como no topo do People Connect. */
export function BackofficeWelcome({ now, phrase, note, compact = false }: BackofficeWelcomeProps) {
  const { user } = useAuth();
  const luanda = new Date(now + LUANDA_OFFSET_MS);
  const name = firstName(user?.name);
  const hello = greeting(luanda.getUTCHours());
  const Title = compact ? 'p' : 'h1';

  return (
    <section className={`bo-boas-vindas${compact ? ' bo-boas-vindas--compacta' : ''}`} aria-label="Boas-vindas">
      <div className="bo-boas-vindas__data" aria-hidden="true">
        <span className="bo-boas-vindas__dia-semana">{WEEKDAYS[luanda.getUTCDay()]}</span>
        <span className="bo-boas-vindas__dia">{luanda.getUTCDate()}</span>
        <span className="bo-boas-vindas__mes">{MONTHS[luanda.getUTCMonth()]}</span>
      </div>

      {!compact && (
        <div className="bo-boas-vindas__emblema" aria-hidden="true">
          <svg width="118" height="118" viewBox="0 0 120 120" fill="none">
            <circle
              cx="60"
              cy="60"
              r="55"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="0.1 7"
            />
            <circle cx="60" cy="60" r="45" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
            <circle cx="60" cy="60" r="35" fill="currentColor" opacity="0.1" />
            <circle cx="60" cy="15" r="4" fill="currentColor" />
            <circle cx="99" cy="82.5" r="4" fill="currentColor" />
            <circle cx="21" cy="82.5" r="4" fill="currentColor" />
            <ShoppingBasket x={38} y={37} width={44} height={44} strokeWidth={1.75} />
          </svg>
        </div>
      )}

      <div className="bo-boas-vindas__texto">
        <p className="bo-boas-vindas__marca">Super7 Digital · Back-office</p>
        <Title className="bo-boas-vindas__titulo">{name ? `${hello}, ${name}` : hello}</Title>
        {user && (
          <p className="bo-boas-vindas__perfil">
            {roleLabel(user)} · {user.email}
          </p>
        )}
        {phrase && <p className="bo-boas-vindas__frase">{phrase}</p>}
        {note && <div className="bo-boas-vindas__nota">{note}</div>}
      </div>
    </section>
  );
}
