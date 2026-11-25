import { Fragment, Suspense, useEffect, useState, type FormEvent } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import logoSuper7Branco from '../../assets/img/logo-super7-branco.webp';
import { useAuth } from '../../context/auth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Permission } from '../../utils/auth';
import { BackofficeUserMenu } from './BackofficeUserMenu';
import { setMenuGroupOpen, updateMenuPreferences, useMenuPreferences } from './menuPreferences';
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
  {
    id: 'administracao',
    label: 'Administração',
    items: [
      { to: '/backoffice/utilizadores', label: 'Utilizadores', icon: Users, permission: 'manageUsers' },
      { to: '/backoffice/permissoes', label: 'Perfis e permissões', icon: ShieldCheck, permission: 'manageUsers' },
    ],
  },
];

/** Abaixo desta largura o menu sai de lado (por cima do conteúdo), seja qual for a disposição escolhida. */
const NARROW_SCREEN = '(max-width: 1024px)';

/**
 * Base do People Connect: barra verde no topo e o conteúdo em fundo claro. O menu fica à esquerda (por omissão),
 * com os grupos recolhíveis e a opção de mostrar só os ícones, ou numa barra horizontal por baixo do topo; cada
 * pessoa escolhe no menu da conta.
 */
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
  const preferences = useMenuPreferences();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const menuOpen = narrow && drawerOpen;
  const lateral = preferences.layout === 'lateral';
  /** Grupos em coluna, com o título que os abre e fecha: menu lateral e menu do telemóvel. */
  const vertical = lateral || narrow;
  /** Menu lateral só com os ícones. */
  const compact = lateral && preferences.compact && !narrow;

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
  const currentGroupId = groups.find((group) => current && group.items.includes(current))?.id;

  // No ecrã largo, o botão do topo recolhe o menu lateral aos ícones; no estreito, abre e fecha o menu.
  const toggleMenu = () => {
    if (narrow) setDrawerOpen((open) => !open);
    else updateMenuPreferences({ compact: !preferences.compact });
  };
  const menuButtonLabel = narrow
    ? menuOpen
      ? 'Fechar o menu'
      : 'Abrir o menu'
    : compact
      ? 'Mostrar os nomes do menu'
      : 'Recolher o menu aos ícones';

  // Menu só com ícones: o nome da página aparece ao lado, ao passar o rato ou com o teclado.
  const showTip = (label: string) => (event: { currentTarget: HTMLElement }) => {
    if (!compact) return;
    const box = event.currentTarget.getBoundingClientRect();
    setTip({ label, top: box.top + box.height / 2, left: box.right + 10 });
  };
  const hideTip = () => setTip(null);

  const searchOrders = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    navigate(term ? `/backoffice/encomendas?q=${encodeURIComponent(term)}` : '/backoffice/encomendas');
    setQuery('');
    setDrawerOpen(false);
  };

  const canSearch = can('viewOrders');
  const subPage = current && location.pathname !== current.to;

  const shellClass = [
    'bo',
    lateral ? 'bo--lateral' : 'bo--horizontal',
    compact && 'bo--compacto',
    menuOpen && 'bo--menu-aberto',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      <a className="bo-saltar" href="#bo-conteudo">
        Saltar para o conteúdo
      </a>

      <header className="bo-cabecalho">
        <div className="bo-topo">
          <button
            type="button"
            className="bo-topo__menu"
            onClick={toggleMenu}
            aria-controls="bo-menu"
            aria-expanded={narrow ? menuOpen : !compact}
            aria-label={menuButtonLabel}
            title={narrow ? undefined : menuButtonLabel}
          >
            {narrow ? (
              menuOpen ? (
                <X size={20} aria-hidden="true" />
              ) : (
                <Menu size={20} aria-hidden="true" />
              )
            ) : compact ? (
              <PanelLeftOpen size={19} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={19} aria-hidden="true" />
            )}
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

        <nav
          id="bo-menu"
          className={`bo-menu${vertical ? ' bo-menu--vertical' : ''}`}
          aria-label="Menu do back-office"
          onScroll={hideTip}
        >
          <ul className="bo-menu__lista">
            {groups.map((group, index) => {
              const hasCurrent = group.id === currentGroupId;
              // Fechados por omissão, excepto o da página actual; a escolha de cada pessoa fica guardada.
              const open = !vertical || compact || (preferences.groups[group.id] ?? hasCurrent);
              const panelId = `bo-grupo-${group.id}`;
              return (
                <Fragment key={group.id}>
                  {index > 0 && (!vertical || compact) && <li className="bo-menu__divisor" aria-hidden="true" />}
                  <li className={`bo-menu__grupo${hasCurrent ? ' bo-menu__grupo--actual' : ''}`}>
                    {vertical && !compact && (
                      <button
                        type="button"
                        className="bo-menu__titulo"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => setMenuGroupOpen(group.id, !open)}
                      >
                        <span className="bo-menu__titulo-texto">{group.label}</span>
                        {hasCurrent && !open && (
                          <span className="bo-menu__marca">
                            <span className="sr-only">(tem a página aberta)</span>
                          </span>
                        )}
                        <ChevronDown size={15} className="bo-menu__seta" aria-hidden="true" />
                      </button>
                    )}
                    <div id={panelId} className="bo-menu__painel" data-aberto={open} inert={!open}>
                      <ul className="bo-menu__itens" aria-label={compact ? group.label : undefined}>
                        {group.items.map(({ to, label, icon: Icon }) => (
                          <li key={to}>
                            <NavLink
                              to={to}
                              className="bo-item"
                              onClick={() => {
                                setDrawerOpen(false);
                                hideTip();
                              }}
                              onMouseEnter={showTip(label)}
                              onMouseLeave={hideTip}
                              onFocus={showTip(label)}
                              onBlur={hideTip}
                            >
                              <Icon size={compact ? 18 : 16} aria-hidden="true" />
                              <span className="bo-item__texto">{label}</span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ul>
          <button type="button" className="bo-item bo-menu__sair" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            <span>Terminar sessão</span>
          </button>
        </nav>
      </header>

      {menuOpen && <div className="bo-veu" aria-hidden="true" onClick={() => setDrawerOpen(false)} />}

      {compact && tip && (
        <span className="bo-dica" style={{ top: tip.top, left: tip.left }} aria-hidden="true">
          {tip.label}
        </span>
      )}

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
