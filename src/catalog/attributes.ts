import { isCampaignId, PRODUCT_ATTRIBUTES, type CampaignId } from '../config/store';
import type { HamperLevel, ProductAttribute, ProductStoreFields } from '../types/api';
import type { CabazItem, CabazLevel } from './types';

/**
 * Atributos de loja guardados em `Product.attributes` (pares nome/valor livres na API).
 * Ver `PRODUCT_ATTRIBUTES` em src/config/store.ts para a convenção de nomes.
 */
export interface StoreAttributes {
  campaigns: CampaignId[];
  previousPrice: number | null;
  initialStock: number | null;
  format: string;
  level: CabazLevel | null;
  badge: string;
  summary: string;
  items: CabazItem[];
  featured: boolean;
  /** Atributos que a loja não interpreta (cor, tamanho…): preservados ao gravar. */
  extra: ProductAttribute[];
}

export const EMPTY_STORE_ATTRIBUTES: StoreAttributes = {
  campaigns: [],
  previousPrice: null,
  initialStock: null,
  format: '',
  level: null,
  badge: '',
  summary: '',
  items: [],
  featured: false,
  extra: [],
};

/** "Preço anterior" → "precoanterior": ignora maiúsculas, acentos, espaços e símbolos. */
function normaliseKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const KEY_ALIASES: Record<string, keyof Omit<StoreAttributes, 'extra'>> = {
  campanha: 'campaigns',
  campanhas: 'campaigns',
  precoanterior: 'previousPrice',
  precoantigo: 'previousPrice',
  precooriginal: 'previousPrice',
  stockinicial: 'initialStock',
  formato: 'format',
  nivel: 'level',
  selo: 'badge',
  resumo: 'summary',
  item: 'items',
  itens: 'items',
  inclui: 'items',
  destaque: 'featured',
};

/** "3.200", "3 200 Kz", "3200,50" → número; texto inválido → null. */
export function parseAmount(value: string): number | null {
  let text = value.replace(/kz/gi, '').replace(/\s/g, '');
  if (!text) return null;

  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }

  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** "2 × Arroz branco 1 kg", "Arroz branco 1 kg × 2", "Arroz | 2" ou só o nome (1 unidade). */
export function parseCabazItem(value: string): CabazItem | null {
  const text = value.trim();
  if (!text) return null;

  const qtyFirst = text.match(/^(\d+)\s*[x×]\s*(.+)$/i);
  if (qtyFirst) return { name: qtyFirst[2].trim(), qty: Number(qtyFirst[1]) };

  const qtyLast = text.match(/^(.+?)\s*[x×|]\s*(\d+)$/i);
  if (qtyLast) return { name: qtyLast[1].trim(), qty: Number(qtyLast[2]) };

  return { name: text, qty: 1 };
}

function parseLevel(value: string): CabazLevel | null {
  const key = normaliseKey(value);
  return key === 'ouro' || key === 'prata' || key === 'bronze' ? key : null;
}

function isYes(value: string): boolean {
  return ['sim', 's', 'true', '1', 'yes'].includes(normaliseKey(value));
}

export function parseStoreAttributes(attributes: ProductAttribute[] | null | undefined): StoreAttributes {
  const result: StoreAttributes = { ...EMPTY_STORE_ATTRIBUTES, campaigns: [], items: [], extra: [] };

  for (const attribute of attributes ?? []) {
    const name = attribute?.name ?? '';
    const value = (attribute?.value ?? '').trim();
    const field = KEY_ALIASES[normaliseKey(name)];

    switch (field) {
      case 'campaigns':
        value
          .split(/[,;|]+/)
          .map((part) => normaliseKey(part))
          .filter(isCampaignId)
          .forEach((id) => {
            if (!result.campaigns.includes(id)) result.campaigns.push(id);
          });
        break;
      case 'previousPrice':
        result.previousPrice = parseAmount(value);
        break;
      case 'initialStock': {
        const stock = parseAmount(value);
        result.initialStock = stock === null ? null : Math.round(stock);
        break;
      }
      case 'format':
        result.format = value;
        break;
      case 'level':
        result.level = parseLevel(value);
        break;
      case 'badge':
        result.badge = value;
        break;
      case 'summary':
        result.summary = value;
        break;
      case 'items':
        value
          .split(/[;\n]+/)
          .map(parseCabazItem)
          .forEach((item) => {
            if (item) result.items.push(item);
          });
        break;
      case 'featured':
        result.featured = isYes(value);
        break;
      default:
        if (name.trim()) result.extra.push({ name: name.trim(), value });
    }
  }

  return result;
}

