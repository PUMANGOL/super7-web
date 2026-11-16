import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import lojaAtendimento from '../../assets/img/loja-atendimento.webp';
import lojaEquipa from '../../assets/img/loja-equipa.webp';
import lojaLubrificantes from '../../assets/img/loja-lubrificantes.webp';
import { hasOnlinePayment, paymentMethodsSentence, paymentMethodsShort } from '../../catalog/paymentCopy';
import { discountPercent, inCampaign, queryProducts, sortCabazes } from '../../catalog/query';
import type { Catalog, Product } from '../../catalog/types';
import { useCatalog } from '../../catalog/useCatalog';
import { useCampaigns, useCheckoutOptions } from '../../catalog/useStoreSettings';
import { CabazCard, CabazCardSkeleton } from '../../components/store/CabazCard';
import { Countdown } from '../../components/store/Countdown';
import { HeroCabazes } from '../../components/store/HeroCabazes';
import { CatalogError, EmptyState } from '../../components/store/Feedback';
import { Icon } from '../../components/store/Icon';
import { ProductCard, ProductCardSkeleton, ProductGrid } from '../../components/store/ProductCard';
import type { Campaign } from '../../config/store';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatKz, plural } from '../../utils/format';

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface HomeData {
  cabazes: Product[];
  escoamento: Product[];
  maxDiscount: number;
  featured: Product[];
}

function selectHomeData(catalog: Catalog | undefined): HomeData {
  const products = catalog?.products ?? [];
  const cabazes = sortCabazes(products.filter((product) => product.isCabaz));
  const escoamento = queryProducts(products, { campaign: 'escoamento', inStock: true, sort: 'desconto' });
  const maxDiscount = escoamento.reduce((max, product) => Math.max(max, discountPercent(product)), 0);

  // Destaques marcados no back-office; sem eles, produtos do dia-a-dia fora das campanhas.
  let featured = queryProducts(products, { featured: true, excludeCabazes: true, inStock: true });
  if (featured.length === 0) {
    featured = queryProducts(products, { excludeCabazes: true, inStock: true }).filter(
      (product) => !inCampaign(product, 'escoamento'),
    );
  }

  return { cabazes, escoamento, maxDiscount, featured: featured.slice(0, 5) };
}

interface ChristmasHeroProps {
  campaign: Campaign;
  cabazes: Product[];
  fromPrice: number | null;
  showClearance: boolean;
}

