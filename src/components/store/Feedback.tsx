import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { IconName } from '../../catalog/types';
import { Icon } from './Icon';

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <ol className="s7-migalhas" aria-label="Caminho">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${item.label}-${index}`} aria-current={last ? 'page' : undefined}>
            {item.to && !last ? <Link to={item.to}>{item.label}</Link> : item.label}
          </li>
        );
      })}
    </ol>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  alert?: boolean;
}

/** Bloco tracejado (`s7-vazio`) para listas vazias, erros e páginas inexistentes. */
export function EmptyState({ icon, title, children, action, alert = false }: EmptyStateProps) {
  return (
    <div className="s7-vazio" role={alert ? 'alert' : undefined}>
      <Icon name={icon} />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Erro ao carregar o catálogo, com opção de tentar outra vez. */
export function CatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon="alerta"
      title="Não foi possível carregar os produtos"
      alert
      action={
        <button className="s7-btn s7-btn--primario" type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      }
    >
      Verifique a ligação à internet e tente novamente. Se o problema continuar, volte dentro de alguns minutos.
    </EmptyState>
  );
}

export function BackToCatalogLink() {
  return (
    <Link className="s7-btn s7-btn--primario" to="/catalogo">
      Ver todos os produtos
    </Link>
  );
}
