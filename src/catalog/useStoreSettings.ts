import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchCampaigns, fetchCheckoutOptions } from '../api/campaigns';
import {
  CAMPAIGN_IDS,
  CAMPAIGNS,
  DEFAULT_CHECKOUT_OPTIONS,
  EXPRESS_VALIDITY_MINUTES,
  hasApiFeature,
  isCampaignActive,
  STORE_PAYMENT_METHODS,
  type Campaign,
  type CampaignId,
  type CheckoutOptions,
} from '../config/store';
import type { ApiCampaign, ApiCheckoutOptions } from '../types/api';
import { plural } from '../utils/format';

const TEN_MINUTES = 10 * 60 * 1000;

/** Junta as campanhas da API aos textos da configuração. Uma campanha que a API não devolve fica inactiva. */
function mergeCampaigns(remote: ApiCampaign[] | undefined): Record<CampaignId, Campaign> {
  if (!remote) return CAMPAIGNS;

  const result = { ...CAMPAIGNS };
  CAMPAIGN_IDS.forEach((id) => {
    const base = CAMPAIGNS[id];
    const found = remote.find((campaign) => campaign.slug?.toLowerCase() === id);
    result[id] = found
      ? {
          ...base,
          name: found.name || base.name,
          description: found.description || base.description,
          startsOn: found.startDate?.slice(0, 10) || base.startsOn,
          endsOn: found.endDate?.slice(0, 10) || base.endsOn,
          ordersUntil: found.ordersUntil ?? undefined,
          active: found.active,
        }
      : { ...base, active: false };
  });
  return result;
}

export interface CampaignsState {
  campaigns: Record<CampaignId, Campaign>;
  isActive: (id: CampaignId) => boolean;
}

/** Campanhas: `GET /campaign` com `api_features=campaigns`; sem isso, `CAMPAIGNS` de src/config/store.ts. */
export function useCampaigns(): CampaignsState {
  const enabled = hasApiFeature('campaigns');
  const { data } = useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
    enabled,
    staleTime: TEN_MINUTES,
    retry: 1,
  });

  return useMemo(() => {
    const campaigns = mergeCampaigns(data);
    return { campaigns, isActive: (id: CampaignId) => isCampaignActive(campaigns[id]) };
  }, [data]);
}

function mapCheckoutOptions(remote: ApiCheckoutOptions): CheckoutOptions {
  const methods = (remote.paymentMethods ?? []).filter((method) => STORE_PAYMENT_METHODS.includes(method));
  const bank = remote.bankTransfer;
  return {
    homeDelivery: {
      enabled: Boolean(remote.homeDeliveryEnabled),
      fee: Math.max(0, Number(remote.homeDeliveryFee) || 0),
      zones: remote.homeDeliveryZones ?? [],
    },
    paymentMethods: methods.length ? methods : DEFAULT_CHECKOUT_OPTIONS.paymentMethods,
    giftEnabled: remote.giftEnabled ?? DEFAULT_CHECKOUT_OPTIONS.giftEnabled,
    giftMessageMaxLength: remote.giftMessageMaxLength || DEFAULT_CHECKOUT_OPTIONS.giftMessageMaxLength,
    pickup: {
      mode: remote.pickupMode === 'FIXED' && remote.fixedPickupPostId ? 'FIXED' : 'CUSTOMER_CHOICE',
      fixedPostId: remote.pickupMode === 'FIXED' ? remote.fixedPickupPostId ?? null : null,
    },
    bankTransfer: bank?.iban ? { iban: bank.iban, holder: bank.holder ?? '', bank: bank.bank ?? '' } : null,
    christmasTheme: typeof remote.christmasTheme === 'boolean' ? remote.christmasTheme : null,
    expressValidityMinutes:
      Number(remote.expressValidityMinutes) > 0
        ? Math.round(Number(remote.expressValidityMinutes))
        : DEFAULT_CHECKOUT_OPTIONS.expressValidityMinutes,
    receiptConfirmation: remote.receiptConfirmation === true,
    viaCardStored: remote.viaCardNumber === true,
  };
}

/** Opções do checkout: `GET /checkout/options` com `api_features=checkout-options`; sem isso, os valores por omissão. */
export function useCheckoutOptions(): { options: CheckoutOptions; isLoading: boolean } {
  const enabled = hasApiFeature('checkout-options');
  const { data, isLoading } = useQuery({
    queryKey: ['checkout-options'],
    queryFn: fetchCheckoutOptions,
    enabled,
    staleTime: TEN_MINUTES,
    retry: 1,
  });

  const options = useMemo(() => (data ? mapCheckoutOptions(data) : DEFAULT_CHECKOUT_OPTIONS), [data]);
  return { options, isLoading: enabled && isLoading };
}

/**
 * Prazo que o cliente vê para aceitar um pedido Multicaixa Express: em segundos (contagem) e por extenso ("2 minutos").
 * São os EXPRESS_VALIDITY_MINUTES, ou menos se a API der menos. `leadMs`: quanto antes do `expiresAt` da API acaba a
 * contagem, quando a API dá mais tempo do que a loja mostra.
 */
export function useExpressWindow(): { seconds: number; label: string; leadMs: number } {
  const apiMinutes = useCheckoutOptions().options.expressValidityMinutes;
  const minutes = Math.min(EXPRESS_VALIDITY_MINUTES, apiMinutes);
  return { seconds: minutes * 60, label: plural(minutes, 'minuto', 'minutos'), leadMs: (apiMinutes - minutes) * 60000 };
}

/** Fim da contagem de um pedido Express (ms): o `expiresAt` da API menos `leadMs` (ver useExpressWindow). */
export function expressCountdownEnd(expiresAt: string | null | undefined, leadMs: number): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  return Number.isNaN(end) ? null : end - leadMs;
}
