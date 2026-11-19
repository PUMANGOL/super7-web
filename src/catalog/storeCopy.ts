import { useMemo } from 'react';
import type { CheckoutOptions } from '../config/store';
import { usePickupPosts } from '../hooks/usePickupPosts';
import { hasOnlinePayment, paymentMethodsShort } from './paymentCopy';
import { useCheckoutOptions } from './useStoreSettings';

/**
 * Textos da loja que dependem das definições do back-office (GET /checkout/options): onde se levanta (loja escolhida
 * pelo cliente ou loja fixa), entrega ao domicílio, cartão de oferta e formas de pagamento.
 */
export interface Highlight {
  title: string;
  text: string;
}

export interface StoreCopy {
  /** Entrega ao domicílio ligada e com um pagamento online. */
  homeDelivery: boolean;
  /** Loja de levantamento fixa nas definições (o cliente não escolhe). */
  fixedPickup: boolean;
  /** "na loja Super7 que escolher" ou, com a loja fixa, "na loja Super7 Talatona". */
  pickupPlace: string;
  /** Cartão de oferta (mensagem) no checkout. */
  giftEnabled: boolean;
  pickup: Highlight;
  gift: Highlight;
  payment: Highlight;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function paymentHighlight(options: CheckoutOptions): Highlight {
  const methods = options.paymentMethods;
  const express = methods.includes('MULTICAIXA_EXPRESS');
  const iban = methods.includes('IBAN');
  if (express && iban) return { title: 'Pagamento Multicaixa', text: 'Express ou transferência' };
  if (express) return { title: 'Pagamento Multicaixa', text: 'Express, no telemóvel' };
  if (iban) return { title: 'Transferência bancária', text: 'Por IBAN, com comprovativo' };
  if (!hasOnlinePayment(methods)) return { title: 'Pague no levantamento', text: 'Multicaixa ou numerário, na loja' };
  return { title: 'Pagamento Multicaixa', text: capitalise(paymentMethodsShort(methods)) };
}

export function storeCopy(options: CheckoutOptions, fixedPostName: string | null): StoreCopy {
  const homeDelivery = options.homeDelivery.enabled && hasOnlinePayment(options.paymentMethods);
  const fixed = options.pickup.mode === 'FIXED';
  let pickupPlace = 'na loja Super7 que escolher';
  if (fixed) pickupPlace = fixedPostName ? `na loja ${fixedPostName}` : 'na loja Super7 indicada';
  // Texto curto para caber numa linha do destaque: com entrega, a loja (escolhida ou fixa) "ou em casa".
  const store = fixed ? capitalise(pickupPlace) : 'Na loja Super7';

  return {
    homeDelivery,
    fixedPickup: fixed,
    pickupPlace,
    giftEnabled: options.giftEnabled,
    pickup: { title: 'Levante no posto', text: homeDelivery ? `${store} ou em casa` : capitalise(pickupPlace) },
    gift: options.giftEnabled
      ? { title: 'Pronto a oferecer', text: 'Com laço e mensagem de oferta' }
      : { title: 'Pronto a oferecer', text: 'Embalado com laço' },
    payment: paymentHighlight(options),
  };
}

/** `storeCopy` com as definições actuais; a loja fixa só pede a lista das lojas quando é preciso o nome. */
export function useStoreCopy(): StoreCopy {
  const { options } = useCheckoutOptions();
  const fixedId = options.pickup.mode === 'FIXED' ? options.pickup.fixedPostId : null;
  const { data: posts } = usePickupPosts(Boolean(fixedId));
  const fixedPostName = fixedId ? posts?.find((post) => post.id === fixedId)?.name ?? null : null;
  return useMemo(() => storeCopy(options, fixedPostName), [options, fixedPostName]);
}
