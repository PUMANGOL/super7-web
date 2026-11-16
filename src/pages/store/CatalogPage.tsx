import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isSortKey, paginate, queryProducts, SORT_OPTIONS, type SortKey } from '../../catalog/query';
import { useCatalog } from '../../catalog/useCatalog';
import { Breadcrumbs, CatalogError, EmptyState } from '../../components/store/Feedback';
import { Icon } from '../../components/store/Icon';
import { Pagination } from '../../components/store/Pagination';
import { ProductGrid } from '../../components/store/ProductCard';
import { CAMPAIGN_IDS, isCampaignId, STORE } from '../../config/store';
import { useCampaigns } from '../../catalog/useStoreSettings';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatKz } from '../../utils/format';

const NARROW_QUERY = '(max-width: 960px)';
const DEFAULT_DESCRIPTION = 'A loja Super7 completa, com levantamento no posto Pumangol que escolher.';

/** Filtro de preço: mexe localmente e só actualiza a URL quando se larga o cursor. */
function PriceFilter({ value, ceiling, onCommit }: { value: number; ceiling: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value);
  const step = ceiling > 20000 ? 1000 : 500;
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <div>
      <label className="s7-sr" htmlFor="s7-preco-max">
        Preço máximo em kwanzas
      </label>
      <input
        type="range"
        id="s7-preco-max"
        min={step}
        max={ceiling}
        step={step}
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <p className="s7-filtros__preco">
        <span>Até</span>
        <output htmlFor="s7-preco-max">{formatKz(draft)}</output>
      </p>
    </div>
  );
}

