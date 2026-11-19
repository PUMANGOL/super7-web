import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * Passos da encomenda, do carrinho ao levantamento:
 * Carrinho → Dados e pagamento → Aguarda pagamento → Pagamento confirmado → Encomenda em preparação →
 * Pronto a levantar → Levantei!
 * "Aguarda pagamento": Multicaixa Express (o prazo para aceitar no telemóvel vem da API) ou IBAN (transferência e
 * comprovativo). "Pagamento confirmado": pela API no Express, pela equipa da loja no IBAN. "Levantei!": o cliente
 * confirma na página da encomenda (ou a loja dá-a como entregue). Na entrega ao domicílio: "A caminho" e "Recebi!".
 */
export type CheckoutStep = 'carrinho' | 'dados' | 'pagamento' | 'pago' | 'preparacao' | 'pronto' | 'levantada';

interface CheckoutStepsProps {
  current: CheckoutStep;
  /** Entrega ao domicílio: "A caminho" e "Recebi!" em vez de "Pronto a levantar" e "Levantei!". */
  homeDelivery?: boolean;
  /** Encomendas antigas pagas na loja: sem os passos do pagamento online. */
  payOnPickup?: boolean;
}

export function CheckoutSteps({ current, homeDelivery = false, payOnPickup = false }: CheckoutStepsProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const steps: { key: CheckoutStep; label: string }[] = [
    { key: 'carrinho', label: 'Carrinho' },
    { key: 'dados', label: 'Dados e pagamento' },
    ...(payOnPickup
      ? []
      : [
          { key: 'pagamento' as const, label: 'Aguarda pagamento' },
          { key: 'pago' as const, label: 'Pagamento confirmado' },
        ]),
    { key: 'preparacao', label: 'Encomenda em preparação' },
    { key: 'pronto', label: homeDelivery ? 'A caminho' : 'Pronto a levantar' },
    { key: 'levantada', label: homeDelivery ? 'Recebi!' : 'Levantei!' },
  ];
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === current));

  // Em ecrãs estreitos a lista desliza na horizontal: mostra o passo actual sem mexer no scroll da página. Volta a
  // acertar quando a fonte carrega, porque a largura dos passos muda.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reveal = () => {
      const active = list.querySelector<HTMLElement>('[aria-current="step"]');
      if (!active || list.scrollWidth <= list.clientWidth) return;
      list.scrollLeft += active.getBoundingClientRect().left - list.getBoundingClientRect().left - 24;
    };
    reveal();
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) reveal();
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  return (
    <ol className="s7-etapas" aria-label="Passos da encomenda" ref={listRef}>
      {steps.map((step, index) => {
        if (index < currentIndex) {
          return (
            <li key={step.key} className="s7-etapas__feita">
              {step.key === 'carrinho' && currentIndex <= 1 ? <Link to="/carrinho">{step.label}</Link> : step.label}
            </li>
          );
        }
        return (
          <li key={step.key} aria-current={index === currentIndex ? 'step' : undefined}>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}