function ChristmasHero({ campaign, cabazes, fromPrice, showClearance }: ChristmasHeroProps) {
  const year = campaign.endsOn.slice(0, 4);
  // O nome vindo de GET /campaign pode já trazer o ano ("Boas Festas 2026").
  const title = campaign.name.includes(year) ? campaign.name : `${campaign.name} ${year}`;

  return (
    <section className="s7-hero" aria-labelledby="s7-hero-titulo">
      <div className="s7-contentor s7-hero__in">
        <div className="s7-hero__texto">
          <p className="s7-hero__chapa">
            <Icon name="gift" />
            {title}
          </p>
          <h1 id="s7-hero-titulo">
            Este Natal, ofereça um <em>cabaz Super7</em>
          </h1>
          <p className="s7-hero__intro">
            Cabazes prontos a oferecer a clientes, colaboradores e família. Encomende online e levante na loja
            Super7 do posto Pumangol mais próximo.
          </p>
          <div className="s7-hero__accoes">
            <a className="s7-btn s7-btn--campanha s7-btn--grande" href="#cabazes">
              Escolher cabaz
              <Icon name="seta" />
            </a>
            {showClearance && (
              <a className="s7-btn s7-btn--claro s7-btn--grande" href="#escoamento">
                Ver escoamento
              </a>
            )}
          </div>
          {campaign.ordersUntil && <Countdown until={campaign.ordersUntil} label="Encomendas de Natal até" />}
        </div>

        <div className="s7-hero__palco">
          <div className="s7-hero__disco" aria-hidden="true">
            <div className="s7-hero__fita">
              <span>Boas Festas</span><span>✦</span><span>Super7</span><span>✦</span>
              <span>Boas Festas</span><span>✦</span><span>Super7</span><span>✦</span>
              <span>Boas Festas</span><span>✦</span><span>Super7</span>
            </div>
          </div>
          <HeroCabazes cabazes={cabazes} />
          {fromPrice !== null && (
            <p className="s7-hero__selo">
              <small>Desde</small>
              <b>{formatKz(fromPrice)}</b>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function StoreHero() {
  return (
    <section className="s7-hero" aria-labelledby="s7-hero-titulo">
      <div className="s7-contentor s7-hero__in">
        <div className="s7-hero__texto">
          <p className="s7-hero__chapa">
            <Icon name="loja" />
            Lojas Super7
          </p>
          <h1 id="s7-hero-titulo">
            A loja do seu posto Pumangol, agora <em>online</em>
          </h1>
          <p className="s7-hero__intro">
            Encomende os produtos do dia-a-dia e levante-os na loja Super7 que escolher.
          </p>
          <div className="s7-hero__accoes">
            <Link className="s7-btn s7-btn--campanha s7-btn--grande" to="/catalogo">
              Ver produtos
              <Icon name="seta" />
            </Link>
          </div>
        </div>
        <div className="s7-lojas__fotos s7-hero__fotos">
          <img src={lojaAtendimento} alt="Colaboradora no balcão de uma loja Super7" width={478} height={318} />
          <img src={lojaLubrificantes} alt="Prateleiras de lubrificantes numa loja Super7" width={478} height={341} />
          <img src={lojaEquipa} alt="Colaboradora de uma loja Super7" width={478} height={341} />
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  useDocumentTitle(null);
  const catalog = useCatalog();
  const loading = catalog.isLoading;
  const failed = catalog.isError;
  const { campaigns, isActive } = useCampaigns();
  const natalActive = isActive('natal');
  const escoamentoActive = isActive('escoamento');
  const { paymentMethods, homeDelivery: delivery } = useCheckoutOptions().options;
  const onlinePayment = hasOnlinePayment(paymentMethods);
  const homeDelivery = delivery.enabled && onlinePayment;

  const { cabazes, escoamento, maxDiscount, featured } = useMemo(() => selectHomeData(catalog.data), [catalog.data]);
  const categories = catalog.data?.categories ?? [];
  const fromPrice = cabazes.length ? Math.min(...cabazes.map((product) => product.price)) : null;
  const showClearance = escoamentoActive && !failed && (loading || escoamento.length > 0);

  return (
    <main id="conteudo">
      {natalActive ? <ChristmasHero campaign={campaigns.natal} cabazes={cabazes} fromPrice={fromPrice} showClearance={showClearance} /> : <StoreHero />}

      <div className="s7-contentor">
        <ul className="s7-vantagens">
          <li>
            <Icon name="pin" />
            <p>
              <strong>Levante no posto</strong>
              <span>Na loja Super7 que escolher</span>
            </p>
          </li>
          <li>
            <Icon name="gift" />
            <p>
              <strong>Pronto a oferecer</strong>
              <span>Com laço e mensagem de oferta</span>
            </p>
          </li>
          <li>
            <Icon name="equipa" />
            <p>
              <strong>Para toda a equipa</strong>
              <span>Na quantidade que precisar</span>
            </p>
          </li>
          <li>
            <Icon name="escudo" />
            <p>
              <strong>{onlinePayment ? 'Pagamento Multicaixa' : 'Pague no levantamento'}</strong>
              <span>{onlinePayment ? paymentMethodsShort(paymentMethods) : 'Multicaixa ou numerário, na loja'}</span>
            </p>
          </li>
        </ul>
      </div>

      {failed && (
        <section className="s7-seccao">
          <div className="s7-contentor">
            <CatalogError onRetry={() => catalog.refetch()} />
          </div>
        </section>
      )}

      {natalActive && !failed && (
        <section className="s7-seccao" id="cabazes" aria-labelledby="s7-cabazes-titulo">
          <div className="s7-contentor">
            <div className="s7-seccao__topo">
              <div>
                <p className="s7-sobretitulo s7-sobretitulo--natal">
                  <Icon name="gift" /> Cabazes de Natal
                </p>
                <h2 id="s7-cabazes-titulo">
                  {cabazes.length === 3 ? 'Três cabazes, prontos a oferecer' : 'Cabazes prontos a oferecer'}
                </h2>
                <p>Embalados em celofane, com laço e cartão Boas Festas. Escolha o cabaz e a quantidade.</p>
              </div>
              {cabazes.length > 0 && (
                <Link className="s7-ligacao" to="/catalogo?campanha=natal">
                  Ver todos os cabazes <Icon name="seta" />
                </Link>
              )}
            </div>
            {loading ? (
              <div className="s7-cabazes">
                <CabazCardSkeleton />
                <CabazCardSkeleton />
                <CabazCardSkeleton />
              </div>
            ) : cabazes.length > 0 ? (
              <div className="s7-cabazes">
                {cabazes.slice(0, 3).map((product) => (
                  <CabazCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <EmptyState icon="gift" title="Os cabazes de Natal estão quase a chegar">
                Estamos a preparar os cabazes desta campanha. Volte dentro de alguns dias.
              </EmptyState>
            )}
          </div>
        </section>
      )}

      {showClearance && (
        <section className="s7-seccao" id="escoamento" aria-labelledby="s7-escoamento-titulo">
          <div className="s7-contentor">
            <div className="s7-escoamento">
              <div className="s7-escoamento__intro">
                <p className="s7-sobretitulo">
                  <Icon name="tag" /> Escoamento
                </p>
                {maxDiscount > 0 && (
                  <p className="s7-escoamento__numero">
                    <small>até</small>
                    <b>−{maxDiscount}%</b>
                  </p>
                )}
                <h2 id="s7-escoamento-titulo">Preços de escoamento</h2>
                <p>Produtos seleccionados com desconto, enquanto houver stock nas lojas.</p>
                <Link className="s7-btn s7-btn--branco" to="/catalogo?campanha=escoamento">
                  Ver todo o escoamento <Icon name="seta" />
                </Link>
              </div>
              <div className="s7-escoamento__lista">
                {loading
                  ? Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)
                  : escoamento.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            </div>
          </div>
        </section>
      )}

      {!failed && (loading || categories.length > 0) && (
        <section className="s7-seccao" aria-labelledby="s7-categorias-titulo">
          <div className="s7-contentor">
            <div className="s7-seccao__topo">
              <div>
                <h2 id="s7-categorias-titulo">Compre por categoria</h2>
                <p>Muito mais do que livros: a loja Super7 completa, à distância de um clique.</p>
              </div>
              <Link className="s7-ligacao" to="/catalogo">
                Todos os produtos <Icon name="seta" />
              </Link>
            </div>
            <div className="s7-categorias" aria-busy={loading || undefined}>
              {loading
                ? Array.from({ length: 6 }, (_, index) => <div key={index} className="s7-categoria s7-esqueleto" aria-hidden="true" />)
                : categories.map((category) => (
                    <Link
                      key={category.id}
                      className={category.isCabazes ? 's7-categoria s7-categoria--natal' : 's7-categoria'}
                      to={`/catalogo?categoria=${encodeURIComponent(category.slug)}`}
                    >
                      <span className="s7-categoria__ico">
                        <Icon name={category.icon} />
                      </span>
                      <span>
                        <strong>{category.name}</strong>
                        <span>{plural(category.productCount, 'produto', 'produtos')}</span>
                      </span>
                    </Link>
                  ))}
            </div>
          </div>
        </section>
      )}

      {!failed && (loading || featured.length > 0) && (
        <section className="s7-seccao" aria-labelledby="s7-destaques-titulo">
          <div className="s7-contentor">
            <div className="s7-seccao__topo">
              <div>
                <h2 id="s7-destaques-titulo">Destaques da loja</h2>
                <p>Os produtos do dia-a-dia que pode juntar à encomenda.</p>
              </div>
            </div>
            <ProductGrid products={featured} loading={loading} singleRow />
          </div>
        </section>
      )}

      <section className="s7-seccao" id="como-funciona" aria-labelledby="s7-passos-titulo">
        <div className="s7-contentor">
          <div className="s7-seccao__topo">
            <div>
              <h2 id="s7-passos-titulo">Como encomendar</h2>
            </div>
          </div>
          <ol className="s7-passos">
            <li>
              <h3>Escolha os produtos</h3>
              <p>Cabazes de Natal, escoamento e os produtos do dia-a-dia, na quantidade que precisar.</p>
            </li>
            <li>
              <h3>Pague como preferir</h3>
              <p>{capitalise(paymentMethodsSentence(paymentMethods))}.</p>
            </li>
            <li>
              <h3>Levante no posto</h3>
              <p>
                Escolha a loja Super7 e a data.
                {homeDelivery ? ' Se preferir, entregamos na morada que indicar.' : ''}
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section className="s7-seccao" aria-labelledby="s7-lojas-titulo">
        <div className="s7-contentor">
          <div className="s7-lojas">
            <div className="s7-lojas__texto">
              <p className="s7-sobretitulo">
                <Icon name="loja" /> Lojas Super7
              </p>
              <h2 id="s7-lojas-titulo">A loja do seu posto Pumangol, agora também online</h2>
              <p>Cada loja de conveniência Super7 foi desenhada para oferecer:</p>
              <ul className="s7-lojas__lista">
                <li>
                  <Icon name="check" /> Atendimento rápido e acolhedor
                </li>
                <li>
                  <Icon name="check" /> Produtos de qualidade que facilitam o seu dia-a-dia
                </li>
                <li>
                  <Icon name="check" /> Uma experiência que torna cada paragem no posto verdadeiramente positiva
                </li>
              </ul>
              <Link className="s7-btn s7-btn--claro" to="/catalogo">
                Ver todos os produtos
              </Link>
            </div>
            <div className="s7-lojas__fotos">
              <img src={lojaAtendimento} alt="Colaboradora no balcão de uma loja Super7" loading="lazy" width={478} height={318} />
              <img src={lojaLubrificantes} alt="Prateleiras de lubrificantes numa loja Super7" loading="lazy" width={478} height={341} />
              <img src={lojaEquipa} alt="Colaboradora de uma loja Super7" loading="lazy" width={478} height={341} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
