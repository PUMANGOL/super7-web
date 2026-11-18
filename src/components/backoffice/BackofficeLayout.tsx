import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
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
      { to: '/backoffice/definicoes', label: 'Definições da loja', icon: Settings, permission: 'viewSettings' },
      { to: '/backoffice/aparencia', label: 'Aparência', icon: Palette, permission: 'manageSettings' },
    ],
  },
];

/** Abaixo desta largura o menu lateral sai de lado (por cima do conteúdo) em vez de encolher. */
const NARROW_SCREEN = '(max-width: 1024px)';

/** Preferências do menu deste browser: encolhido (só ícones) e grupos fechados. */
const MENU_STORAGE_KEY = 's7-backoffice-menu';

interface MenuPrefs {
  collapsed: boolean;
  closedGroups: string[];
}

function readMenuPrefs(): MenuPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(MENU_STORAGE_KEY) ?? 'null') as Partial<MenuPrefs> | null;
    return {
      collapsed: saved?.collapsed === true,
      closedGroups: Array.isArray(saved?.closedGroups) ? saved.closedGroups.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return { collapsed: false, closedGroups: [] };
  }
}

function writeMenuPrefs(prefs: MenuPrefs) {
  try {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* Sem armazenamento: as preferências valem só nesta visita. */
  }
}

/** Base do People Connect: barra verde no topo, menu lateral escuro com grupos e conteúdo em fundo claro. */
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
  const [prefs, setPrefs] = useState(readMenuPrefs);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const iconsOnly = prefs.collapsed && !narrow;
  const menuVisible = narrow ? drawerOpen : !prefs.collapsed;

  const updatePrefs = (next: MenuPrefs) => {
    setPrefs(next);
    writeMenuPrefs(next);
  };

  const toggleMenu = () => {
    if (narrow) setDrawerOpen((open) => !open);
    else updatePrefs({ ...prefs, collapsed: !prefs.collapsed });
  };

  const toggleGroup = (id: string) =>
    updatePrefs({
      ...prefs,
      closedGroups: prefs.closedGroups.includes(id)
        ? prefs.closedGroups.filter((group) => group !== id)
        : [...prefs.closedGroups, id],
    });

  // Menu aberto no telemóvel: Esc fecha-o e a página por baixo não desliza.
  useEffect(() => {
    if (!narrow || !drawerOpen) return;
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
  }, [narrow, drawerOpen]);

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

  return (
    <div className={`bo${iconsOnly ? ' bo--recolhido' : ''}${narrow && drawerOpen ? ' bo--menu-aberto' : ''}`}>
      <a className="bo-saltar" href="#bo-conteudo">
        Saltar para o conteúdo
      </a>

      <header className="bo-topo">
        <Link to="/" className="bo-topo__logo" title="Abrir a loja Super7 Digital">
          <img src={logoSuper7Branco} alt="Super7" width={446} height={160} />
        </Link>

        <button
          type="button"
          className="bo-topo__menu"
          onClick={toggleMenu}
          aria-controls="bo-menu"
          aria-expanded={menuVisible}
          aria-label={menuVisible ? 'Esconder o menu' : 'Mostrar o menu'}
          title={menuVisible ? 'Esconder o menu' : 'Mostrar o menu'}
        >
          <Menu size={22} aria-hidden="true" />
        </button>

        <Link to="/backoffice" className="bo-app">
          <span className="bo-app__icone" aria-hidden="true">
            <Store size={18} />
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
              <Search size={20} aria-hidden="true" />
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
              <Search size={22} aria-hidden="true" />
            </Link>
          )}
          <Link to="/" className="bo-topo__icone" title="Abrir a loja" aria-label="Abrir a loja">
            <Store size={22} aria-hidden="true" />
          </Link>
          {can('manageSettings') && (
            <Link
              to="/backoffice/aparencia"
              className="bo-topo__icone"
              title="Aparência do back-office"
              aria-label="Aparência do back-office"
            >
              <Palette size={22} aria-hidden="true" />
            </Link>
          )}
          <BackofficeUserMenu />
        </div>
      </header>

      <aside id="bo-menu" className="bo-menu" aria-label="Menu do back-office">
        <nav className="bo-menu__nav">
          {groups.map((group) => {
            const closed = !iconsOnly && prefs.closedGroups.includes(group.id);
            return (
              <div key={group.id} className="bo-grupo">
                <button
                  type="button"
                  className="bo-grupo__titulo"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={!closed}
                  aria-controls={`bo-grupo-${group.id}`}
                >
                  <span>{group.label}</span>
                  <ChevronDown size={16} className="bo-grupo__seta" aria-hidden="true" />
                </button>
                <ul id={`bo-grupo-${group.id}`} className="bo-grupo__itens" hidden={closed}>
                  {group.items.map(({ to, label, icon: Icon }) => (
                    <li key={to}>
                      <NavLink
                        to={to}
                        className="bo-item"
                        title={iconsOnly ? label : undefined}
                        onClick={() => setDrawerOpen(false)}
                      >
                        <Icon size={20} aria-hidden="true" />
                        <span className="bo-item__texto">{label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="bo-menu__fim">
          <button
            type="button"
            className="bo-item"
            onClick={logout}
            title={iconsOnly ? 'Terminar sessão' : undefined}
          >
            <LogOut size={20} aria-hidden="true" />
            <span className="bo-item__texto">Terminar sessão</span>
          </button>
        </div>
      </aside>

      {narrow && drawerOpen && <div className="bo-veu" aria-hidden="true" onClick={() => setDrawerOpen(false)} />}

      <main id="bo-conteudo" className="bo-conteudo" tabIndex={-1}>
        {current && current.to !== '/backoffice/painel' && (
          <nav className="bo-trilho" aria-label="Localização">
            <Link to="/backoffice">Back-office</Link>
            <span aria-hidden="true">/</span>
            {location.pathname === current.to ? (
              <span aria-current="page">{current.label}</span>
            ) : (
              <Link to={current.to}>{current.label}</Link>
            )}
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
