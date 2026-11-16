import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { maxOrderQuantity, productPath, queryProducts } from '../../catalog/query';
import { useCatalog } from '../../catalog/useCatalog';
import { CheckoutSteps } from '../../components/store/CheckoutSteps';
import { Breadcrumbs, CatalogError, EmptyState } from '../../components/store/Feedback';
import { Icon } from '../../components/store/Icon';
import { ProductGrid } from '../../components/store/ProductCard';
import { ProductImage, QuantityInput } from '../../components/store/ProductBits';
import { useCampaigns } from '../../catalog/useStoreSettings';
import { useCart } from '../../context/cart';
import { useNotice } from '../../context/notice';
import { useCartDetail, type CartDetailLine } from '../../hooks/useCartDetail';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatKz, plural } from '../../utils/format';

function CartRow({ line }: { line: CartDetailLine }) {
  const { setQuantity, remove } = useCart();
  const { notify } = useNotice();
  const { product } = line;
  const max = maxOrderQuantity(product);

  return (
    <li className="s7-linha">
      <div className="s7-linha__media">
        <ProductImage product={product} size={192} width={96} height={96} alt="" />
      </div>
      <div>
        <h2 className="s7-linha__nome">
          <Link to={productPath(product)}>{product.name}</Link>
        </h2>
        <p className="s7-linha__meta">
          {product.format && <span>{product.format} · </span>}
          <span>{formatKz(product.price)} / un.</span>{' '}
          {product.previousPrice && <s>{formatKz(product.previousPrice)}</s>}
        </p>
      </div>
      <QuantityInput
        small
        value={line.qty}
        max={max}
        label={`Quantidade de ${product.name}`}
        onChange={(qty) => setQuantity(product.id, qty, max)}
      />
      <p className="s7-linha__subtotal">{formatKz(line.subtotal)}</p>
      <button
        className="s7-linha__remover"
        type="button"
        aria-label={`Remover ${product.name} do carrinho`}
        onClick={() => {
          remove(product.id);
          notify(`${product.name} removido do carrinho`);
        }}
      >
        <Icon name="lixo" />
      </button>
    </li>
  );
}

function Suggestions({ exclude }: { exclude: Set<string> }) {
  const { data } = useCatalog();
  const clearance = useCampaigns().isActive('escoamento');

  const items = useMemo(() => {
    if (!data) return [];
    const list = clearance
      ? queryProducts(data.products, { campaign: 'escoamento', inStock: true, sort: 'desconto' })
      : queryProducts(data.products, { featured: true, inStock: true, excludeCabazes: true });
    return list.filter((product) => !exclude.has(product.id)).slice(0, 5);
  }, [data, clearance, exclude]);

  if (items.length === 0) return null;

  return (
    <section className="s7-seccao" aria-labelledby="s7-sugestoes-titulo">
      <div className="s7-seccao__topo">
        <div>
          {clearance && (
            <p className="s7-sobretitulo s7-sobretitulo--escoamento">
              <Icon name="tag" /> Escoamento
            </p>
          )}
          <h2 id="s7-sugestoes-titulo">Junte à sua encomenda</h2>
        </div>
        <Link className="s7-ligacao" to={clearance ? '/catalogo?campanha=escoamento' : '/catalogo'}>
          {clearance ? 'Ver todo o escoamento' : 'Ver todos os produtos'} <Icon name="seta" />
        </Link>
      </div>
      <ProductGrid products={items} singleRow />
    </section>
  );
}

export function CartPage() {
  useDocumentTitle('Carrinho');
  const { isActive } = useCampaigns();
  const natalActive = isActive('natal');
  const { lines } = useCart();
  const { detail, isLoading, isError, refetch } = useCartDetail();
  const inCart = useMemo(() => new Set(lines.map((line) => line.id)), [lines]);
  const hasLines = detail.lines.length > 0;
  const waiting = lines.length > 0 && isLoading;

  return (
    <main id="conteudo" className="s7-contentor">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Carrinho' }]} />

      <div className="s7-pagina-titulo">
        <div>
          <h1>Carrinho</h1>
          {hasLines && <p>{plural(detail.units, 'artigo', 'artigos')} no carrinho</p>}
        </div>
        <CheckoutSteps current={1} />
      </div>

      {isError && lines.length > 0 ? (
        <CatalogError onRetry={() => refetch()} />
      ) : waiting ? (
        <p className="s7-carregar" role="status">
          A carregar o carrinho…
        </p>
      ) : hasLines ? (
        <div className="s7-carrinho">
          <div>
            <ul className="s7-linhas">
              {detail.lines.map((line) => (
                <CartRow key={line.product.id} line={line} />
              ))}
            </ul>
            <p className="s7-carrinho__continuar">
              <Link className="s7-ligacao" to="/catalogo">
                <Icon name="seta-esq" /> Continuar a comprar
              </Link>
            </p>
          </div>

          <aside className="s7-resumo" aria-labelledby="s7-resumo-titulo">
            <h2 id="s7-resumo-titulo">Resumo</h2>
            <dl className="s7-resumo__linhas">
              <div>
                <dt>Subtotal ({plural(detail.units, 'artigo', 'artigos')})</dt>
                <dd>{formatKz(detail.subtotal)}</dd>
              </div>
              {detail.savings > 0 && (
                <div className="s7-resumo__poupanca">
                  <dt>Poupa no escoamento</dt>
                  <dd>−{formatKz(detail.savings)}</dd>
                </div>
              )}
              <div>
                <dt>Entrega</dt>
                <dd>Indicada no passo seguinte</dd>
              </div>
            </dl>
            <p className="s7-resumo__total">
              <span>Total</span>
              <strong>{formatKz(detail.subtotal)}</strong>
            </p>
            <Link className="s7-btn s7-btn--primario s7-btn--grande s7-btn--bloco" to="/checkout">
              Finalizar compra <Icon name="seta" />
            </Link>
            <p className="s7-resumo__nota">
              <Icon name="gift" />
              <span>Vai oferecer? No passo seguinte pode juntar uma mensagem de oferta.</span>
            </p>
          </aside>
        </div>
      ) : (
        <EmptyState
          icon="carrinho"
          title="O seu carrinho está vazio"
          action={
            natalActive ? (
              <Link className="s7-btn s7-btn--campanha" to="/catalogo?campanha=natal">
                Ver cabazes de Natal
              </Link>
            ) : (
              <Link className="s7-btn s7-btn--primario" to="/catalogo">
                Ver produtos
              </Link>
            )
          }
        >
          {natalActive
            ? 'Comece pelos cabazes de Natal ou aproveite os preços de escoamento.'
            : 'Explore o catálogo e junte os produtos que quer levantar na loja.'}
        </EmptyState>
      )}

      <Suggestions exclude={inCart} />
    </main>
  );
}
