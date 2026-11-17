import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, FolderOpen, LayoutDashboard, MapPin, Package, Settings, ShoppingBag } from 'lucide-react';
import logoSuper7 from '../../assets/img/logo-super7.webp';
import { useAuth } from '../../context/auth';
import type { Permission } from '../../utils/auth';
import { BackofficeUserMenu } from './BackofficeUserMenu';
import './BackofficeLayout.css';
import '../../pages/BackofficePage.css';

const navItems: { to: string; label: string; icon: typeof Package; permission: Permission }[] = [
  { to: '/backoffice/painel', label: 'Painel', icon: LayoutDashboard, permission: 'viewDashboard' },
  { to: '/backoffice/encomendas', label: 'Encomendas', icon: Package, permission: 'viewOrders' },
  { to: '/backoffice/produtos', label: 'Produtos', icon: ShoppingBag, permission: 'manageCatalog' },
  { to: '/backoffice/livros', label: 'Livros', icon: BookOpen, permission: 'manageCatalog' },
  { to: '/backoffice/categorias', label: 'Categorias', icon: FolderOpen, permission: 'manageCatalog' },
  { to: '/backoffice/postos', label: 'Lojas de levantamento', icon: MapPin, permission: 'manageCatalog' },
  { to: '/backoffice/definicoes', label: 'Definições da loja', icon: Settings, permission: 'viewSettings' },
];

export function BackofficeLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { can } = useAuth();

  return (
    <div className={`backoffice-layout${collapsed ? ' backoffice-layout--collapsed' : ''}`}>
      <aside className={`backoffice-sidebar${collapsed ? ' backoffice-sidebar--collapsed' : ''}`}>
        <div className="backoffice-sidebar-top">
          <Link to="/" className="backoffice-sidebar-logo" title="Ir para a loja Super7 Digital">
            <img src={logoSuper7} alt="Super7" width={446} height={160} />
          </Link>
          {!collapsed && <p className="backoffice-sidebar-product">Super7 Digital · Back-office</p>}
        </div>

        <nav className="backoffice-sidebar-nav">
          {navItems
            .filter((item) => can(item.permission))
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) => `backoffice-sidebar-link${isActive ? ' backoffice-sidebar-link--active' : ''}`}
              >
                <Icon size={18} />
                <span className="backoffice-sidebar-link-label">{label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="backoffice-sidebar-footer">
          <BackofficeUserMenu collapsed={collapsed} />
        </div>

        <button
          className="backoffice-sidebar-toggle"
          onClick={() => setCollapsed((current) => !current)}
          title={collapsed ? 'Expandir menu' : 'Encolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Encolher menu'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      <div className="backoffice-main">
        <Suspense
          fallback={
            <div className="backoffice-empty">
              <p>A carregar…</p>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
