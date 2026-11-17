import { Link } from 'react-router-dom';
import { useCampaigns, useCheckoutOptions } from '../../catalog/useStoreSettings';
import { inCampaign } from '../../catalog/query';
import { useCatalog } from '../../catalog/useCatalog';
import { PAYMENT_METHOD_LABELS, type CampaignId } from '../../config/store';
import { Logo } from './Header';

export function Footer() {
  const { data: catalog } = useCatalog();
  const { isActive: campaignActive } = useCampaigns();
  const isActive = (id: CampaignId) =>
    campaignActive(id) && (!catalog || catalog.products.some((product) => inCampaign(product, id)));
  const { paymentMethods } = useCheckoutOptions().options;
  const year = new Date().getFullYear();

  return (
    <footer className="s7-rodape">
      <div className="s7-contentor s7-rodape__in">
        <div className="s7-rodape__marca">
          <Logo light />
          <p>A loja online das lojas de conveniência Super7 dos postos Pumangol.</p>
        </div>
        <div>
          <h2>Comprar</h2>
          <ul>
            {isActive('natal') && (
              <li>
                <Link to="/catalogo?campanha=natal">Cestas de Natal</Link>
              </li>
            )}
            {isActive('escoamento') && (
              <li>
                <Link to="/catalogo?campanha=escoamento">Escoamento</Link>
              </li>
            )}
            <li>
              <Link to="/catalogo">Todos os produtos</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2>Encomendas</h2>
          <ul>
            <li>
              <Link to="/#como-funciona">Como encomendar</Link>
            </li>
            <li>
              <Link to="/encomenda">Consultar encomenda</Link>
            </li>
            <li>
              <Link to="/carrinho">Carrinho</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2>Pagamento</h2>
          <ul>
            {paymentMethods.map((method) => (
              <li key={method}>{method === 'IN_STORE' ? 'Na loja, no levantamento' : PAYMENT_METHOD_LABELS[method]}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="s7-contentor s7-rodape__base">
        <p>© {year} Pumangol. Todos os direitos reservados.</p>
        <p>
          Super7 Digital · <Link to="/login">Área reservada</Link>
        </p>
      </div>
    </footer>
  );
}
