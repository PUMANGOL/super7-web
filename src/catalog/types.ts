import type { CampaignId } from '../config/store';

export type CabazLevel = 'ouro' | 'prata' | 'bronze';

export const CABAZ_LEVELS: CabazLevel[] = ['ouro', 'prata', 'bronze'];

export interface CabazItem {
  name: string;
  qty: number;
}

/** Nome de um símbolo do sprite de ícones (`#i-<nome>`). */
export type IconName =
  | 'pesquisa' | 'carrinho' | 'gift' | 'tag' | 'pin' | 'camiao' | 'relogio' | 'check'
  | 'seta' | 'seta-esq' | 'menos' | 'mais' | 'lixo' | 'filtro' | 'telemovel' | 'escudo'
  | 'box' | 'bottle' | 'basket' | 'cookie' | 'sparkles' | 'drop' | 'book' | 'recibo'
  | 'loja' | 'cartao' | 'dinheiro' | 'equipa' | 'alerta' | 'chevron' | 'chevron-esq';

/** Produto tal como a loja o usa: dados da API + atributos de campanha já interpretados. */
export interface Product {
  id: string;
  name: string;
  sku: string;
  /** Os livros são produtos na API, mas o stock deles não é controlado. */
  isBook: boolean;
  isCabaz: boolean;
  categoryId: string | null;
  categoryName: string;
  categorySlug: string | null;
  categoryIcon: IconName;
  /** "500 g", "6 × 1,5 L", "14 produtos"; nos livros, o autor. */
  format: string;
  description: string;
  summary: string;
  price: number;
  /** Preço antes do desconto; só existe quando é maior que `price`. */
  previousPrice: number | null;
  /** `null` quando o stock não é controlado (livros). */
  stock: number | null;
  /** A categoria pede para mostrar a quantidade em stock ("12 em stock"). */
  showStock: boolean;
  initialStock: number | null;
  campaigns: CampaignId[];
  image: string | null;
  featured: boolean;
  level: CabazLevel | null;
  badge: string;
  items: CabazItem[];
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  icon: IconName;
  description: string;
  isCabazes: boolean;
  productCount: number;
}

export interface Catalog {
  products: Product[];
  byId: Map<string, Product>;
  /** Categorias com pelo menos um produto, cabazes primeiro e depois por nome. */
  categories: StoreCategory[];
  categoryBySlug: Map<string, StoreCategory>;
  /** Tecto do filtro de preço: o produto mais caro, arredondado aos milhares. */
  priceCeiling: number;
}
