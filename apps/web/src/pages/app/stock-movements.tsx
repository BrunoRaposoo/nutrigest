import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import {
  useCreateInMovement,
  useCreateMealOut,
  useCreateReplenish,
  useMovements,
} from '../../hooks/queries/use-movement-queries';
import { cn, formatDate } from '../../lib/utils';

type Tab = 'list' | 'in' | 'replenish' | 'meal-out';

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'list', label: 'Lista' },
  { key: 'in', label: 'Entrada' },
  { key: 'replenish', label: 'Reposição' },
  { key: 'meal-out', label: 'Retirada' },
];

const inSchema = z.object({
  productId: z.string().min(1, 'Produto é obrigatório'),
  quantity: z.coerce.number().min(1, 'Quantidade deve ser maior que 0'),
  description: z.string().optional(),
});

type InForm = z.infer<typeof inSchema>;

export default function StockMovements() {
  const [tab, setTab] = useState<Tab>('list');
  const { data: movements, isLoading } = useMovements();
  const createIn = useCreateInMovement();
  const createReplenish = useCreateReplenish();
  const createMealOut = useCreateMealOut();

  const inForm = useForm<InForm>({ resolver: zodResolver(inSchema) });
  const [replenishRoom, setReplenishRoom] = useState(101);
  const [replenishItems, setReplenishItems] = useState<
    Array<{ productId: string; quantity: number }>
  >([]);

  const [mealOutProduct, setMealOutProduct] = useState('');
  const [mealOutQty, setMealOutQty] = useState(1);

  const handleIn = async (data: InForm) => {
    await createIn.mutateAsync({
      items: [{ productId: data.productId, quantity: data.quantity }],
      description: data.description,
    });
    inForm.reset();
  };

  const handleReplenish = async () => {
    await createReplenish.mutateAsync({
      room: replenishRoom,
      items: replenishItems,
    });
    setReplenishItems([]);
  };

  const handleMealOut = async () => {
    if (!mealOutProduct) return;
    await createMealOut.mutateAsync({
      productId: mealOutProduct,
      quantity: mealOutQty,
    });
    setMealOutProduct('');
    setMealOutQty(1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Movimentações
      </h1>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              tab === t.key
                ? 'bg-navy-700 text-white dark:bg-gold-500 dark:text-navy-900'
                : 'bg-white text-gray-600 border border-gray-200 dark:bg-navy-800 dark:text-gray-400 dark:border-gray-800',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
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
                        Tipo
                      </th>
                      <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                        Qtd
                      </th>
                      <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements?.map((mov) => (
                      <tr
                        key={mov.id}
                        className="border-b border-gray-100 dark:border-gray-800/50"
                      >
                        <td className="p-3 text-gray-900 dark:text-gray-100">
                          {mov.productName}
                        </td>
                        <td className="p-3 hidden sm:table-cell">
                          <Badge
                            variant={
                              mov.type === 'IN'
                                ? 'info'
                                : mov.type === 'REPLENISH'
                                  ? 'success'
                                  : 'warning'
                            }
                          >
                            {mov.type === 'IN'
                              ? 'Entrada'
                              : mov.type === 'REPLENISH'
                                ? 'Reposição'
                                : 'Retirada'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">
                          {mov.quantity}
                        </td>
                        <td className="p-3 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                          {formatDate(mov.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'in' && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar Entrada</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={inForm.handleSubmit(handleIn)}
              className="space-y-4 max-w-md"
            >
              <Input
                id="productId"
                label="ID do Produto"
                placeholder="uuid do produto"
                error={inForm.formState.errors.productId?.message}
                {...inForm.register('productId')}
              />
              <Input
                id="quantity"
                label="Quantidade"
                type="number"
                error={inForm.formState.errors.quantity?.message}
                {...inForm.register('quantity')}
              />
              <Input
                id="description"
                label="Descrição (opcional)"
                {...inForm.register('description')}
              />
              <Button type="submit" isLoading={createIn.isPending}>
                Registrar
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'replenish' && (
        <Card>
          <CardHeader>
            <CardTitle>Reposição de Frigobar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <Input
              id="room"
              label="Quarto"
              type="number"
              value={replenishRoom}
              onChange={(e) => setReplenishRoom(Number(e.target.value))}
            />
            <div className="flex gap-2">
              <Input
                id="pid"
                label="Produto ID"
                value={replenishItems.map((i) => i.productId).join(', ')}
                onChange={() => {}}
              />
            </div>
            <Button
              onClick={handleReplenish}
              isLoading={createReplenish.isPending}
            >
              Repor
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'meal-out' && (
        <Card>
          <CardHeader>
            <CardTitle>Retirada de Marmita</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <Input
              id="productId"
              label="ID do Produto"
              value={mealOutProduct}
              onChange={(e) => setMealOutProduct(e.target.value)}
            />
            <Input
              id="qty"
              label="Quantidade"
              type="number"
              value={mealOutQty}
              onChange={(e) => setMealOutQty(Number(e.target.value))}
            />
            <Button onClick={handleMealOut} isLoading={createMealOut.isPending}>
              Retirar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
