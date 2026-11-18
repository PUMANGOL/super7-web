import { Fragment, Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Palette,
  Search,
  Settings,
  ShoppingBag,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react';
import logoSuper7Branco from '../../assets/img/logo-super7-branco.webp';
import { useAuth } from '../../context/auth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Permission } from '../../utils/auth';
import { BackofficeUserMenu } from './BackofficeUserMenu';
import { BackofficeThemeProvider } from './theme/BackofficeThemeProvider';
import { useBackofficeLogout } from './useBackofficeLogout';
import './BackofficeLayout.css';
import '../../pages/BackofficePage.css';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'geral',
    label: 'Geral',
    items: [
      { to: '/backoffice/painel', label: 'Painel', icon: LayoutDashboard, permission: 'viewDashboard' },
      { to: '/backoffice/encomendas', label: 'Encomendas', icon: Package, permission: 'viewOrders' },
    ],
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    items: [
      { to: '/backoffice/produtos', label: 'Produtos', icon: ShoppingBag, permission: 'manageCatalog' },
      { to: '/backoffice/livros', label: 'Livros', icon: BookOpen, permission: 'manageCatalog' },
      { to: '/backoffice/categorias', label: 'Categorias', icon: FolderOpen, permission: 'manageCatalog' },
    ],
  },
  {
    id: 'loja',
    label: 'Loja',
    items: [
      { to: '/backoffice/postos', label: 'Lojas de levantamento', icon: MapPin, permission: 'manageCatalog' },
      { to: '/backoffice/definicoes', label: 'Definições', icon: Settings, permission: 'viewSettings' },
      { to: '/backoffice/aparencia', label: 'Aparência', icon: Palette, permission: 'manageSettings' },
    ],
  },
];

/** Abaixo desta largura o menu sai de lado (por cima do conteúdo) em vez de ficar na barra horizontal. */
const NARROW_SCREEN = '(max-width: 1024px)';

/** Base do People Connect: barra verde no topo, barra do menu por baixo e o conteúdo em fundo claro. */
export function BackofficeLayout() {
  return (
    <BackofficeThemeProvider>
      <BackofficeShell />
    </BackofficeThemeProvider>
  );
}

function BackofficeShell() {
  const { can } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useBackofficeLogout();
  const narrow = useMediaQuery(NARROW_SCREEN);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuOpen = narrow && drawerOpen;

  // Menu aberto no telemóvel: Esc fecha-o e a página por baixo não desliza.
  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const groups = NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter(
    (group) => group.items.length > 0,
  );
  const current = groups
    .flatMap((group) => group.items)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  const searchOrders = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/backoffice/encomendas?q=${encodeURIComponent(term)}` : '/backoffice/encomendas');
    setQuery('');
    setDrawerOpen(false);
  };

  const canSearch = can('viewOrders');
  const subPage = current && location.pathname !== current.to;

  return (
    <div className={`bo${menuOpen ? ' bo--menu-aberto' : ''}`}>
      <a className="bo-saltar" href="#bo-conteudo">
        Saltar para o conteúdo
      </a>

      <header className="bo-cabecalho">
        <div className="bo-topo">
          <button
            type="button"
            className="bo-topo__menu"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-controls="bo-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Fechar o menu' : 'Abrir o menu'}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>

          <Link to="/" className="bo-topo__logo" title="Abrir a loja Super7 Digital">
            <img src={logoSuper7Branco} alt="Super7" width={446} height={160} />
          </Link>

          <Link to="/backoffice" className="bo-app">
            <span className="bo-app__icone" aria-hidden="true">
              <Store size={15} />
            </span>
            <strong className="bo-app__nome">Super7 Digital</strong>
            <span className="bo-app__area">Back-office</span>
          </Link>

          {canSearch && (
            <form className="bo-procura" role="search" onSubmit={searchOrders}>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Procurar encomenda"
                aria-label="Procurar encomenda por n.º, referência, cliente, e-mail ou telefone"
                enterKeyHint="search"
              />
              <button type="submit" aria-label="Procurar">
                <Search size={17} aria-hidden="true" />
              </button>
            </form>
          )}

          <div className="bo-topo__accoes">
            {canSearch && (
              <Link
                to="/backoffice/encomendas"
                className="bo-topo__icone bo-topo__icone--procurar"
                title="Procurar encomenda"
                aria-label="Procurar encomenda"
              >
                <Search size={19} aria-hidden="true" />
              </Link>
            )}
            <Link to="/" className="bo-topo__icone" title="Abrir a loja" aria-label="Abrir a loja">
              <Store size={19} aria-hidden="true" />
            </Link>
            {can('manageSettings') && (
              <Link
                to="/backoffice/aparencia"
                className="bo-topo__icone"
                title="Aparência do back-office"
                aria-label="Aparência do back-office"
              >
                <Palette size={19} aria-hidden="true" />
              </Link>
            )}
            <BackofficeUserMenu />
          </div>
        </div>

        <nav id="bo-menu" className="bo-menu" aria-label="Menu do back-office">
          <ul className="bo-menu__lista">
            {groups.map((group, index) => (
              <Fragment key={group.id}>
                {index > 0 && <li className="bo-menu__divisor" aria-hidden="true" />}
                <li className="bo-menu__grupo">
                  <span className="bo-menu__titulo">{group.label}</span>
                  <ul className="bo-menu__itens">
                    {group.items.map(({ to, label, icon: Icon }) => (
                      <li key={to}>
                        <NavLink to={to} className="bo-item" onClick={() => setDrawerOpen(false)}>
                          <Icon size={16} aria-hidden="true" />
                          <span>{label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </li>
              </Fragment>
            ))}
          </ul>
          <button type="button" className="bo-item bo-menu__sair" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            <span>Terminar sessão</span>
          </button>
        </nav>
      </header>

      {menuOpen && <div className="bo-veu" aria-hidden="true" onClick={() => setDrawerOpen(false)} />}

      <main id="bo-conteudo" className="bo-conteudo" tabIndex={-1}>
        {subPage && (
          <nav className="bo-trilho" aria-label="Localização">
            <Link to="/backoffice">Back-office</Link>
            <span aria-hidden="true">/</span>
            <Link to={current.to}>{current.label}</Link>
          </nav>
        )}
        <Suspense
          fallback={
            <div className="backoffice-empty">
              <p>A carregar…</p>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
