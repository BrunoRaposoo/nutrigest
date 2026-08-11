import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { ErrorBanner } from '../../components/ui/error-banner';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../contexts/auth-context';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/api-error';
import { cn } from '../../lib/utils';
import type { MinibarItem } from '../../types/stock';

export default function MinibarStandard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'TECHNICIAN';
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const rooms = Array.from({ length: 10 }, (_, i) => 101 + i);

  const { data: items } = useQuery<MinibarItem[]>({
    queryKey: ['minibar-standard', selectedRoom],
    queryFn: () =>
      api.get(`/minibar-standard/${selectedRoom}`).then((r) => r.data),
    enabled: !!selectedRoom,
  });

  const { data: products } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: ({
      productId,
      standardQuantity,
    }: {
      productId: string;
      standardQuantity: number;
    }) =>
      api.post(`/minibar-standard/${selectedRoom}`, {
        productId,
        standardQuantity,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['minibar-standard', selectedRoom] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) =>
      api.delete(`/minibar-standard/${selectedRoom}/${productId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['minibar-standard', selectedRoom] }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleAdd = async () => {
    if (!selectedProductId) return;
    setError('');
    try {
      await createMutation.mutateAsync({
        productId: selectedProductId,
        standardQuantity: addQty,
      });
      setAddOpen(false);
      setSelectedProductId('');
      setAddQty(1);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err) || 'Erro ao adicionar item');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Remover item do padrão?')) return;
    setDeleteError('');
    try {
      await deleteMutation.mutateAsync(productId);
    } catch (err) {
      setDeleteError(getApiErrorMessage(err) || 'Erro ao remover item');
    }
  };

  const availableProducts = products?.filter(
    (p) => !items?.some((i) => i.productId === p.id),
  );

  return (
    <div className="space-y-6 transition-theme">
      {deleteError && (
        <ErrorBanner
          message={deleteError}
          onDismiss={() => setDeleteError('')}
        />
      )}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Padrão Frigobar
      </h1>

      <div className="grid grid-cols-5 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        {rooms.map((room) => (
          <button
            key={room}
            type="button"
            onClick={() => setSelectedRoom(room)}
            className={cn(
              'p-3 rounded-lg text-sm font-medium border transition-colors',
              selectedRoom === room
                ? 'bg-navy-700 text-white border-navy-700 dark:bg-gold-500 dark:text-navy-900 dark:border-gold-500'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-navy-800 dark:text-gray-300 dark:border-gray-800',
            )}
          >
            {room}
          </button>
        ))}
      </div>

      {selectedRoom && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Quarto {selectedRoom}
              </h2>
              {canEdit && (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  Adicionar
                </Button>
              )}
            </div>
            {!items || items.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                Nenhum item cadastrado para este quarto.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
                        Produto
                      </th>
                      <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                        Qtd Padrão
                      </th>
                      {canEdit && (
                        <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                          Ações
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items?.map((item) => (
                      <tr
                        key={item.productId}
                        className="border-b border-gray-100 dark:border-gray-800/50"
                      >
                        <td className="p-3 text-gray-900 dark:text-gray-100">
                          {item.productName}
                        </td>
                        <td className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">
                          {item.standardQuantity}
                        </td>
                        {canEdit && (
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item.productId)}
                              className="text-red-500"
                            >
                              Remover
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
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Adicionar Item">
        <div className="space-y-4">
          {error && (
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          )}
          <div>
            <label
              htmlFor="minibar-product"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Produto
            </label>
            <select
              id="minibar-product"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:bg-navy-800 dark:text-gray-100 dark:border-gray-700 transition-theme"
            >
              <option value="">Selecione...</option>
              {availableProducts?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            id="qty"
            label="Quantidade"
            type="number"
            min={1}
            value={addQty}
            onChange={(e) => setAddQty(Number(e.target.value))}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} isLoading={createMutation.isPending}>
              Adicionar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
