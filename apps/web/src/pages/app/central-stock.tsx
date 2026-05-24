import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../contexts/auth-context';
import { api } from '../../lib/api';
import type { CentralStockItem } from '../../types/stock';

export default function CentralStock() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TECHNICIAN';

  const { data: stock, isLoading } = useQuery<CentralStockItem[]>({
    queryKey: ['central-stock'],
    queryFn: () => api.get('/central-stock').then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      productId,
      quantity,
    }: {
      productId: string;
      quantity: number;
    }) => api.patch(`/central-stock/${productId}`, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['central-stock'] }),
  });

  const [adjustProduct, setAdjustProduct] = useState<CentralStockItem | null>(
    null,
  );
  const [adjustQty, setAdjustQty] = useState(0);

  const openAdjust = (item: CentralStockItem) => {
    setAdjustProduct(item);
    setAdjustQty(item.quantity);
  };

  const handleAdjust = async () => {
    if (!adjustProduct) return;
    await updateMutation.mutateAsync({
      productId: adjustProduct.productId,
      quantity: adjustQty,
    });
    setAdjustProduct(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Estoque Central
      </h1>

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
                      Produto
                    </th>
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      Categoria
                    </th>
                    <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                      Qtd
                    </th>
                    {canEdit && (
                      <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stock?.map((item) => (
                    <tr
                      key={item.productId}
                      className="border-b border-gray-100 dark:border-gray-800/50"
                    >
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        {item.productName}
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <Badge
                          variant={
                            item.productCategory === 'MEAL' ? 'warning' : 'info'
                          }
                        >
                          {item.productCategory === 'MEAL'
                            ? 'Marmita'
                            : 'Bebida'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">
                        {item.quantity}
                      </td>
                      {canEdit && (
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAdjust(item)}
                          >
                            Ajustar
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!adjustProduct}
        onOpenChange={() => setAdjustProduct(null)}
        title="Ajustar Estoque"
      >
        {adjustProduct && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {adjustProduct.productName}
            </p>
            <Input
              id="qty"
              label="Quantidade"
              type="number"
              value={adjustQty}
              onChange={(e) => setAdjustQty(Number(e.target.value))}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAdjustProduct(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleAdjust}
                isLoading={updateMutation.isPending}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
