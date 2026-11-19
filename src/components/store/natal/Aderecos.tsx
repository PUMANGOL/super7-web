/*
 * Adereços do tema de Natal (super7-natal.css). Todos decorativos: aria-hidden, sem foco e sem cliques.
 * Desenhos simples em SVG, nas cores da marca (vermelho, verde, dourado e branco).
 */
import type { CSSProperties } from 'react';

const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

/** Gorro do Pai Natal (no "S" do logótipo). O corpo e o pompom balançam devagar. */
export function Gorro({ className = '' }: { className?: string }) {
  return (
    <svg className={`s7-gorro ${className}`} viewBox="0 0 64 52" aria-hidden="true" focusable="false">
      <g className="s7-gorro__corpo">
        <path d="M9 38 Q12 10 44 9 Q56 9 58 21 Q51 15 45 19 Q52 27 55 38 Z" fill="#de1827" />
        <path d="M45 19 Q52 27 55 38 L47 38 Q46 28 45 19 Z" fill="#b31220" />
        <path d="M16 33 Q18 17 35 12.5" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
        <circle cx="58" cy="22" r="6.5" fill="#fff" />
        <circle cx="59.5" cy="24" r="3.5" fill="#ece6da" />
      </g>
      <rect x="4" y="34" width="56" height="13" rx="6.5" fill="#fff" />
      <rect x="6" y="41" width="52" height="5" rx="2.5" fill="#ece6da" />
    </svg>
  );
}

/** Raminho de azevinho: duas folhas e três bagas (as bagas brilham de vez em quando). */
export function Azevinho({ className = '' }: { className?: string }) {
  const folha = 'M0 0 L-4 -4 L-7 -2 L-10 -6 L-13 -3 L-17 -6 L-18 -2 L-22 0 L-18 2 L-17 6 L-13 3 L-10 6 L-7 2 L-4 4 Z';
  return (
    <svg className={`s7-azevinho ${className}`} viewBox="0 0 48 36" aria-hidden="true" focusable="false">
      {[22, 158].map((angle) => (
        <g key={angle} transform={`translate(24 21) rotate(${angle})`}>
          <path d={folha} fill="#12854c" stroke="#0b5e35" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M-1 0 L-19 0" stroke="#0b5e35" strokeWidth="0.9" strokeOpacity="0.6" />
        </g>
      ))}
      <g className="s7-azevinho__bagas">
        <circle cx="20.5" cy="23" r="3.6" fill="#de1827" />
        <circle cx="27.5" cy="23" r="3.6" fill="#de1827" />
        <circle cx="24" cy="18.5" r="3.6" fill="#e8323f" />
        <circle cx="19.4" cy="21.9" r="1" fill="#fff" fillOpacity="0.75" />
        <circle cx="26.4" cy="21.9" r="1" fill="#fff" fillOpacity="0.75" />
        <circle cx="22.9" cy="17.4" r="1" fill="#fff" fillOpacity="0.75" />
      </g>
    </svg>
  );
}

const CORES_LUZES = ['vermelha', 'dourada', 'verde', 'branca'] as const;

/**
 * Fio de luzes em festões: o fio é um SVG esticado à largura disponível e as lâmpadas são colocadas
 * em cima da mesma curva (parábola por festão), por isso ficam no fio em qualquer largura.
 */
export function FioLuzes({
  lampadas,
  festoes,
  flecha,
  className = '',
}: {
  lampadas: number;
  festoes: number;
  /** Quanto o fio desce no meio de cada festão, em píxeis. */
  flecha: number;
  className?: string;
}) {
  const largura = 100;
  const passo = largura / festoes;
  const caminho = Array.from({ length: festoes }, (_, i) => `Q${(i + 0.5) * passo} ${flecha * 2} ${(i + 1) * passo} 0`).join(' ');

  return (
    <div className={`s7-luzes ${className}`} style={cssVars({ '--flecha': `${flecha}px` })} aria-hidden="true">
      <svg className="s7-luzes__fio" viewBox={`0 0 ${largura} ${flecha + 2}`} preserveAspectRatio="none" focusable="false">
        <path d={`M0 0 ${caminho}`} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: lampadas }, (_, i) => {
        const x = (i + 0.5) / lampadas;
        const t = (x * festoes) % 1;
        const y = flecha * 4 * t * (1 - t);
        return (
          <i
            key={i}
            className={`s7-luzes__lampada s7-luzes__lampada--${CORES_LUZES[i % CORES_LUZES.length]}`}
            style={cssVars({ left: `${x * 100}%`, top: `${y.toFixed(1)}px`, '--i': i })}
          />
        );
      })}
    </div>
  );
}

