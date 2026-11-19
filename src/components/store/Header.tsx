import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoSuper7 from '../../assets/img/logo-super7.webp';
import logoSuper7Branco from '../../assets/img/logo-super7-branco.webp';
import { inCampaign } from '../../catalog/query';
import { useStoreCopy } from '../../catalog/storeCopy';
import { useCatalog } from '../../catalog/useCatalog';
import { useCampaigns } from '../../catalog/useStoreSettings';
import { useCart } from '../../context/cart';
import { plural } from '../../utils/format';
import { Icon } from './Icon';
import { Azevinho, Gorro } from './natal/Aderecos';
import { useTemaNatal } from './natal/tema';

/**
 * Logótipo oficial do Super7 (versão branca, `light`, para fundos escuros) seguido de "digital".
 * `hat`: gorro do Pai Natal no "S" (tema de Natal).
 */
export function Logo({ light = false, hat = false }: { light?: boolean; hat?: boolean }) {
  return (
    <Link className={light ? 's7-logo s7-logo--claro' : 's7-logo'} to="/" aria-label="Super7 Digital, página inicial">
      <img className="s7-logo__img" src={light ? logoSuper7Branco : logoSuper7} alt="" width={446} height={160} />
      <span className="s7-logo__digital">digital</span>
      {hat && <Gorro className="s7-logo__gorro" />}
    </Link>
  );
}

function CampaignBand() {
  const { campaigns: CAMPAIGNS, isActive } = useCampaigns();
  const natal = isActive('natal');
  const escoamento = isActive('escoamento');
  const copy = useStoreCopy();

  return (
    <div className="s7-faixa">
      <div className="s7-contentor s7-faixa__in">
        <p>
          <Icon name={natal ? 'gift' : 'tag'} />
          {natal ? (
            <span>
              <strong>{CAMPAIGNS.natal.name}</strong> ·{' '}
              <Link to="/catalogo?campanha=natal">Cestas de Natal prontas a oferecer</Link>
            </span>
          ) : escoamento ? (
            <span>
              <strong>{CAMPAIGNS.escoamento.label}</strong> ·{' '}
              <Link to="/catalogo?campanha=escoamento">{CAMPAIGNS.escoamento.tagline}</Link>
            </span>
          ) : (
            <span>
              <strong>Super7 Digital</strong> · A loja online das lojas Super7
            </span>
          )}
        </p>
        <p className="s7-faixa__dir">
          <Icon name="pin" />
          <span>
            Levante a encomenda{' '}
            {copy.fixedPickup ? copy.pickupPlace : 'na loja Super7 do seu posto Pumangol'}
            {copy.homeDelivery ? ' ou receba-a em casa' : ''}
          </span>
        </p>
      </div>
    </div>
  );
}

function SearchForm({ initial }: { initial: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    navigate(q ? `/catalogo?q=${encodeURIComponent(q)}` : '/catalogo');
  };

  return (
    <form className="s7-pesquisa" role="search" onSubmit={submit}>
      <label className="s7-sr" htmlFor="s7-q">
        Pesquisar produtos
      </label>
      <input
        id="s7-q"
        name="q"
        type="search"
        placeholder="Pesquisar cestas, bebidas, snacks…"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" aria-label="Pesquisar">
        <Icon name="pesquisa" />
      </button>
    </form>
  );
}

/**
 * Marca o cabeçalho com `data-escondido` enquanto o cliente desce a página e tira a marca quando sobe.
 * O CSS (super7-ajustes.css) só o esconde em telemóvel; no computador fica sempre visível.
 * Nunca se esconde com o foco lá dentro (pesquisa a ser escrita, navegação por teclado).
 */
function useHideOnScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    let last = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) < 8 && y > 0) return;
      last = y;
      const hide = delta > 0 && y > 240 && !header.contains(document.activeElement);
      header.toggleAttribute('data-escondido', hide);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onFocus = () => header.removeAttribute('data-escondido');

    window.addEventListener('scroll', onScroll, { passive: true });
    header.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', onFocus);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** Largura das setas (com o esbatido) que tapam as pontas do menu de categorias. */
const NAV_ARROW_WIDTH = 64;

/**
 * Setas do menu de categorias: indica de que lado há categorias escondidas (quando não cabem na largura)
 * e desliza o menu uma "página" de cada vez. Mede de novo ao deslizar, ao mudar a largura do ecrã e
 * quando a lista muda (categorias carregadas, letra descarregada).
 */
function useNavArrows(scrollerRef: RefObject<HTMLElement | null>, listRef: RefObject<HTMLElement | null>) {
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const scroller = scrollerRef.current;
    const list = listRef.current;
    if (!scroller || !list) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const max = scroller.scrollWidth - scroller.clientWidth;
      const start = scroller.scrollLeft > 1;
      const end = scroller.scrollLeft < max - 1;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);
    observer.observe(list);
    scroller.addEventListener('scroll', schedule, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
    };
  }, [scrollerRef, listRef]);

  const scrollPage = (direction: 1 | -1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const step = Math.max(scroller.clientWidth - 2 * NAV_ARROW_WIDTH, 120);
    scroller.scrollBy({ left: direction * step, behavior: scrollBehavior() });
  };

  return { ...edges, scrollPage };
}

