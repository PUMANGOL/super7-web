import { fetchAllBooks } from '../api/books';
import { fetchCategories } from '../api/categories';
import { fetchProductList } from '../api/products';
import { CABAZ_CATEGORY_SLUGS, CATEGORY_ICONS } from '../config/store';
import type { ApiProduct, Category } from '../types/api';
import { readStoreAttributes } from './attributes';
import type { Catalog, IconName, Product, StoreCategory } from './types';

const CATEGORY_ICON_NAMES = new Set<string>(CATEGORY_ICONS.map((icon) => icon.value));

function normalise(text: string | null | undefined): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Ícone definido no back-office; sem ele, um palpite pelo nome ou slug da categoria. */
function categoryIcon(category: Category | undefined): IconName {
  if (!category) return 'box';
  if (category.icon && CATEGORY_ICON_NAMES.has(category.icon)) return category.icon as IconName;

  const text = `${normalise(category.slug)} ${normalise(category.name)}`;
  if (/cabaz|cesta|natal|oferta|presente/.test(text)) return 'gift';
  if (/mercearia|alimenta|despensa/.test(text)) return 'basket';
  if (/bebida|agua|sumo/.test(text)) return 'bottle';
  if (/snack|doce|bolacha|chocolate/.test(text)) return 'cookie';
  if (/higiene|casa|limpeza|beleza/.test(text)) return 'sparkles';
  if (/auto|lubrifica|oleo|carro/.test(text)) return 'drop';
  if (/livro|leitura|escolar|academ|literatura|infantil/.test(text)) return 'book';
  if (/promo|escoamento|desconto/.test(text)) return 'tag';
  return 'box';
}

function isCabazCategory(category: Category | undefined): boolean {
  return Boolean(category && CABAZ_CATEGORY_SLUGS.includes(normalise(category.slug)));
}

interface MapContext {
  categoriesById: Map<string, Category>;
  bookAuthors: Map<string, string>;
}

export function mapProduct(api: ApiProduct, context: MapContext): Product {
  const attributes = readStoreAttributes(api);
  const category = api.categoryId ? context.categoriesById.get(api.categoryId) : undefined;
  const isBook = context.bookAuthors.has(api.id);
  const isCabaz = attributes.level !== null || isCabazCategory(category);
  const price = Number(api.price) || 0;
  const campaigns = [...attributes.campaigns];

  // Um cabaz faz sempre parte da campanha de Natal.
  if (isCabaz && !campaigns.includes('natal')) campaigns.unshift('natal');

  const previousPrice =
    attributes.previousPrice !== null && attributes.previousPrice > price ? attributes.previousPrice : null;

  const items = attributes.items;
  const format =
    attributes.format ||
    (isBook ? context.bookAuthors.get(api.id) ?? '' : '') ||
    (isCabaz && items.length ? `${items.length} produtos` : '');

  return {
    id: api.id,
    name: api.name?.trim() || 'Produto',
    sku: api.sku ?? '',
    isBook,
    isCabaz,
    categoryId: api.categoryId,
    categoryName: category?.name ?? api.category ?? '',
    categorySlug: category?.slug ?? null,
    categoryIcon: isCabaz ? 'gift' : categoryIcon(category),
    format,
    description: api.description?.trim() ?? '',
    summary: attributes.summary,
    price,
    previousPrice,
    stock: isBook ? null : Math.max(0, Math.floor(Number(api.stock) || 0)),
    showStock: !isBook && Boolean(api.showStock ?? category?.showStock),
    initialStock: attributes.initialStock,
    campaigns,
    image: api.coverImage?.trim() || null,
    featured: attributes.featured,
    level: attributes.level,
    badge: attributes.badge,
    items,
  };
}

/** Autores dos livros, por ID. Serve também para saber que produtos são livros. */
async function fetchBookAuthors(): Promise<Map<string, string>> {
  try {
    const books = await fetchAllBooks();
    return new Map(books.map((book) => [book.id, book.author ?? '']));
  } catch {
    // Sem a lista de livros o catálogo continua a funcionar; os livros aparecem com o stock da API.
    return new Map();
  }
}

/** Produto na lista do back-office: com `hidden` (oculto na loja) e os dados da API, para o mostrar ou ocultar. */
export interface StaffProduct extends Product {
  hidden: boolean;
  source: ApiProduct;
}

/**
 * Back-office: todos os produtos não eliminados, incluindo os ocultos na loja (`available=false`), que o catálogo
 * público não devolve. Só ADMIN e MANAGER (`GET /product/list?includeUnavailable=true`).
 */
export async function fetchStaffProducts(): Promise<StaffProduct[]> {
  const [apiProducts, apiCategories, bookAuthors] = await Promise.all([
    fetchProductList({ includeUnavailable: true }),
    fetchCategories(),
    fetchBookAuthors(),
  ]);
  const categoriesById = new Map(apiCategories.map((category) => [category.id, category]));
  return apiProducts.map((api) => ({
    ...mapProduct(api, { categoriesById, bookAuthors }),
    hidden: api.available === false,
    source: api,
  }));
}

export async function fetchCatalog(): Promise<Catalog> {
  const [apiProducts, apiCategories, bookAuthors] = await Promise.all([
    fetchProductList(),
    fetchCategories(),
    fetchBookAuthors(),
  ]);

  const categoriesById = new Map(apiCategories.map((category) => [category.id, category]));
  const products = apiProducts
    .filter((product) => product.available !== false)
    .map((product) => mapProduct(product, { categoriesById, bookAuthors }));

  const counts = new Map<string, number>();
  products.forEach((product) => {
    if (product.categoryId) counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
  });

  const categories: StoreCategory[] = apiCategories
    .filter((category) => (counts.get(category.id) ?? 0) > 0 && category.slug)
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: isCabazCategory(category) ? 'gift' : categoryIcon(category),
      description: category.description ?? '',
      isCabazes: isCabazCategory(category),
      productCount: counts.get(category.id) ?? 0,
    }))
    .sort((a, b) => Number(b.isCabazes) - Number(a.isCabazes) || a.name.localeCompare(b.name, 'pt'));

  const highestPrice = products.reduce((max, product) => Math.max(max, product.price), 0);

  return {
    products,
    byId: new Map(products.map((product) => [product.id, product])),
    categories,
    categoryBySlug: new Map(categories.map((category) => [category.slug, category])),
    priceCeiling: Math.max(1000, Math.ceil(highestPrice / 1000) * 1000),
  };
}