/** Enfeites pendurados no topo do disco do banner: bolas e estrelas a balançar. */
const ENFEITES: { x: number; fio: number; tamanho: number; tipo: 'vermelha' | 'dourada' | 'verde' | 'estrela'; atraso: number }[] = [
  { x: 29, fio: 21, tamanho: 6.6, tipo: 'vermelha', atraso: -0.4 },
  { x: 37.5, fio: 11, tamanho: 4.4, tipo: 'estrela', atraso: -1.9 },
  { x: 46, fio: 15, tamanho: 8, tipo: 'dourada', atraso: -1.1 },
  { x: 55, fio: 8.5, tamanho: 3.6, tipo: 'estrela', atraso: -2.6 },
  { x: 62, fio: 19, tamanho: 6, tipo: 'verde', atraso: -0.8 },
  { x: 71, fio: 13, tamanho: 4.8, tipo: 'vermelha', atraso: -2.2 },
];

export function EnfeitesDisco() {
  return (
    <div className="s7-enfeites" aria-hidden="true">
      {ENFEITES.map((enfeite) => (
        <span
          key={enfeite.x}
          className="s7-enfeite"
          style={cssVars({ left: `${enfeite.x}%`, '--fio': `${enfeite.fio}%`, '--tamanho': enfeite.tamanho, '--atraso': `${enfeite.atraso}s` })}
        >
          <b className={`s7-enfeite__peca s7-enfeite__peca--${enfeite.tipo}`} />
        </span>
      ))}
    </div>
  );
}

