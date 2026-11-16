import { useState } from 'react';
import { sizedImageUrl } from '../../api/images';
import { inCampaign, stockLabel } from '../../catalog/query';
import type { Product } from '../../catalog/types';
import { formatKz } from '../../utils/format';
import { Icon } from './Icon';

interface ProductImageProps {
  product: Pick<Product, 'name' | 'image' | 'categoryIcon'>;
  /** Caixa pedida à API de imagens, em píxeis. */
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  lazy?: boolean;
}

/** Fotografia do produto ou, sem ela, o marcador com o ícone da categoria. */
export function ProductImage({ product, size, width, height, alt, lazy = true }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const src = sizedImageUrl(product.image, size);

  if (!src || failed) {
    return (
      <span className="s7-marcador">
        <Icon name={product.categoryIcon} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? product.name}
      width={width}
      height={height}
      loading={lazy ? 'lazy' : undefined}
      onError={() => setFailed(true)}
    />
  );
}

interface PriceProps {
  product: Pick<Product, 'price' | 'previousPrice'>;
  large?: boolean;
}

export function Price({ product, large = false }: PriceProps) {
  const classes = ['s7-preco'];
  if (product.previousPrice) classes.push('s7-preco--desconto');
  if (large) classes.push('s7-preco--grande');

  return (
    <p className={classes.join(' ')}>
      {product.previousPrice ? (
        <s>
          <span className="s7-sr">Antes </span>
          {formatKz(product.previousPrice)}
        </s>
      ) : null}
      <strong>
        {product.previousPrice ? <span className="s7-sr">Agora </span> : null}
        {formatKz(product.price)}
      </strong>
    </p>
  );
}

interface StockBarProps {
  product: Pick<Product, 'stock' | 'initialStock' | 'campaigns'>;
  suffix?: string;
}

/** Barra "Restam N unidades", só nos produtos em escoamento com stock. */
export function StockBar({ product, suffix = '' }: StockBarProps) {
  if (!inCampaign(product, 'escoamento') || product.stock === null || product.stock <= 0) return null;

  const base = product.initialStock && product.initialStock >= product.stock ? product.initialStock : product.stock;
  const percent = Math.max(6, Math.min(100, Math.round((product.stock / base) * 100)));

  return (
    <div className="s7-stock">
      <div className="s7-stock__barra">
        <i style={{ width: `${percent}%` }} />
      </div>
      <span>
        {stockLabel(product.stock)}
        {suffix}
      </span>
    </div>
  );
}

interface QuantityInputProps {
  value: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  small?: boolean;
  id?: string;
}

/** Selector − / número / +. O número só é aplicado ao sair do campo ou com Enter. */
export function QuantityInput({ value, max, onChange, label, small = false, id }: QuantityInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const limit = Math.max(1, max);

  const commit = (raw: string) => {
    const parsed = Math.floor(Number(raw));
    const next = Number.isFinite(parsed) && parsed >= 1 ? Math.min(limit, parsed) : value;
    setDraft(null);
    if (next !== value) onChange(next);
  };

  return (
    <div className={small ? 's7-qtd s7-qtd--s' : 's7-qtd'}>
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Icon name="menos" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={limit}
        value={draft ?? String(value)}
        aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(event.currentTarget.value);
          }
        }}
      />
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={value >= limit}
        onClick={() => onChange(Math.min(limit, value + 1))}
      >
        <Icon name="mais" />
      </button>
    </div>
  );
}
