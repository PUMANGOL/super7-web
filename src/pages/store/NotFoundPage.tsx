import { Link, Navigate, useParams } from 'react-router-dom';
import { Breadcrumbs, EmptyState } from '../../components/store/Feedback';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada');

  return (
    <main id="conteudo" className="s7-contentor s7-pagina-simples">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Página não encontrada' }]} />
      <EmptyState
        icon="pesquisa"
        title="Esta página não existe"
        action={
          <Link className="s7-btn s7-btn--primario" to="/">
            Ir para a página inicial
          </Link>
        }
      >
        O endereço pode estar errado ou a página pode ter mudado de sítio.
      </EmptyState>
    </main>
  );
}

/** Endereço antigo da campanha escolar: /confirmacao/{id} → /encomenda/{id}. */
export function LegacyConfirmationRedirect() {
  const { orderId = '' } = useParams();
  return <Navigate to={`/encomenda/${orderId}`} replace />;
}