export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  const navScrollerRef = useRef<HTMLDivElement>(null);
  const navListRef = useRef<HTMLDivElement>(null);
  useHideOnScroll(headerRef);
  const navArrows = useNavArrows(navScrollerRef, navListRef);
  const location = useLocation();
  const { units } = useCart();
  const { data: catalog } = useCatalog();
  const { campaigns: CAMPAIGNS, isActive } = useCampaigns();
  const params = new URLSearchParams(location.search);
  const onCatalog = location.pathname === '/catalogo';
  const q = onCatalog ? params.get('q') ?? '' : '';

  const isCurrent = (category = '', campaign = '') =>
    onCatalog &&
    (params.get('categoria') ?? '') === category &&
    (params.get('campanha') ?? '') === campaign &&
    !params.get('q');

  const current = (active: boolean) => (active ? ('page' as const) : undefined);
  // Uma campanha activa só aparece no menu se tiver produtos (enquanto o catálogo carrega, aparece).
  const natalActive = isActive('natal') && (!catalog || catalog.products.some((product) => inCampaign(product, 'natal')));
  const temaNatal = useTemaNatal();
  const escoamentoActive =
    isActive('escoamento') && (!catalog || catalog.products.some((product) => inCampaign(product, 'escoamento')));
  // O link "Cestas de Natal" já cobre a categoria das cestas.
  const categories = (catalog?.categories ?? []).filter((category) => !(natalActive && category.isCabazes));

  // A categoria aberta fica à vista no menu e fora das setas (ex.: link partilhado para uma categoria do fim).
  useEffect(() => {
    const scroller = navScrollerRef.current;
    const active = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !active) return;
    const box = scroller.getBoundingClientRect();
    const link = active.getBoundingClientRect();
    const delta =
      link.left < box.left + NAV_ARROW_WIDTH
        ? link.left - box.left - NAV_ARROW_WIDTH
        : link.right > box.right - NAV_ARROW_WIDTH
          ? link.right - box.right + NAV_ARROW_WIDTH
          : 0;
    if (delta) scroller.scrollBy({ left: delta, behavior: scrollBehavior() });
  }, [location.pathname, location.search, categories.length]);

  return (
    <>
      <CampaignBand />
      <header className="s7-cabecalho" ref={headerRef}>
        <div className="s7-contentor s7-cabecalho__in">
          <Logo hat={temaNatal} />
          <SearchForm key={q} initial={q} />
          <div className="s7-cabecalho__accoes">
            <Link className="s7-accao" to="/encomenda">
              {temaNatal ? (
                <span className="s7-accao__ico">
                  <Icon name="recibo" />
                  <Azevinho className="s7-accao__azevinho" />
                </span>
              ) : (
                <Icon name="recibo" />
              )}
              <span>Encomendas</span>
            </Link>
            <Link
              className="s7-accao s7-accao--carrinho"
              to="/carrinho"
              aria-label={`Carrinho, ${plural(units, 'artigo', 'artigos')}`}
            >
              <Icon name="carrinho" />
              <span>Carrinho</span>
              {units > 0 && (
                <b className="s7-accao__qtd" key={units}>
                  {units}
                </b>
              )}
            </Link>
          </div>
        </div>

        <nav className="s7-nav" aria-label="Categorias">
          <div className="s7-contentor s7-nav__caixa">
            <div className="s7-nav__in" ref={navScrollerRef}>
              <div className="s7-nav__lista" ref={navListRef}>
                {natalActive && (
                  <Link
                    className="s7-nav__link s7-nav__link--natal"
                    to="/catalogo?campanha=natal"
                    aria-current={current(isCurrent('', 'natal'))}
                  >
                    <Icon name="gift" /> {CAMPAIGNS.natal.label}
                  </Link>
                )}
                {escoamentoActive && (
                  <Link
                    className="s7-nav__link s7-nav__link--escoamento"
                    to="/catalogo?campanha=escoamento"
                    aria-current={current(isCurrent('', 'escoamento'))}
                  >
                    <Icon name="tag" /> {CAMPAIGNS.escoamento.label}
                  </Link>
                )}
                {(natalActive || escoamentoActive) && <span className="s7-nav__sep" aria-hidden="true" />}
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    className="s7-nav__link"
                    to={`/catalogo?categoria=${encodeURIComponent(category.slug)}`}
                    aria-current={current(isCurrent(category.slug))}
                  >
                    {category.name}
                  </Link>
                ))}
                <Link className="s7-nav__link" to="/catalogo" aria-current={current(isCurrent())}>
                  Todos os produtos
                </Link>
              </div>
            </div>
            {/* Só para o rato: com o teclado, o browser desliza o menu até à ligação com o foco,
                e o leitor de ecrã lê a lista toda. */}
            {navArrows.start && (
              <button
                type="button"
                className="s7-nav__seta s7-nav__seta--esq"
                tabIndex={-1}
                aria-hidden="true"
                title="Categorias anteriores"
                onClick={() => navArrows.scrollPage(-1)}
              >
                <span>
                  <Icon name="chevron-esq" />
                </span>
              </button>
            )}
            {navArrows.end && (
              <button
                type="button"
                className="s7-nav__seta s7-nav__seta--dir"
                tabIndex={-1}
                aria-hidden="true"
                title="Mais categorias"
                onClick={() => navArrows.scrollPage(1)}
              >
                <span>
                  <Icon name="chevron" />
                </span>
              </button>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
