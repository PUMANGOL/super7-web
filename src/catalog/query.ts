import { STORE, type CampaignId } from '../config/store';
import type { CabazLevel, Product } from './types';

export type SortKey = 'relevancia' | 'preco-asc' | 'preco-desc' | 'desconto' | 'nome';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'relevancia', label: 'Relevância' },
  { value: 'preco-asc', label: 'Preço: mais baixo' },
  { value: 'preco-desc', label: 'Preço: mais alto' },
  { value: 'desconto', label: 'Maior desconto' },
  { value: 'nome', label: 'Nome (A–Z)' },
];

export function isSortKey(value: string | null): value is SortKey {
  return SORT_OPTIONS.some((option) => option.value === value);
}

export function discountPercent(product: Pick<Product, 'price' | 'previousPrice'>): number {
  if (!product.previousPrice) return 0;
  return Math.round((1 - product.price / product.previousPrice) * 100);
}

export function isInStock(product: Pick<Product, 'stock'>): boolean {
  return product.stock === null || product.stock > 0;
}

/** Quantidade máxima que se pode encomendar numa linha. */
export function maxOrderQuantity(product: Pick<Product, 'stock'>): number {
  return product.stock === null ? STORE.maxQuantity : Math.min(STORE.maxQuantity, product.stock);
}

export function productPath(product: Pick<Product, 'id'>): string {
  return `/produto/${product.id}`;
}

export function stockLabel(stock: number): string {
  return stock === 1 ? 'Resta 1 unidade' : `Restam ${stock} unidades`;
}

export function inCampaign(product: Pick<Product, 'campaigns'>, campaign: CampaignId): boolean {
  return product.campaigns.includes(campaign);
}

const LEVEL_ORDER: Record<CabazLevel, number> = { ouro: 0, prata: 1, bronze: 2 };

/** Ouro, Prata, Bronze e depois os restantes cabazes por preço decrescente. */
export function sortCabazes(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const levelA = a.level ? LEVEL_ORDER[a.level] : 9;
    const levelB = b.level ? LEVEL_ORDER[b.level] : 9;
    return levelA - levelB || b.price - a.price;
  });
}

export function searchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export interface ProductQuery {
  campaign?: CampaignId | null;
  categorySlug?: string | null;
  q?: string;
  maxPrice?: number | null;
  inStock?: boolean;
  featured?: boolean;
  excludeCabazes?: boolean;
  sort?: SortKey;
}

export function queryProducts(products: Product[], query: ProductQuery): Product[] {
  const terms = searchText(query.q ?? '')
    .split(/\s+/)
    .filter(Boolean);

  const list = products.filter((product) => {
    if (query.campaign && !inCampaign(product, query.campaign)) return false;
    if (query.categorySlug && product.categorySlug !== query.categorySlug) return false;
    if (query.featured && !product.featured) return false;
    if (query.excludeCabazes && product.isCabaz) return false;
    if (query.inStock && !isInStock(product)) return false;
    if (query.maxPrice && product.price > query.maxPrice) return false;
    if (terms.length) {
      const haystack = searchText(
        [product.name, product.description, product.summary, product.categoryName, product.format, product.sku].join(' '),
      );
      if (!terms.every((term) => haystack.includes(term))) return false;
    }
    return true;
  });

  const sort = query.sort ?? 'relevancia';
  return list.sort((a, b) => {
    switch (sort) {
      case 'preco-asc':
        return a.price - b.price;
      case 'preco-desc':
        return b.price - a.price;
      case 'desconto':
        return discountPercent(b) - discountPercent(a);
      case 'nome':
        return a.name.localeCompare(b.name, 'pt');
      default: {
        // Relevância: cabazes por nível, depois produtos em campanha, depois destaques, depois disponíveis.
        const levelA = a.level ? LEVEL_ORDER[a.level] : a.isCabaz ? 3 : 9;
        const levelB = b.level ? LEVEL_ORDER[b.level] : b.isCabaz ? 3 : 9;
        return (
          levelA - levelB ||
          b.campaigns.length - a.campaigns.length ||
          Number(b.featured) - Number(a.featured) ||
          Number(isInStock(b)) - Number(isInStock(a)) ||
          a.name.localeCompare(b.name, 'pt')
        );
      }
    }
  });
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

/** Números a mostrar na paginação: 1 … 4 5 6 … 20 (`null` marca as reticências). */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);

  const result: (number | null)[] = [1];
  const start = Math.max(2, Math.min(page - 1, pages - 4));
  const end = Math.min(pages - 1, Math.max(page + 1, 5));
  // Reticências só quando escondem mais do que uma página.
  if (start === 3) result.push(2);
  else if (start > 3) result.push(null);
  for (let current = start; current <= end; current += 1) result.push(current);
  if (end === pages - 2) result.push(pages - 1);
  else if (end < pages - 2) result.push(null);
  result.push(pages);
  return result;
}

/** Páginas a começar em 1, como na URL do catálogo. */
export function paginate<T>(list: T[], page: number, size: number): PageResult<T> {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const start = (current - 1) * size;
  return { items: list.slice(start, start + size), page: current, pages, total: list.length };
}
