import { useEffect, useRef, type CSSProperties } from 'react';
import type { PaymentMethod } from '../../config/store';
import { formatKz } from '../../utils/format';

/** Bicos da roseta à volta do selo (32), entre os raios 94 e 86, com centro em (100, 100). */
const ROSETTE = Array.from({ length: 64 }, (_, index) => {
  const radius = index % 2 === 0 ? 94 : 86;
  const angle = (Math.PI * index) / 32;
  return `${(100 + radius * Math.sin(angle)).toFixed(1)},${(100 - radius * Math.cos(angle)).toFixed(1)}`;
}).join(' ');

const CONFETTI_COLOURS = ['#de1827', '#017649', '#c8962e', '#2fb47c', '#f2b63c', '#b31220'];

/** Papelinhos que saltam do selo quando ele "carimba": direcção, distância (com um pouco de queda) e rotação. */
const CONFETTI = Array.from({ length: 22 }, (_, index) => {
  const angle = (index / 22) * Math.PI * 2 + (index % 2 ? 0.12 : -0.08);
  const distance = 120 + ((index * 37) % 70);
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance * 0.8 + 50),
    rotate: ((index * 83) % 540) - 270,
    colour: CONFETTI_COLOURS[index % CONFETTI_COLOURS.length],
    round: index % 3 === 0,
  };
});

interface PaidDialogProps {
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  onClose: () => void;
}

/**
 * Pagamento confirmado com a página aberta: janela com o selo "Pago" (carimba, larga papelinhos e fica a brilhar).
 * É um <dialog> modal: o foco fica lá dentro, Esc ou um clique fora fecha, e o foco volta para onde estava.
 */
export function PaidDialog({ amount, method, reference, onClose }: PaidDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, []);

  const close = () => dialog.current?.close();
  const how =
    method === 'IBAN'
      ? `A loja confirmou a sua transferência de ${formatKz(amount)}.`
      : `Recebemos o pagamento de ${formatKz(amount)}${method === 'MULTICAIXA_EXPRESS' ? ' pelo Multicaixa Express' : ''}.`;

  return (
    <dialog
      ref={dialog}
      className="s7-pago"
      aria-labelledby="s7-pago-titulo"
      aria-describedby="s7-pago-texto"
      onClose={onClose}
      onClick={(event) => {
        // O <dialog> só recebe o clique directamente no fundo escurecido (a caixa ocupa-o todo).
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="s7-pago__caixa">
        <div className="s7-pago__selo" aria-hidden="true">
          <span className="s7-pago__onda" />
          <span className="s7-pago__onda s7-pago__onda--2" />
          <svg className="s7-pago__desenho" viewBox="0 0 200 236" focusable="false">
            <defs>
              <radialGradient id="s7-pago-disco" cx="36%" cy="28%" r="80%">
                <stop offset="0" stopColor="#0a9a62" />
                <stop offset="1" stopColor="#01502f" />
              </radialGradient>
              <linearGradient id="s7-pago-reflexo" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff" stopOpacity="0.5" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <clipPath id="s7-pago-recorte">
                <circle cx="100" cy="100" r="78" />
              </clipPath>
            </defs>
            <polygon className="s7-pago__fita" points="66,138 100,150 82,230 68,214 50,222" />
            <polygon className="s7-pago__fita s7-pago__fita--sombra" points="134,138 100,150 118,230 132,214 150,222" />
            <polygon className="s7-pago__roseta" points={ROSETTE} />
            <circle cx="100" cy="100" r="78" fill="url(#s7-pago-disco)" />
            <circle className="s7-pago__costura" cx="100" cy="100" r="70" />
            <path className="s7-pago__visto" d="M84 63 l11 11 l23 -23" />
            <text className="s7-pago__texto" x="100" y="127" textAnchor="middle">
              PAGO
            </text>
            <text className="s7-pago__sub" x="100" y="148" textAnchor="middle">
              CONFIRMADO
            </text>
            <g clipPath="url(#s7-pago-recorte)">
              <g transform="skewX(-20)">
                <rect className="s7-pago__reflexo" x="0" y="0" width="56" height="200" fill="url(#s7-pago-reflexo)" />
              </g>
            </g>
          </svg>
          <span className="s7-pago__confetes">
            {CONFETTI.map((piece, index) => (
              <i
                key={index}
                className={piece.round ? 's7-pago__confete s7-pago__confete--bola' : 's7-pago__confete'}
                style={
                  {
                    '--x': `${piece.x}px`,
                    '--y': `${piece.y}px`,
                    '--r': `${piece.rotate}deg`,
                    '--c': piece.colour,
                  } as CSSProperties
                }
              />
            ))}
          </span>
        </div>

        <h2 id="s7-pago-titulo">Pagamento confirmado</h2>
        <p id="s7-pago-texto">
          {how} A sua encomenda vai ser preparada; enviámos a confirmação para o seu{' '}
          <span className="s7-pago__inteiro">e-mail.</span>
        </p>
        {reference && (
          <p className="s7-pago__ref">
            <span>Referência da compra</span>
            <b>{reference}</b>
          </p>
        )}
        <button className="s7-btn s7-btn--primario s7-btn--bloco" type="button" onClick={close} autoFocus>
          Ver a encomenda
        </button>
      </div>
    </dialog>
  );
}
