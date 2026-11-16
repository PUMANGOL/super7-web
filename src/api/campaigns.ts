import { apiClient, unwrap } from './client';
import type { ApiCampaign, ApiCheckoutOptions, ApiResponse } from '../types/api';

/** Proposto: campanhas activas (público). Só é chamado com `api_features=campaigns`. */
export async function fetchCampaigns(): Promise<ApiCampaign[]> {
  const { data } = await apiClient.get<ApiResponse<ApiCampaign[]>>('/campaign');
  return unwrap(data) ?? [];
}

/** Proposto: taxa e zonas de entrega e métodos de pagamento (público). Só com `api_features=checkout-options`. */
export async function fetchCheckoutOptions(): Promise<ApiCheckoutOptions> {
  const { data } = await apiClient.get<ApiResponse<ApiCheckoutOptions>>('/checkout/options');
  return unwrap(data);
}
