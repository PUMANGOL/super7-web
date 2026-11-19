import { useEffect, useLayoutEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useCampaigns, useCheckoutOptions } from '../../catalog/useStoreSettings';
import { NoticeProvider } from '../../context/NoticeProvider';
import { resolveTemaNatal, TemaNatalContext } from './natal/tema';
import { useCartSync } from '../../hooks/useCartDetail';
import { Footer } from './Footer';
import { Header } from './Header';

/**
 * Ao abrir uma página nova sobe ao topo de imediato; com `#âncora`, desce até ela.
 * Ao voltar atrás (ou avançar) não mexe: o browser repõe a posição em que o cliente estava.
 */
function useScrollOnNavigate() {
  const { pathname, hash } = useLocation();
  const type = useNavigationType();

  useLayoutEffect(() => {
    if (type === 'POP' && !hash) return;
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à mudança de página
  }, [pathname, hash]);
}

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Transição entre páginas com a View Transitions API: os cliques em ligações internas da loja
 * passam por `document.startViewTransition`. A fotografia do cartão clicado viaja para a página
 * do produto. Sem suporte do browser, ou com "reduzir movimento", a navegação é a normal.
 */
function usePageTransitions() {
  const navigate = useNavigate();

  useEffect(() => {
    const doc = document as ViewTransitionDocument;
    if (!doc.startViewTransition) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (reduced.matches) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute('download') || !anchor.closest('.s7-loja')) return;
      // Ligação que neste toque só abre um cartão (cabazes do hero): o componente trata o clique.
      if (anchor.hasAttribute('data-s7-segurar')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith('/backoffice') || url.pathname === '/login') return;
      // Mesma página (só muda a âncora ou os filtros): navegação normal, sem transição.
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();

      // Fotografia partilhada: do cartão para o detalhe (se a página actual não for já um detalhe).
      const photo = anchor
        .closest('.s7-produto, .s7-cabaz, .s7-hero__cabaz')
        ?.querySelector<HTMLElement>('.s7-produto__media > img, .s7-cabaz__media > img, .s7-hero__cabaz img');
      if (photo && url.pathname.startsWith('/produto/') && !document.querySelector('.s7-detalhe__media')) {
        photo.style.viewTransitionName = 's7-foto';
      }

      try {
        doc.startViewTransition!(() => {
          flushSync(() => navigate(url.pathname + url.search + url.hash));
        });
      } catch {
        navigate(url.pathname + url.search + url.hash);
      }
    };

    // Fase de captura: corre antes do <Link> do React Router, que respeita o preventDefault.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);
}

function StoreShell() {
  useCartSync();
  useScrollOnNavigate();
  usePageTransitions();
  const { search } = useLocation();
  const natalActive = useCampaigns().isActive('natal');
  const setting = useCheckoutOptions().options.christmasTheme;
  const temaNatal = useMemo(() => resolveTemaNatal(natalActive, setting, search), [natalActive, setting, search]);

  return (
    <TemaNatalContext.Provider value={temaNatal}>
      <div className={temaNatal ? 's7-loja s7-loja--natal' : 's7-loja'}>
        <a className="s7-saltar" href="#conteudo">
          Saltar para o conteúdo
        </a>
        <Header />
        <Outlet />
        <Footer />
      </div>
    </TemaNatalContext.Provider>
  );
}

/** Layout das páginas públicas da loja (cabeçalho, conteúdo, rodapé e avisos). */
export function StoreLayout() {
  return (
    <NoticeProvider>
      <StoreShell />
    </NoticeProvider>
  );
}