function useFiltersOpen() {
  const [open, setOpen] = useState(() => !window.matchMedia(NARROW_QUERY).matches);

  // Em ecrãs pequenos os filtros começam recolhidos.
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = (event: MediaQueryListEvent) => setOpen(!event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return [open, setOpen] as const;
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const catalog = useCatalog();
  const data = catalog.data;
  const [filtersOpen, setFiltersOpen] = useFiltersOpen();
  const { campaigns: CAMPAIGNS, isActive } = useCampaigns();

  /* Estado lido da URL (partilhável): ?campanha=&categoria=&q=&precoMax=&emStock=1&ordenar=&pagina= */
  const campaignParam = params.get('campanha');
  const campaign = isCampaignId(campaignParam) ? campaignParam : null;
  const categorySlug = params.get('categoria') ?? '';
  const category = data?.categoryBySlug.get(categorySlug) ?? null;
  const q = params.get('q')?.trim() ?? '';
  const ceiling = data?.priceCeiling ?? 0;
  const maxPriceParam = Number(params.get('precoMax')) || 0;
  const maxPrice = maxPriceParam > 0 && maxPriceParam < ceiling ? maxPriceParam : null;
  const inStock = params.get('emStock') === '1';
  const sortParam = params.get('ordenar');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'relevancia';
  const requestedPage = Number(params.get('pagina')) || 1;

  const results = useMemo(
    () =>
      data
        ? queryProducts(data.products, {
            campaign,
            categorySlug: category?.slug ?? null,
            q,
            maxPrice,
            inStock,
            sort,
          })
        : [],
    [data, campaign, category, q, maxPrice, inStock, sort],
  );
  const page = paginate(results, requestedPage, STORE.pageSize);

  const update = (changes: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (!keepPage) next.delete('pagina');
    setParams(next, { replace: true });
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    if (sort !== 'relevancia') next.set('ordenar', sort);
    setParams(next, { replace: true });
  };

  const goToPage = (target: number) => {
    update({ pagina: target > 1 ? String(target) : null }, true);
    document.getElementById('conteudo')?.scrollIntoView();
  };

  /* Títulos */
  let title = 'Todos os produtos';
  let description = DEFAULT_DESCRIPTION;
  if (q) {
    title = `Resultados para “${q}”`;
    description = '';
  } else if (category) {
    title = category.name;
    description = category.description;
  } else if (campaign) {
    title = CAMPAIGNS[campaign].label;
    description = CAMPAIGNS[campaign].description;
  }
  useDocumentTitle(title);

  const theme = campaign ? CAMPAIGNS[campaign] : null;
  const visibleCampaigns = CAMPAIGN_IDS.filter((id) => isActive(id) || id === campaign);
  const hasFilters = Boolean(campaign || category || q || maxPrice || inStock);

  return (
    <main id="conteudo" className="s7-contentor">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: title }]} />

      {theme && (
        <div className={campaign === 'escoamento' ? 's7-tema s7-tema--escoamento' : 's7-tema'}>
          <div className="s7-tema__texto">
            <Icon name={campaign === 'escoamento' ? 'tag' : 'gift'} />
            <p>
              <strong>{theme.name}</strong>
              <span>{theme.tagline}</span>
            </p>
          </div>
        </div>
      )}

      <div className="s7-pagina-titulo">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>

      <div className="s7-catalogo">
        <details className="s7-filtros" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
          <summary>
            <Icon name="filtro" /> Filtros
          </summary>
          <form aria-label="Filtrar produtos" onSubmit={(event) => event.preventDefault()}>
            {visibleCampaigns.length > 0 && (
              <fieldset className="s7-filtros__grupo">
                <legend>Campanha</legend>
                <div>
                  <label className="s7-filtro">
                    <input type="radio" name="campanha" checked={!campaign} onChange={() => update({ campanha: null })} />
                    <span>Todas</span>
                  </label>
                  {visibleCampaigns.map((id) => (
                    <label className="s7-filtro" key={id}>
                      <input type="radio" name="campanha" checked={campaign === id} onChange={() => update({ campanha: id })} />
                      <span>{CAMPAIGNS[id].label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="s7-filtros__grupo">
              <legend>Categoria</legend>
              <div>
                <label className="s7-filtro">
                  <input type="radio" name="categoria" checked={!category} onChange={() => update({ categoria: null })} />
                  <span>Todas</span>
                </label>
                {(data?.categories ?? []).map((item) => (
                  <label className="s7-filtro" key={item.id}>
                    <input
                      type="radio"
                      name="categoria"
                      checked={category?.id === item.id}
                      onChange={() => update({ categoria: item.slug })}
                    />
                    <span>{item.name}</span>
                    <span>{item.productCount}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {ceiling > 0 && (
              <fieldset className="s7-filtros__grupo">
                <legend>Preço máximo</legend>
                <PriceFilter
                  key={`${maxPrice ?? ceiling}-${ceiling}`}
                  value={maxPrice ?? ceiling}
                  ceiling={ceiling}
                  onCommit={(value) => update({ precoMax: value < ceiling ? String(value) : null })}
                />
              </fieldset>
            )}

            <fieldset className="s7-filtros__grupo">
              <legend>Disponibilidade</legend>
              <div>
                <label className="s7-filtro">
                  <input
                    type="checkbox"
                    name="emStock"
                    checked={inStock}
                    onChange={(event) => update({ emStock: event.target.checked ? '1' : null })}
                  />
                  <span>Só produtos em stock</span>
                </label>
              </div>
            </fieldset>

            <div className="s7-filtros__limpar">
              <button type="button" className="s7-btn s7-btn--contorno s7-btn--bloco" disabled={!hasFilters} onClick={resetFilters}>
                Limpar filtros
              </button>
            </div>
          </form>
        </details>

        <div>
          <div className="s7-barra">
            <p className="s7-barra__total" aria-live="polite">
              {catalog.isLoading ? (
                'A carregar produtos…'
              ) : (
                <>
                  <b>{page.total}</b> {page.total === 1 ? 'produto' : 'produtos'}
                </>
              )}
            </p>
            <label className="s7-barra__ordenar" htmlFor="s7-ordenar">
              Ordenar por
              <select
                className="s7-seleccao"
                id="s7-ordenar"
                value={sort}
                onChange={(event) => update({ ordenar: event.target.value === 'relevancia' ? null : event.target.value })}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {catalog.isError ? (
            <CatalogError onRetry={() => catalog.refetch()} />
          ) : catalog.isLoading ? (
            <ProductGrid products={[]} loading skeletons={8} />
          ) : page.total === 0 ? (
            <EmptyState
              icon="pesquisa"
              title="Não encontrámos produtos"
              action={
                <Link className="s7-btn s7-btn--primario" to="/catalogo">
                  Ver todos os produtos
                </Link>
              }
            >
              Experimente outra pesquisa ou limpe os filtros para ver a loja completa.
            </EmptyState>
          ) : (
            <>
              <ProductGrid products={page.items} />
              <Pagination page={page.page} pages={page.pages} onChange={goToPage} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
