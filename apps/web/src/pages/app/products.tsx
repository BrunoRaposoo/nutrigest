import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/error-banner';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../contexts/auth-context';
import {
  useCreateProduct,
  useDeleteProduct,
  useProducts,
} from '../../hooks/queries/use-product-queries';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/api-error';
import type { Product } from '../../types/product';

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  category: z.enum(['BEVERAGE', 'MEAL']),
  unit: z.string().optional(),
});

type ProductForm = z.infer<typeof productSchema>;

export default function Products() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: products, isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const deleteProduct = useDeleteProduct();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
  });

  const canEdit = user?.role === 'ADMIN' || user?.role === 'TECHNICIAN';

  const openCreate = () => {
    setFormError('');
    setEditingProduct(null);
    reset({ name: '', category: 'BEVERAGE', unit: '' });
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setFormError('');
    setEditingProduct(product);
    reset({
      name: product.name,
      category: product.category,
      unit: product.unit || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: ProductForm) => {
    setFormError('');
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, data);
        qc.invalidateQueries({ queryKey: ['products'] });
      } else {
        await createProduct.mutateAsync(data);
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      await deleteProduct.mutateAsync(id);
    }
  };

  const filtered = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 transition-theme">
      {deleteProduct.isError && (
        <ErrorBanner
          message={getApiErrorMessage(deleteProduct.error)}
          onDismiss={() => deleteProduct.reset()}
        />
      )}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Produtos
        </h1>
        {canEdit && <Button onClick={openCreate}>Novo Produto</Button>}
      </div>

      <Input
        id="search"
        placeholder="Buscar produtos..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                /* biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading placeholder */
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
                      Nome
                    </th>
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      Categoria
                    </th>
                    <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-gray-100 dark:border-gray-800/50"
                    >
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        {product.name}
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <Badge
                          variant={
                            product.category === 'MEAL' ? 'warning' : 'info'
                          }
                        >
                          {product.category === 'MEAL' ? 'Marmita' : 'Bebida'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(product)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(product.id)}
                                className="text-red-500"
                              >
                                Excluir
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {(formError ||
            (createProduct.isError &&
              getApiErrorMessage(createProduct.error))) && (
            <ErrorBanner
              message={formError || getApiErrorMessage(createProduct.error)}
              onDismiss={() => {
                setFormError('');
                createProduct.reset();
              }}
            />
          )}
          <Input
            id="name"
            label="Nome"
            error={errors.name?.message}
            {...register('name')}
          />
          <Select
            id="category"
            label="Categoria"
            options={[
              { value: 'BEVERAGE', label: 'Bebida' },
              { value: 'MEAL', label: 'Marmita' },
            ]}
            error={errors.category?.message}
            {...register('category')}
          />
          <Input
            id="unit"
            label="Unidade"
            placeholder="ex: un, ml, g"
            error={errors.unit?.message}
            {...register('unit')}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingProduct ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
