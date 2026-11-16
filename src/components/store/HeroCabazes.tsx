import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import cabazBronze from '../../assets/img/cabaz-bronze.webp';
import cabazOuro from '../../assets/img/cabaz-ouro.webp';
import cabazPrata from '../../assets/img/cabaz-prata.webp';
import { isInStock, productPath } from '../../catalog/query';
import type { CabazLevel, Product } from '../../catalog/types';
import { formatKz } from '../../utils/format';
import { Icon } from './Icon';

const ART: Record<CabazLevel, { src: string; alt: string; width: number; height: number }> = {
  prata: { src: cabazPrata, alt: 'Cabaz Prata com laço verde', width: 698, height: 880 },
  ouro: { src: cabazOuro, alt: 'Cabaz Ouro com laço vermelho', width: 815, height: 880 },
  bronze: { src: cabazBronze, alt: 'Cabaz Bronze com laço prateado', width: 641, height: 880 },
};

/** Ordem no documento = ordem visual da esquerda para a direita (também a ordem do Tab). */
const LEVELS: CabazLevel[] = ['prata', 'ouro', 'bronze'];

/**
 * Os três cabazes do hero, com um chamariz discreto:
 * - rato: ao passar por cima, o cabaz aproxima-se e aparece uma etiqueta com o nome e o preço;
 *   o clique abre a página do cabaz;
 * - toque: o primeiro toque mostra a etiqueta, o segundo abre a página; tocar fora esconde;
 * - teclado: a etiqueta aparece quando o cabaz recebe o foco; Esc esconde.
 * Um nível sem produto no catálogo mostra só a fotografia.
 */
export function HeroCabazes({ cabazes }: { cabazes: Product[] }) {
  const [open, setOpen] = useState<CabazLevel | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Esc e um toque fora dos cabazes escondem a etiqueta.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null);
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!stageRef.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const onStageBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(null);
  };

  return (
    <div className="s7-hero__cabazes" ref={stageRef} data-aberto={open ?? undefined} onBlur={onStageBlur}>
      {LEVELS.map((level) => {
        const product = cabazes.find((cabaz) => cabaz.level === level);
        const art = ART[level];
        const image = <img src={art.src} alt={art.alt} width={art.width} height={art.height} />;

        if (!product) {
          return (
            <div key={level} className={`s7-hero__cabaz s7-hero__cabaz--${level}`}>
              {image}
            </div>
          );
        }

        const available = isInStock(product);
        const price = available ? formatKz(product.price) : 'Esgotado';

        // Toque com a etiqueta escondida: este clique só a mostra (StoreLayout ignora a ligação marcada).
        const onPointerDown = (event: PointerEvent<HTMLAnchorElement>) => {
          if (event.pointerType !== 'mouse' && open !== level) event.currentTarget.dataset.s7Segurar = '';
          else delete event.currentTarget.dataset.s7Segurar;
        };
        const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
          if (event.currentTarget.dataset.s7Segurar === undefined) return;
          delete event.currentTarget.dataset.s7Segurar;
          event.preventDefault();
          setOpen(level);
        };

        return (
          <div
            key={level}
            className={`s7-hero__cabaz s7-hero__cabaz--${level}`}
            data-activo={open === level || undefined}
            onPointerEnter={(event) => event.pointerType === 'mouse' && setOpen(level)}
            onPointerLeave={(event) => event.pointerType === 'mouse' && setOpen(null)}
          >
            <Link
              to={productPath(product)}
              aria-label={`${product.name}, ${price}`}
              onPointerDown={onPointerDown}
              onClick={onClick}
              // Só o foco do teclado mostra a etiqueta (o de um toque ou clique já é tratado acima).
              onFocus={(event) => event.currentTarget.matches(':focus-visible') && setOpen(level)}
            >
              {image}
            </Link>
            <p className="s7-hero__etiqueta" aria-hidden="true">
              <span>{product.name}</span>
              <b>{price}</b>
              <Icon name="seta" />
            </p>
          </div>
        );
      })}
    </div>
  );
}
