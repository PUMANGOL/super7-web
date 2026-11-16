import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadImage } from '../api/images';
import { createProduct, deleteProduct, fetchProduct, updateProduct } from '../api/products';
import { CATALOG_QUERY_KEY } from '../catalog/useCatalog';
import type { ProductRequest } from '../types/api';

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
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: ['product', id] });
      void queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}
