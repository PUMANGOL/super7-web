import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  discountPercent,
  inCampaign,
  isInStock,
  maxOrderQuantity,
  productPath,
  queryProducts,
  sortCabazes,
} from '../../catalog/query';
import type { Catalog, Product } from '../../catalog/types';
import { useCatalog } from '../../catalog/useCatalog';
import { BackToCatalogLink, Breadcrumbs, CatalogError, EmptyState, type Crumb } from '../../components/store/Feedback';
import { Icon } from '../../components/store/Icon';
import { ProductGrid } from '../../components/store/ProductCard';
import { CabazStock, LimitedStockBadge, Price, ProductImage, QuantityInput, StockBar } from '../../components/store/ProductBits';
import { Azevinho } from '../../components/store/natal/Aderecos';
import { useTemaNatal } from '../../components/store/natal/tema';
import { CAMPAIGNS } from '../../config/store';
import { useStoreCopy } from '../../catalog/storeCopy';
import { useCampaigns } from '../../catalog/useStoreSettings';
import { useAddToCart } from '../../hooks/useAddToCart';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatKz } from '../../utils/format';

function Availability({ product }: { product: Product }) {
  if (!isInStock(product)) {
    return (
      <p className="s7-disponivel s7-disponivel--nao">
        <Icon name="alerta" />
        <span>Esgotado</span>
      </p>
    );
  }
  // No escoamento, a barra de stock substitui esta indicação.
  if (inCampaign(product, 'escoamento') && product.stock !== null) return null;

  // Nas cestas, a quantidade em stock aparece sempre, realçada.
  if (product.isCabaz && product.stock !== null) return <CabazStock product={product} large />;

  // A categoria pede a quantidade exacta.
  if (product.showStock && product.stock !== null) {
    return (
      <p className={product.stock <= 5 ? 's7-disponivel s7-disponivel--pouco' : 's7-disponivel'}>
        <Icon name={product.stock <= 5 ? 'relogio' : 'check'} />
        <span>{product.stock} em stock</span>
      </p>
    );
  }

  if (product.stock !== null && product.stock <= 5) {
    return (
      <p className="s7-disponivel s7-disponivel--pouco">
        <Icon name="relogio" />
        <span>{product.stock === 1 ? 'Última unidade' : `Últimas ${product.stock} unidades`}</span>
      </p>
    );
  }

  return (
    <p className="s7-disponivel">
      <Icon name="check" />
      <span>{product.stock === null ? 'Disponível' : 'Em stock'}</span>
    </p>
  );
}

