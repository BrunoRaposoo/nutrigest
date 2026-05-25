import { useRef, useState } from 'react';
import MovementCard from '../../components/stock/MovementCard';
import ProductSelect from '../../components/stock/ProductSelect';
import QuantityStepper from '../../components/stock/QuantityStepper';
import RoomSelect from '../../components/stock/RoomSelect';
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
import { useMinibarStandard } from '../../hooks/queries/use-minibar-queries';
import {
  useCreateInMovement,
  useCreateMealOut,
  useCreateReplenish,
  useMovements,
} from '../../hooks/queries/use-movement-queries';
import { useProducts } from '../../hooks/queries/use-product-queries';
import { cn, formatDate } from '../../lib/utils';

type Tab = 'list' | 'in' | 'rooms' | 'meals';

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'list', label: 'Lista' },
  { key: 'in', label: 'Entrada' },
  { key: 'rooms', label: 'Quartos' },
  { key: 'meals', label: 'Marmitas' },
];

export default function StockMovements() {
  const [tab, setTab] = useState<Tab>('rooms');
  const { data: movements, isLoading } = useMovements();
  const { data: products = [] } = useProducts();

  // IN tab state
  const nextItemId = useRef(2);
  const [inItems, setInItems] = useState<
    Array<{ id: number; productId: string; quantity: number }>
  >([{ id: 1, productId: '', quantity: 1 }]);
  const [inDescription, setInDescription] = useState('');
  const createIn = useCreateInMovement();

  // Rooms tab state
  const [selectedRoom, setSelectedRoom] = useState(0);
  const { data: roomProducts = [] } = useMinibarStandard(selectedRoom);
  const [roomItems, setRoomItems] = useState<
    Record<string, { consumedQuantity: number; restockedQuantity: number }>
  >({});
  const createReplenish = useCreateReplenish();

  // Meals tab state
  const [mealProductId, setMealProductId] = useState('');
  const [mealQty, setMealQty] = useState(1);
  const [mealDescription, setMealDescription] = useState('');
  const createMealOut = useCreateMealOut();

  // Filter state for list tab
  const [filterType, setFilterType] = useState('');
  const [filterRoom, setFilterRoom] = useState('');

  const handleAddInItem = () => {
    const id = nextItemId.current++;
    setInItems([...inItems, { id, productId: '', quantity: 1 }]);
  };

  const handleUpdateInItem = (
    id: number,
    field: 'productId' | 'quantity',
    value: string | number,
  ) => {
    setInItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleRemoveInItem = (id: number) => {
    if (inItems.length > 1) {
      setInItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleIn = async () => {
    const validItems = inItems.filter(
      (item) => item.productId && item.quantity > 0,
    );
    if (validItems.length === 0) return;

    await createIn.mutateAsync({
      items: validItems.map(({ id: _id, ...rest }) => rest),
      description: inDescription || undefined,
    });
    nextItemId.current = 2;
    setInItems([{ id: 1, productId: '', quantity: 1 }]);
    setInDescription('');
  };

  const handleRoomProductChange = (
    productId: string,
    field: 'consumedQuantity' | 'restockedQuantity',
    value: number,
  ) => {
    setRoomItems((prev) => ({
      ...prev,
      [productId]: {
        consumedQuantity: prev[productId]?.consumedQuantity ?? 0,
        restockedQuantity: prev[productId]?.restockedQuantity ?? 0,
        [field]: value,
      },
    }));
  };

  const handleReplenish = async () => {
    if (!selectedRoom) return;

    const items = Object.entries(roomItems)
      .filter(
        ([_, values]) =>
          values.consumedQuantity > 0 || values.restockedQuantity > 0,
      )
      .map(([productId, values]) => ({
        productId,
        consumedQuantity: values.consumedQuantity,
        restockedQuantity: values.restockedQuantity,
      }));

    if (items.length === 0) return;

    await createReplenish.mutateAsync({
      room: selectedRoom,
      items,
    });

    setRoomItems({});
  };

  const handleRoomChange = (room: number) => {
    setSelectedRoom(room);
    setRoomItems({});
  };

  const handleMealOut = async () => {
    if (!mealProductId || !mealDescription) return;

    await createMealOut.mutateAsync({
      productId: mealProductId,
      quantity: mealQty,
      description: mealDescription,
    });
    setMealProductId('');
    setMealQty(1);
    setMealDescription('');
  };

  const filteredMovements = movements?.filter((mov) => {
    if (filterType && mov.type !== filterType) return false;
    if (filterRoom && mov.room !== Number(filterRoom)) return false;
    return true;
  });

  const recentMeals = movements
    ?.filter((m) => m.type === 'MEAL_OUT')
    .slice(0, 5);

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
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-navy-800 dark:text-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500"
              >
                <option value="">Todos os tipos</option>
                <option value="IN">Entrada</option>
                <option value="CONSUMPTION">Consumo</option>
                <option value="REPLENISH">Reposição</option>
                <option value="MEAL_OUT">Marmita</option>
              </select>
              <input
                type="number"
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                placeholder="Quarto"
                className="w-20 px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-navy-800 dark:text-gray-100 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  /* biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading placeholder */
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredMovements && filteredMovements.length > 0 ? (
              <>
                <div className="sm:hidden p-3 space-y-3">
                  {filteredMovements.map((mov) => (
                    <MovementCard key={mov.id} movement={mov} />
                  ))}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
                          Produto
                        </th>
                        <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
                          Tipo
                        </th>
                        <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          Quarto
                        </th>
                        <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                          Qtd
                        </th>
                        <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400 hidden lg:table-cell">
                          Destino
                        </th>
                        <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell">
                          Data
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.map((mov) => (
                        <tr
                          key={mov.id}
                          className="border-b border-gray-100 dark:border-gray-800/50"
                        >
                          <td className="p-3 text-gray-900 dark:text-gray-100">
                            {mov.productName}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                mov.type === 'IN'
                                  ? 'info'
                                  : mov.type === 'REPLENISH'
                                    ? 'success'
                                    : mov.type === 'CONSUMPTION'
                                      ? 'default'
                                      : 'warning'
                              }
                            >
                              {mov.type === 'IN'
                                ? 'Entrada'
                                : mov.type === 'CONSUMPTION'
                                  ? 'Consumo'
                                  : mov.type === 'REPLENISH'
                                    ? 'Reposição'
                                    : 'Marmita'}
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {mov.room ?? '-'}
                          </td>
                          <td className="p-3 text-right font-medium text-gray-700 dark:text-gray-300">
                            {mov.quantity}
                          </td>
                          <td className="p-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell max-w-[200px] truncate">
                            {mov.description ?? '-'}
                          </td>
                          <td className="p-3 text-right text-gray-500 dark:text-gray-400 hidden md:table-cell">
                            {formatDate(mov.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                Nenhuma movimentação encontrada
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'in' && (
        <Card>
          <CardHeader>
            <CardTitle>Entrada de Mercadorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inItems.map((item) => (
              <div
                key={item.id}
                className="flex items-end gap-2 pb-4 border-b border-gray-100 dark:border-gray-800"
              >
                <div className="flex-1">
                  <div className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Produto
                  </div>
                  <ProductSelect
                    products={products}
                    value={item.productId}
                    onChange={(id) =>
                      handleUpdateInItem(item.id, 'productId', id)
                    }
                    placeholder="Buscar produto..."
                  />
                </div>
                <div>
                  <div className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Qtd
                  </div>
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(qty) =>
                      handleUpdateInItem(item.id, 'quantity', qty)
                    }
                    min={1}
                    max={999}
                  />
                </div>
                {inItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveInItem(item.id)}
                    className="mb-1 p-2 text-red-500 hover:text-red-700 text-lg"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddInItem}
              className="text-sm text-navy-600 dark:text-gold-400 hover:underline"
            >
              + Adicionar item
            </button>

            <Input
              id="inDescription"
              label="Descrição (opcional)"
              value={inDescription}
              onChange={(e) => setInDescription(e.target.value)}
            />

            <Button
              onClick={handleIn}
              isLoading={createIn.isPending}
              disabled={!inItems.some((i) => i.productId)}
              className="w-full sm:w-auto"
            >
              Registrar Entrada
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 'rooms' && (
        <Card>
          <CardHeader>
            <CardTitle>Reposição de Frigobar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RoomSelect value={selectedRoom} onChange={handleRoomChange} />

            {selectedRoom ? (
              roomProducts.length > 0 ? (
                <div className="space-y-4">
                  {roomProducts.map((rp) => (
                    <div
                      key={rp.productId}
                      className="p-4 bg-gray-50 dark:bg-navy-900 rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {rp.productName}
                        </span>
                        <span className="text-xs text-gray-400">
                          Padrão: {rp.standardQuantity}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <QuantityStepper
                          label="Consumido"
                          value={roomItems[rp.productId]?.consumedQuantity ?? 0}
                          onChange={(val) =>
                            handleRoomProductChange(
                              rp.productId,
                              'consumedQuantity',
                              val,
                            )
                          }
                        />
                        <QuantityStepper
                          label="Reposto"
                          value={
                            roomItems[rp.productId]?.restockedQuantity ?? 0
                          }
                          onChange={(val) =>
                            handleRoomProductChange(
                              rp.productId,
                              'restockedQuantity',
                              val,
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={handleReplenish}
                    isLoading={createReplenish.isPending}
                    disabled={
                      !Object.values(roomItems).some(
                        (v) =>
                          v.consumedQuantity > 0 || v.restockedQuantity > 0,
                      )
                    }
                    className="w-full"
                    size="lg"
                  >
                    Finalizar Reposição
                  </Button>
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  Nenhum produto configurado para este quarto.{' '}
                  <span className="block text-sm mt-1">
                    Configure os produtos padrão em{' '}
                    <span className="font-medium">Quartos</span> no menu.
                  </span>
                </div>
              )
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Selecione um quarto para começar
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'meals' && (
        <Card>
          <CardHeader>
            <CardTitle>Retirada de Marmitas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Produto
              </div>
              <ProductSelect
                products={products}
                value={mealProductId}
                onChange={setMealProductId}
                placeholder="Buscar marmita..."
              />
            </div>

            <div>
              <div className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Quantidade
              </div>
              <QuantityStepper
                value={mealQty}
                onChange={setMealQty}
                min={1}
                max={99}
              />
            </div>

            <Input
              id="mealDestination"
              label="Destino / Observação"
              placeholder="Ex: Funcionário João, Acompanhante 103..."
              value={mealDescription}
              onChange={(e) => setMealDescription(e.target.value)}
            />

            <Button
              onClick={handleMealOut}
              isLoading={createMealOut.isPending}
              disabled={!mealProductId || !mealDescription}
              className="w-full sm:w-auto"
            >
              Registrar Retirada
            </Button>

            {recentMeals && recentMeals.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Últimas retiradas
                </h3>
                <div className="space-y-2">
                  {recentMeals.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-sm py-2 px-3 bg-gray-50 dark:bg-navy-900 rounded-lg"
                    >
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {m.productName}
                        </span>
                        <span className="text-gray-500 ml-2">
                          {m.description}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                          {m.quantity}x
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatDate(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
