import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronUp, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import './BackofficeUserMenu.css';

interface BackofficeUserMenuProps {
  collapsed?: boolean;
}

export function BackofficeUserMenu({ collapsed = false }: BackofficeUserMenuProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (!user) return null;

  // Volta ao login (e não à loja): num computador partilhado, a pessoa seguinte entra logo.
  // `replace` impede que o botão "Retroceder" reabra a página do back-office.
  const handleLogout = () => {
    setIsOpen(false);
    logout();
    showToast('Sessão terminada.');
    navigate('/login', { replace: true });
  };

  return (
    <>
      <div className="backoffice-user-menu" ref={menuRef}>
        {isOpen && (
          <div className="backoffice-user-dropdown" role="menu">
            <div className="backoffice-user-dropdown-info">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <div className="backoffice-user-dropdown-divider" role="separator" />
            <Link
              to="/"
              className="backoffice-user-dropdown-item"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              Ir para a loja
            </Link>
          </div>
        )}

        <button
          type="button"
          className={`backoffice-user-trigger${isOpen ? ' backoffice-user-trigger--active' : ''}`}
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          title={collapsed ? user.name : undefined}
        >
          <span className="backoffice-user-trigger-icon" aria-hidden="true">
            <User size={18} />
          </span>
          {!collapsed && (
            <>
              <span className="backoffice-user-trigger-text">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </span>
              <ChevronUp
                size={16}
                className={`backoffice-user-trigger-chevron${isOpen ? ' backoffice-user-trigger-chevron--open' : ''}`}
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </div>

      <button
        type="button"
        className="backoffice-sidebar-link backoffice-sidebar-logout"
        onClick={handleLogout}
        title={collapsed ? 'Terminar sessão' : undefined}
      >
        <LogOut size={18} aria-hidden="true" />
        <span className="backoffice-sidebar-link-label">Terminar sessão</span>
      </button>
    </>
  );
}
