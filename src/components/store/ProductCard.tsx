import { Link } from 'react-router-dom';
import { discountPercent, inCampaign, isInStock, productPath } from '../../catalog/query';
import type { Product } from '../../catalog/types';
import { useAddToCart } from '../../hooks/useAddToCart';
import { Icon } from './Icon';
import { Azevinho } from './natal/Aderecos';
import { useTemaNatal } from './natal/tema';
import { CabazStock, LimitedStockBadge, Price, ProductImage, StockBar } from './ProductBits';

function CardTag({ product }: { product: Product }) {
  if (!isInStock(product)) return <span className="s7-etiqueta s7-etiqueta--esgotado">Esgotado</span>;

  const discount = discountPercent(product);
  if (discount > 0) return <span className="s7-etiqueta s7-etiqueta--desconto">−{discount}%</span>;
  if (inCampaign(product, 'natal')) return <span className="s7-etiqueta s7-etiqueta--natal">Natal</span>;
  return null;
}

/** Cartão de produto (`s7-produto`): toda a área abre o detalhe; o botão junta ao carrinho. */
export function ProductCard({ product }: { product: Product }) {
  const addToCart = useAddToCart();
  const temaNatal = useTemaNatal();
  const available = isInStock(product);

  return (
    <article className={available ? 's7-produto' : 's7-produto s7-produto--esgotado'}>
      <div className="s7-produto__media">
        <div className="s7-produto__etiquetas">
          <CardTag product={product} />
          {available && product.limitedStock && <LimitedStockBadge />}
        </div>
        {temaNatal && product.isCabaz && <Azevinho className="s7-produto__azevinho" />}
        <ProductImage product={product} size={400} width={400} height={300} alt="" />
      </div>
      <div className="s7-produto__corpo">
        {product.categoryName && <p className="s7-produto__cat">{product.categoryName}</p>}
        <h3 className="s7-produto__nome">
          <Link to={productPath(product)}>{product.name}</Link>
        </h3>
        {product.format && <p className="s7-produto__formato">{product.format}</p>}
        {product.isCabaz ? (
          <CabazStock product={product} />
        ) : (
          product.showStock &&
          available &&
          product.stock !== null &&
          !inCampaign(product, 'escoamento') && <p className="s7-produto__stock">{product.stock} em stock</p>
        )}
        <StockBar product={product} />
        <div className="s7-produto__rodape">
          <Price product={product} />
          <button
            className="s7-btn s7-btn--primario s7-btn--icone"
            type="button"
            disabled={!available}
            aria-label={available ? `Adicionar ${product.name} ao carrinho` : `${product.name} esgotado`}
            onClick={() => addToCart(product)}
          >
            <Icon name="mais" />
          </button>
        </div>
      </div>
    </article>
  );
}

/** Cartão vazio com animação, enquanto o catálogo carrega. */
export function ProductCardSkeleton() {
  return (
    <div className="s7-produto s7-esqueleto" aria-hidden="true">
      <div className="s7-produto__media" />
      <div className="s7-produto__corpo">
        <i className="s7-esqueleto__linha s7-esqueleto__linha--curta" />
        <i className="s7-esqueleto__linha" />
        <i className="s7-esqueleto__linha s7-esqueleto__linha--media" />
      </div>
    </div>
  );
}

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  skeletons?: number;
  /** `s7-grelha--linha`: uma só linha (5 → 4 → 3 → 2 colunas). */
  singleRow?: boolean;
  className?: string;
}

export function ProductGrid({ products, loading = false, skeletons = 5, singleRow = false, className }: ProductGridProps) {
  const classes = ['s7-grelha'];
  if (singleRow) classes.push('s7-grelha--linha');
  if (className) classes.push(className);

  return (
    <div className={classes.join(' ')} aria-busy={loading || undefined}>
      {loading
        ? Array.from({ length: skeletons }, (_, index) => <ProductCardSkeleton key={index} />)
        : products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}
