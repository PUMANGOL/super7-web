import { Link } from 'react-router-dom';
import { isInStock, productPath } from '../../catalog/query';
import type { Product } from '../../catalog/types';
import { useAddToCart } from '../../hooks/useAddToCart';
import { formatKz, plural } from '../../utils/format';
import { Icon } from './Icon';
import { Azevinho } from './natal/Aderecos';
import { useTemaNatal } from './natal/tema';
import { CabazStock, LimitedStockBadge, ProductImage } from './ProductBits';

const VISIBLE_ITEMS = 4;

/** "Arroz branco 1 kg" → "Arroz branco": nos chips do cartão basta o produto. */
function shortItemName(name: string): string {
  return name.replace(/\s\d[\d,.]*\s?(kg|g|l|ml|cl|porções|un\.?)$/i, '');
}

/** Cartão de cabaz de Natal (`s7-cabaz`), com a fita na cor do nível e a quantidade em stock realçada. */
export function CabazCard({ product }: { product: Product }) {
  const addToCart = useAddToCart();
  const temaNatal = useTemaNatal();
  const available = isInStock(product);
  const classes = ['s7-cabaz'];
  if (product.level) classes.push(`s7-cabaz--${product.level}`);
  if (!available) classes.push('s7-cabaz--esgotado');

  const items = product.items;
  const hidden = items.length - VISIBLE_ITEMS;

  return (
    <article className={classes.join(' ')}>
      <div className="s7-cabaz__media">
        <div className="s7-cabaz__selo">
          {!available ? (
            <span className="s7-etiqueta s7-etiqueta--esgotado">Esgotado</span>
          ) : (
            <>
              {product.badge && <span className="s7-etiqueta s7-etiqueta--natal">{product.badge}</span>}
              {product.limitedStock && <LimitedStockBadge />}
            </>
          )}
        </div>
        {temaNatal && <Azevinho className="s7-cabaz__azevinho" />}
        <ProductImage product={product} size={600} alt={`${product.name} em embalagem de oferta`} />
      </div>
      <div className="s7-cabaz__corpo">
        <div className="s7-cabaz__topo">
          <p className={product.level ? `s7-nivel s7-nivel--${product.level}` : 's7-nivel'}>
            {product.level ?? 'Cesta de Natal'}
          </p>
          <CabazStock product={product} />
        </div>
        <h3 className="s7-cabaz__nome">
          <Link to={productPath(product)}>{product.name}</Link>
        </h3>
        {(product.summary || product.description) && (
          <p className="s7-cabaz__resumo">{product.summary || product.description}</p>
        )}
        {items.length > 0 && (
          <ul className="s7-cabaz__itens" aria-label="Alguns produtos incluídos">
            {items.slice(0, VISIBLE_ITEMS).map((item, index) => (
              <li key={`${item.name}-${index}`}>{shortItemName(item.name)}</li>
            ))}
            {hidden > 0 && <li className="s7-cabaz__mais">+ {plural(hidden, 'produto', 'produtos')}</li>}
          </ul>
        )}
        <div className="s7-cabaz__rodape">
          <p className="s7-preco">
            <strong>{formatKz(product.price)}</strong>
          </p>
          <button
            className="s7-btn s7-btn--primario"
            type="button"
            disabled={!available}
            aria-label={`Adicionar ${product.name} ao carrinho`}
            onClick={() => addToCart(product)}
          >
            <Icon name="carrinho" /> Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}

export function CabazCardSkeleton() {
  return (
    <div className="s7-cabaz s7-esqueleto" aria-hidden="true">
      <div className="s7-cabaz__media" />
      <div className="s7-cabaz__corpo">
        <i className="s7-esqueleto__linha s7-esqueleto__linha--curta" />
        <i className="s7-esqueleto__linha s7-esqueleto__linha--media" />
        <i className="s7-esqueleto__linha" />
        <i className="s7-esqueleto__linha" />
      </div>
    </div>
  );
}
