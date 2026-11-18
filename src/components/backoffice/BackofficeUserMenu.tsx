import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Palette, Store } from 'lucide-react';
import { useAuth } from '../../context/auth';
import { roleLabel } from '../../utils/auth';
import { initials } from '../../utils/format';
import { useBackofficeLogout } from './useBackofficeLogout';
import './BackofficeUserMenu.css';

/** Utilizador na barra do topo: iniciais, nome e perfil; abre o menu com a loja, a aparência e a saída. */
export function BackofficeUserMenu() {
  const { user, can } = useAuth();
  const logout = useBackofficeLogout();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
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

  const role = roleLabel(user);
  const close = () => setIsOpen(false);

  return (
    <div className="bo-utilizador" ref={menuRef}>
      <button
        type="button"
        className="bo-utilizador__botao"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${user.name}, ${role}: abrir o menu da conta`}
      >
        <span className="bo-avatar" aria-hidden="true">
          {initials(user.name) || '?'}
        </span>
        <span className="bo-utilizador__texto" aria-hidden="true">
          <strong>{user.name}</strong>
          <span>
            {role} · {user.email}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="bo-utilizador__menu" role="menu">
          <div className="bo-utilizador__info">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            <span className="bo-utilizador__perfil">{role}</span>
          </div>
          <Link to="/" className="bo-utilizador__opcao" role="menuitem" onClick={close}>
            <Store size={17} aria-hidden="true" />
            Abrir a loja
          </Link>
          {can('manageSettings') && (
            <Link to="/backoffice/aparencia" className="bo-utilizador__opcao" role="menuitem" onClick={close}>
              <Palette size={17} aria-hidden="true" />
              Aparência do back-office
            </Link>
          )}
          <div className="bo-utilizador__divisor" role="separator" />
          <button
            type="button"
            className="bo-utilizador__opcao"
            role="menuitem"
            onClick={() => {
              close();
              logout();
            }}
          >
            <LogOut size={17} aria-hidden="true" />
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  );
}
