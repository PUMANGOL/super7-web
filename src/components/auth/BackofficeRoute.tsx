import { Link, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/auth';
import type { Permission } from '../../utils/auth';

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="backoffice-page">
      <div className="backoffice-body">
        <div className="backoffice-empty">
          <p>{message}</p>
          <p>
            <Link to="/" className="btn btn-outline btn-sm">
              Ir para a loja
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Só a equipa (ADMIN, MANAGER, SUPPORT, FINANCE, AUDITOR) entra no back-office. */
export function BackofficeRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, canAccessBackoffice } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccessBackoffice) {
    return (
      <AccessDenied message="A sua conta não tem um perfil de equipa. Peça a um administrador que lhe atribua o perfil certo." />
    );
  }

  return children;
}

/** Esconde a página a quem não tem a permissão (a API responderia 403). */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();

  if (!can(permission)) {
    return <AccessDenied message="Não tem permissão para esta área do back-office." />;
  }

  return children;
}
