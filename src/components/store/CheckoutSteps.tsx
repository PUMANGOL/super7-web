import { Link } from 'react-router-dom';

/**
 * Carrinho → Dados e pagamento → Aguarda pagamento → Pagamento confirmado.
 * "Aguarda pagamento": Multicaixa Express (2 minutos para aceitar no telemóvel) ou IBAN (transferência e
 * comprovativo). "Pagamento confirmado": pela API no Express, pela equipa da loja no IBAN.
 */
const STEPS = ['Carrinho', 'Dados e pagamento', 'Aguarda pagamento', 'Pagamento confirmado'];

export function CheckoutSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="s7-etapas" aria-label="Passos da compra">
      {STEPS.map((label, index) => {
        const step = index + 1;
        if (step < current) {
          return (
            <li key={label} className="s7-etapas__feita">
              {step === 1 ? <Link to="/carrinho">{label}</Link> : label}
            </li>
          );
        }
        return (
          <li key={label} aria-current={step === current ? 'step' : undefined}>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
