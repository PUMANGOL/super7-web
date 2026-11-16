import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { inCampaign } from '../../catalog/query';
import { useCatalog } from '../../catalog/useCatalog';
import { useCampaigns } from '../../catalog/useStoreSettings';
import { useCart } from '../../context/cart';
import { plural } from '../../utils/format';
import { Icon } from './Icon';

export function Logo({ light = false }: { light?: boolean }) {
  // Logótipo tipográfico provisório: substituir pelo SVG oficial do Super7.
  return (
    <Link className={light ? 's7-logo s7-logo--claro' : 's7-logo'} to="/" aria-label="Super7 Digital, página inicial">
      <span className="s7-logo__marca">
        SUPER<b>7</b>
      </span>
      <span className="s7-logo__digital">digital</span>
    </Link>
  );
}

function CampaignBand() {
  const { campaigns: CAMPAIGNS, isActive } = useCampaigns();
  const natal = isActive('natal');
  const escoamento = isActive('escoamento');

  return (
    <div className="s7-faixa">
      <div className="s7-contentor s7-faixa__in">
        <p>
          <Icon name={natal ? 'gift' : 'tag'} />
          {natal ? (
            <span>
              <strong>{CAMPAIGNS.natal.name}</strong> ·{' '}
              <Link to="/catalogo?campanha=natal">Cabazes de Natal prontos a oferecer</Link>
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
          <span>Levante a encomenda na loja Super7 do seu posto Pumangol</span>
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
        placeholder="Pesquisar cabazes, bebidas, snacks…"
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

export function Header() {
  const headerRef = useRef<HTMLElement>(null);
  useHideOnScroll(headerRef);
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
  const escoamentoActive =
    isActive('escoamento') && (!catalog || catalog.products.some((product) => inCampaign(product, 'escoamento')));
  // O link "Cabazes de Natal" já cobre a categoria dos cabazes.
  const categories = (catalog?.categories ?? []).filter((category) => !(natalActive && category.isCabazes));

  return (
    <>
      <CampaignBand />
      <header className="s7-cabecalho" ref={headerRef}>
        <div className="s7-contentor s7-cabecalho__in">
          <Logo />
          <SearchForm key={q} initial={q} />
          <div className="s7-cabecalho__accoes">
            <Link className="s7-accao" to="/encomenda">
              <Icon name="recibo" />
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
          <div className="s7-contentor s7-nav__in">
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
        </nav>
      </header>
    </>
  );
}