function Arvore() {
  return (
    <svg className="s7-natal-arvore" viewBox="0 0 60 80" focusable="false">
      <rect x="26" y="63" width="8" height="12" rx="1.5" fill="#7a4a2a" />
      <g strokeLinejoin="round" strokeWidth="3">
        <polygon points="30,34 55,64 5,64" fill="#0f7a45" stroke="#0f7a45" />
        <polygon points="30,21 50,47 10,47" fill="#12854c" stroke="#12854c" />
        <polygon points="30,11 44,30 16,30" fill="#169457" stroke="#169457" />
      </g>
      <g fill="none" stroke="#f6c85f" strokeWidth="1.6" strokeLinecap="round">
        <path d="M19 27 Q30 33 41 26" />
        <path d="M14 43 Q30 51 46 41" />
        <path d="M10 60 Q30 69 51 58" />
      </g>
      <g className="s7-natal-arvore__luzes">
        {[
          [24, 25, '#de1827'], [36, 28, '#fff'], [19, 40, '#f6c85f'], [30, 44, '#de1827'], [41, 39, '#fff'],
          [14, 57, '#fff'], [25, 60, '#f6c85f'], [37, 61, '#de1827'], [47, 56, '#f6c85f'],
        ].map(([cx, cy, cor], i) => (
          <circle key={i} cx={cx} cy={cy} r="2.1" fill={cor as string} style={cssVars({ '--i': i })} />
        ))}
      </g>
      <polygon
        className="s7-natal-arvore__estrela"
        points="30,2 31.76,6.57 36.66,6.84 32.85,9.93 34.11,14.66 30,12 25.89,14.66 27.15,9.93 23.34,6.84 28.24,6.57"
        fill="#f6c85f"
        stroke="#f6c85f"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Presentes() {
  return (
    <svg className="s7-natal-presentes" viewBox="0 0 70 56" focusable="false">
      <g className="s7-natal-presentes__grande">
        <rect x="4" y="22" width="34" height="32" rx="2" fill="#de1827" />
        <rect x="18" y="22" width="6" height="32" fill="#f6c85f" />
        <rect x="2" y="16" width="38" height="9" rx="2" fill="#e8323f" />
        <rect x="18" y="16" width="6" height="9" fill="#f2b63c" />
        <path d="M21 16 C14 5 6 12 21 16 Z M21 16 C28 5 36 12 21 16 Z" fill="#f6c85f" />
      </g>
      <g className="s7-natal-presentes__pequeno">
        <rect x="42" y="33" width="24" height="21" rx="2" fill="#0f7a45" />
        <rect x="51.5" y="33" width="5" height="21" fill="#de1827" />
        <g className="s7-natal-presentes__tampa">
          <rect x="40" y="28" width="28" height="7" rx="1.5" fill="#12854c" />
          <rect x="51.5" y="28" width="5" height="7" fill="#e8323f" />
          <path d="M54 28 C48 19 42 25 54 28 Z M54 28 C60 19 66 25 54 28 Z" fill="#de1827" />
        </g>
      </g>
    </svg>
  );
}

function Bengala() {
  const caminho = 'M9 56 L9 17 A8 8 0 0 1 25 17 L25 21';
  return (
    <svg className="s7-natal-bengala" viewBox="0 0 34 60" focusable="false">
      <path d={caminho} fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
      <path d={caminho} fill="none" stroke="#de1827" strokeWidth="6.5" strokeDasharray="4 5" />
    </svg>
  );
}

function Sinos() {
  const sino = 'M0 -14 C-7 -14 -10 -7 -10 0 C-10 6 -12 9 -14 11 L14 11 C12 9 10 6 10 0 C10 -7 7 -14 0 -14 Z';
  return (
    <svg className="s7-natal-sinos" viewBox="0 0 56 52" focusable="false">
      {[
        { x: 19, angulo: -14, classe: 's7-natal-sinos__a' },
        { x: 37, angulo: 14, classe: 's7-natal-sinos__b' },
      ].map(({ x, angulo, classe }) => (
        <g key={classe} transform={`translate(${x} 30) rotate(${angulo})`}>
          <g className={classe}>
            <path d={sino} fill="#f2b63c" />
            <path d="M-6 -9 Q-7 -2 -6.5 6" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
            <rect x="-14" y="9" width="28" height="3" rx="1.5" fill="#c8962e" />
            <circle cx="0" cy="14.5" r="3" fill="#c8962e" />
          </g>
        </g>
      ))}
      <path d="M28 13 C20 4 14 12 28 13 Z M28 13 C36 4 42 12 28 13 Z" fill="#de1827" />
      <path d="M28 13 L24 21 M28 13 L32 21" stroke="#de1827" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="28" cy="13" r="2.6" fill="#b31220" />
    </svg>
  );
}

/**
 * Montra natalícia animada por baixo dos botões do banner (tema de Natal): o fio de luzes faz de separador e, por
 * baixo, árvore, presentes, bengala e sinos. Sem prazo nem contagem: a data-limite das encomendas saiu do banner.
 */
export function CenaNatal() {
  return (
    <div className="s7-natal-cena" aria-hidden="true">
      <FioLuzes className="s7-natal-cena__luzes" lampadas={11} festoes={3} flecha={9} />
      <div className="s7-natal-cena__aderecos">
        <Arvore />
        <Presentes />
        <Bengala />
        <Sinos />
        <i className="s7-natal-cena__brilho" style={cssVars({ left: '18%', top: '8%', '--a': '0.2s' })} />
        <i className="s7-natal-cena__brilho" style={cssVars({ left: '56%', top: '2%', '--a': '1.4s' })} />
        <i className="s7-natal-cena__brilho" style={cssVars({ left: '88%', top: '22%', '--a': '2.3s' })} />
      </div>
    </div>
  );
}