function CompareCabazes({ current, cabazes }: { current: Product; cabazes: Product[] }) {
  const cellClass = (product: Product) => (product.id === current.id ? 's7-comparar__actual' : undefined);

  return (
    <section className="s7-seccao s7-seccao--junta" aria-labelledby="s7-comparar-titulo">
      <div className="s7-bloco">
        <h2 id="s7-comparar-titulo">Compare as cestas</h2>
        <div className="s7-comparar-rolo">
          <table className="s7-comparar">
            <thead>
              <tr>
                <th scope="col">
                  <span className="s7-sr">Característica</span>
                </th>
                {cabazes.map((cabaz) => (
                  <th scope="col" key={cabaz.id} className={cellClass(cabaz)}>
                    <span className={cabaz.level ? `s7-nivel s7-nivel--${cabaz.level}` : 's7-nivel'}>
                      {cabaz.level ?? cabaz.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Produtos diferentes</th>
                {cabazes.map((cabaz) => (
                  <td key={cabaz.id} className={cellClass(cabaz)}>
                    {cabaz.items.length || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Unidades no total</th>
                {cabazes.map((cabaz) => (
                  <td key={cabaz.id} className={cellClass(cabaz)}>
                    {cabaz.items.reduce((sum, item) => sum + item.qty, 0) || '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Em stock</th>
                {cabazes.map((cabaz) => (
                  <td key={cabaz.id} className={cellClass(cabaz)}>
                    {cabaz.stock === null ? (
                      '—'
                    ) : cabaz.stock > 0 ? (
                      <span className={cabaz.stock <= 5 ? 's7-comparar__stock s7-comparar__stock--pouco' : 's7-comparar__stock'}>
                        {cabaz.stock}
                      </span>
                    ) : (
                      <span className="s7-etiqueta s7-etiqueta--esgotado">Esgotado</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Preço</th>
                {cabazes.map((cabaz) => (
                  <td key={cabaz.id} className={cellClass(cabaz)}>
                    <strong>{formatKz(cabaz.price)}</strong>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">
                  <span className="s7-sr">Acção</span>
                </th>
                {cabazes.map((cabaz) => (
                  <td key={cabaz.id} className={cellClass(cabaz)}>
                    {cabaz.id === current.id ? (
                      <span className="s7-etiqueta s7-etiqueta--suave">Está a ver</span>
                    ) : (
                      <Link className="s7-ligacao" to={productPath(cabaz)}>
                        Ver {cabaz.name}
                      </Link>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function relatedFor(product: Product, catalog: Catalog, clearanceActive: boolean) {
  const others = (list: Product[]) => list.filter((item) => item.id !== product.id).slice(0, 5);

  if (product.isCabaz && clearanceActive) {
    const clearance = others(queryProducts(catalog.products, { campaign: 'escoamento', inStock: true, sort: 'desconto' }));
    if (clearance.length) {
      return { title: 'Aproveite o escoamento', to: '/catalogo?campanha=escoamento', items: clearance };
    }
  }

  const sameCategory = others(
    queryProducts(catalog.products, { categorySlug: product.categorySlug, inStock: true, excludeCabazes: !product.isCabaz }),
  );
  return {
    title: 'Na mesma categoria',
    to: product.categorySlug ? `/catalogo?categoria=${encodeURIComponent(product.categorySlug)}` : '/catalogo',
    items: sameCategory,
  };
}

function ProductDetail({ product, catalog }: { product: Product; catalog: Catalog }) {
  const temaNatal = useTemaNatal();
  const navigate = useNavigate();
  const addToCart = useAddToCart();
  const [qty, setQty] = useState(1);
  const copy = useStoreCopy();

  const available = isInStock(product);
  const max = maxOrderQuantity(product);
  const discount = discountPercent(product);
  const cabazes = useMemo(
    () => (product.isCabaz ? sortCabazes(catalog.products.filter((item) => item.isCabaz)) : []),
    [product.isCabaz, catalog.products],
  );
  const clearanceActive = useCampaigns().isActive('escoamento');
  const related = useMemo(() => relatedFor(product, catalog, clearanceActive), [product, catalog, clearanceActive]);

  const crumb: Crumb = product.isCabaz
    ? { label: CAMPAIGNS.natal.label, to: '/catalogo?campanha=natal' }
    : product.categorySlug
      ? { label: product.categoryName, to: `/catalogo?categoria=${encodeURIComponent(product.categorySlug)}` }
      : { label: 'Catálogo', to: '/catalogo' };

  const detailClasses = ['s7-detalhe'];
  if (product.isCabaz) detailClasses.push('s7-detalhe--cabaz');
  if (product.level) detailClasses.push(`s7-detalhe--${product.level}`);

  // Com resumo, a descrição vai para o bloco de baixo; sem ele, aparece no topo.
  const lead = product.summary || product.description;
  const bodyText = product.summary ? product.description : '';
  const showBody = Boolean(bodyText || product.items.length);

  const buyNow = () => {
    addToCart(product, qty, { silent: true });
    navigate('/carrinho');
  };

  return (
    <main id="conteudo" className="s7-contentor">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, crumb, { label: product.name }]} />

      <article className={detailClasses.join(' ')}>
        <div className="s7-detalhe__media">
          <div className="s7-detalhe__selos">
            {discount > 0 ? (
              <span className="s7-etiqueta s7-etiqueta--desconto">−{discount}%</span>
            ) : product.badge ? (
              <span className="s7-etiqueta s7-etiqueta--natal">{product.badge}</span>
            ) : null}
            {available && product.limitedStock && <LimitedStockBadge />}
          </div>
          {temaNatal && product.isCabaz && <Azevinho className="s7-detalhe__azevinho" />}
          <ProductImage product={product} size={900} width={815} height={880} lazy={false} />
        </div>

        <div className="s7-detalhe__info">
          {product.isCabaz ? (
            <p className={product.level ? `s7-nivel s7-nivel--${product.level}` : 's7-nivel'}>
              Cesta de Natal{product.level ? ` · ${product.level}` : ''}
            </p>
          ) : (
            <p className="s7-produto__cat">{[product.categoryName, product.format].filter(Boolean).join(' · ')}</p>
          )}
          <h1>{product.name}</h1>
          {lead && <p className="s7-detalhe__resumo">{lead}</p>}

          <div className="s7-detalhe__compra">
            <div className="s7-detalhe__linha">
              <Price product={product} large />
              <Availability product={product} />
            </div>
            <StockBar product={product} suffix=" a preço de escoamento" />
            <div className="s7-detalhe__accoes">
              <QuantityInput id="s7-qtd" value={Math.min(qty, max)} max={max} onChange={setQty} label="Quantidade" />
              <button
                className="s7-btn s7-btn--primario s7-btn--grande"
                type="button"
                disabled={!available}
                onClick={() => addToCart(product, qty)}
              >
                <Icon name="carrinho" /> Adicionar
              </button>
              <button className="s7-btn s7-btn--contorno s7-btn--grande" type="button" disabled={!available} onClick={buyNow}>
                Comprar agora
              </button>
            </div>
          </div>

          <ul className="s7-garantias">
            <li>
              <Icon name="pin" />
              <span>
                <strong>Levantamento {copy.pickupPlace}</strong>, sem custo de entrega
                {copy.homeDelivery ? ', ou entrega na sua morada.' : '.'}
              </span>
            </li>
            <li>
              <Icon name="gift" />
              <span>
                <strong>Pronto a oferecer.</strong>{' '}
                {copy.giftEnabled ? 'Junte uma mensagem de oferta ao finalizar a compra.' : 'Embalado com laço.'}
              </span>
            </li>
            <li>
              <Icon name="dinheiro" />
              <span>
                <strong>{copy.payment.title}.</strong> {copy.payment.text}.
              </span>
            </li>
          </ul>
        </div>
      </article>

      {showBody && (
        <section className="s7-seccao" aria-labelledby="s7-descricao-titulo">
          <div className="s7-bloco">
            <h2 id="s7-descricao-titulo">{product.items.length ? 'O que inclui' : 'Descrição'}</h2>
            {bodyText && <p className="s7-texto-longo">{bodyText}</p>}
            {product.items.length > 0 && (
              <ul className="s7-inclui">
                {product.items.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    <span>{item.name}</span>
                    <span>× {item.qty}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {product.isCabaz && cabazes.length >= 2 && <CompareCabazes current={product} cabazes={cabazes} />}

      {related.items.length > 0 && (
        <section className="s7-seccao" aria-labelledby="s7-relacionados-titulo">
          <div className="s7-seccao__topo">
            <div>
              <h2 id="s7-relacionados-titulo">{related.title}</h2>
            </div>
            <Link className="s7-ligacao" to={related.to}>
              Ver mais <Icon name="seta" />
            </Link>
          </div>
          <ProductGrid products={related.items} singleRow />
        </section>
      )}
    </main>
  );
}

export function ProductPage() {
  const { id = '' } = useParams();
  const catalog = useCatalog();
  const product = catalog.data?.byId.get(id) ?? null;
  useDocumentTitle(product ? product.name : catalog.isLoading ? 'A carregar' : 'Produto indisponível');

  if (product && catalog.data) {
    return <ProductDetail key={product.id} product={product} catalog={catalog.data} />;
  }

  return (
    <main id="conteudo" className="s7-contentor s7-pagina-simples">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Catálogo', to: '/catalogo' }, { label: 'Produto' }]} />
      {catalog.isLoading ? (
        <div className="s7-detalhe s7-esqueleto" aria-busy="true" aria-label="A carregar o produto">
          <div className="s7-detalhe__media" />
          <div className="s7-detalhe__info">
            <i className="s7-esqueleto__linha s7-esqueleto__linha--curta" />
            <i className="s7-esqueleto__linha s7-esqueleto__linha--titulo" />
            <i className="s7-esqueleto__linha" />
            <i className="s7-esqueleto__linha s7-esqueleto__linha--media" />
          </div>
        </div>
      ) : catalog.isError ? (
        <CatalogError onRetry={() => catalog.refetch()} />
      ) : (
        <EmptyState icon="box" title="Este produto já não está disponível" action={<BackToCatalogLink />}>
          Pode ter esgotado ou saído da campanha. Veja os restantes produtos da loja.
        </EmptyState>
      )}
    </main>
  );
}