const LEVEL_FROM_API: Record<HamperLevel, CabazLevel> = { GOLD: 'ouro', SILVER: 'prata', BRONZE: 'bronze' };
const LEVEL_TO_API: Record<CabazLevel, HamperLevel> = { ouro: 'GOLD', prata: 'SILVER', bronze: 'BRONZE' };

/**
 * Campos de loja do produto: usa os campos próprios propostos para a API quando vêm
 * na resposta e, para os que faltam, os atributos (`attributes`) com a convenção actual.
 */
export function readStoreAttributes(product: (ProductStoreFields & { attributes?: ProductAttribute[] | null }) | null | undefined): StoreAttributes {
  const fromAttributes = parseStoreAttributes(product?.attributes);
  if (!product) return fromAttributes;

  const campaigns = Array.isArray(product.campaigns)
    ? product.campaigns.map((slug) => slug.toLowerCase()).filter(isCampaignId)
    : null;
  const items = Array.isArray(product.hamperItems)
    ? product.hamperItems
        .filter((item) => item?.name?.trim())
        .map((item) => ({ name: item.name.trim(), qty: Math.max(1, Math.round(Number(item.quantity) || 1)) }))
    : null;

  return {
    campaigns: campaigns && campaigns.length > 0 ? campaigns : fromAttributes.campaigns,
    previousPrice: product.previousPrice != null ? Number(product.previousPrice) : fromAttributes.previousPrice,
    initialStock: product.initialStock != null ? Number(product.initialStock) : fromAttributes.initialStock,
    format: product.format?.trim() || fromAttributes.format,
    level: product.hamperLevel ? LEVEL_FROM_API[product.hamperLevel] ?? null : fromAttributes.level,
    badge: product.badge?.trim() || fromAttributes.badge,
    summary: product.summary?.trim() || fromAttributes.summary,
    items: items && items.length > 0 ? items : fromAttributes.items,
    featured: product.featured != null ? Boolean(product.featured) : fromAttributes.featured,
    extra: fromAttributes.extra,
  };
}

/** Campos próprios propostos para a API (enviados junto com os atributos equivalentes). */
export function toStoreFields(attributes: StoreAttributes): ProductStoreFields {
  return {
    campaigns: attributes.campaigns,
    previousPrice: attributes.previousPrice,
    initialStock: attributes.initialStock,
    format: attributes.format.trim() || null,
    summary: attributes.summary.trim() || null,
    hamperLevel: attributes.level ? LEVEL_TO_API[attributes.level] : null,
    badge: attributes.badge.trim() || null,
    hamperItems: attributes.items
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), quantity: Math.max(1, Math.round(item.qty)) })),
    featured: attributes.featured,
  };
}

/** Converte os campos do formulário do back-office nos atributos a gravar na API. */
export function serializeStoreAttributes(attributes: StoreAttributes): ProductAttribute[] {
  const result: ProductAttribute[] = [];
  const add = (name: string, value: string | number | null | undefined) => {
    const text = value == null ? '' : String(value).trim();
    if (text) result.push({ name, value: text });
  };

  add(PRODUCT_ATTRIBUTES.campaigns, attributes.campaigns.join(','));
  add(PRODUCT_ATTRIBUTES.previousPrice, attributes.previousPrice);
  add(PRODUCT_ATTRIBUTES.initialStock, attributes.initialStock);
  add(PRODUCT_ATTRIBUTES.format, attributes.format);
  add(PRODUCT_ATTRIBUTES.level, attributes.level);
  add(PRODUCT_ATTRIBUTES.badge, attributes.badge);
  add(PRODUCT_ATTRIBUTES.summary, attributes.summary);
  if (attributes.featured) add(PRODUCT_ATTRIBUTES.featured, 'sim');
  attributes.items
    .filter((item) => item.name.trim())
    .forEach((item) => add(PRODUCT_ATTRIBUTES.item, `${Math.max(1, Math.round(item.qty))} × ${item.name.trim()}`));
  attributes.extra
    .filter((attribute) => attribute.name.trim() && attribute.value.trim())
    .forEach((attribute) => add(attribute.name, attribute.value));

  return result;
}
