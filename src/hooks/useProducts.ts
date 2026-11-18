import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { uploadImage } from '../api/images';
import { createProduct, deleteProduct, fetchProduct, updateProduct } from '../api/products';
import { fetchStaffProducts, type StaffProduct } from '../catalog/catalog';
import { productVisibilityRequest } from '../catalog/productRequest';
import { CATALOG_QUERY_KEY } from '../catalog/useCatalog';
import type { ProductRequest } from '../types/api';

/** Lista do back-office (com os ocultos). Fica debaixo de ['catalog'], que é invalidado sempre que um produto muda. */
const STAFF_PRODUCTS_QUERY_KEY = [...CATALOG_QUERY_KEY, 'equipa'] as const;

/** Depois de gravar: o catálogo da loja, a lista do back-office e o painel (produtos ocultos) voltam a ser pedidos. */
function refreshProductLists(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['products', 'including-unavailable'] });
}

/** Back-office: todos os produtos, visíveis e ocultos na loja (só ADMIN e MANAGER). */
export function useStaffProducts() {
  return useQuery({
    queryKey: STAFF_PRODUCTS_QUERY_KEY,
    queryFn: fetchStaffProducts,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

/**
 * Mostrar ou ocultar um produto na loja. Oculto, sai do catálogo, da pesquisa e das categorias, e a API recusa-o nas
 * encomendas; continua no back-office para voltar a ser mostrado.
 */
export function useSetProductVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ product, visible }: { product: StaffProduct; visible: boolean }) =>
      updateProduct(product.id, productVisibilityRequest(product.source, visible)),
    onSuccess: (saved) => {
      // A lista muda já; a seguir chega a versão da API.
      queryClient.setQueryData<StaffProduct[]>(STAFF_PRODUCTS_QUERY_KEY, (current) =>
        current?.map((item) =>
          item.id === saved.id ? { ...item, hidden: saved.available === false, source: saved } : item,
        ),
      );
      queryClient.setQueryData(['product', saved.id], saved);
      refreshProductLists(queryClient);
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id as string),
    enabled: Boolean(id),
    staleTime: 0,
    retry: false,
  });
}

interface SaveProductInput {
  id?: string;
  dto: ProductRequest;
  image: File | null;
}

/**
 * Criar: POST multipart com a imagem. Editar: PUT JSON; se houver imagem nova,
 * é carregada antes em POST /images e o URL vai em `coverImage`.
 */
export function useSaveProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto, image }: SaveProductInput) => {
      if (!id) {
        if (!image) throw new Error('A imagem é obrigatória para criar um produto.');
        return createProduct(dto, image);
      }
      const coverImage = image ? await uploadImage(image) : dto.coverImage;
      return updateProduct(id, { ...dto, coverImage });
    },
    onSuccess: (product) => {
      queryClient.setQueryData(['product', product.id], product);
      refreshProductLists(queryClient);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: ['product', id] });
      refreshProductLists(queryClient);
    },
  });
}
