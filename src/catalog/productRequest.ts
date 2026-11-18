import type { ApiProduct, ProductRequest } from '../types/api';
import { readStoreAttributes, serializeStoreAttributes, toStoreFields } from './attributes';

/**
 * Corpo de PUT /product/{id} com os dados que o produto já tem e só `available` mudado: mostrar ou ocultar o produto
 * na loja a partir da lista do back-office, sem abrir o formulário. A API substitui o produto inteiro, por isso tudo o
 * resto (preço, stock, campanhas, artigos da cesta, atributos) segue tal como está gravado.
 */
export function productVisibilityRequest(product: ApiProduct, available: boolean): ProductRequest {
  if (!product.categoryId) {
    throw new Error(`"${product.name}" não tem categoria. Abra o produto, escolha a categoria e grave.`);
  }
  const attributes = readStoreAttributes(product);
  return {
    name: product.name,
    sku: product.sku,
    kind: product.kind,
    price: Number(product.price),
    stock: Math.max(0, Math.floor(Number(product.stock) || 0)),
    categoryId: product.categoryId,
    description: product.description?.trim() || undefined,
    currency: product.currency || 'AOA',
    coverImage: product.coverImage ?? undefined,
    available,
    ...toStoreFields(attributes),
    attributes: serializeStoreAttributes(attributes),
  };
}
