import { useState } from 'react';
import { BarChart } from '../../components/shared/bar-chart';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import {
  useCategoryDistribution,
  useConsumptionByRoomCsv,
  useConsumptionByRoomPdf,
  useDashboardSummary,
  useMealRankingCsv,
  useMealRankingPdf,
  useMonthlyConsumption,
  useRoomComparison,
  useStockHistoryCsv,
  useStockHistoryPdf,
} from '../../hooks/queries/use-dashboard-queries';
import { useProducts } from '../../hooks/queries/use-product-queries';
import { formatDateShort } from '../../lib/utils';

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: monthly } = useMonthlyConsumption();
  const { data: rooms } = useRoomComparison();
  const { data: categories } = useCategoryDistribution();

  const [consumptionFrom, setConsumptionFrom] = useState('');
  const [consumptionTo, setConsumptionTo] = useState('');
  const [rankingFrom, setRankingFrom] = useState('');
  const [rankingTo, setRankingTo] = useState('');
  const [rankingLimit, setRankingLimit] = useState('10');
  const [historyProductId, setHistoryProductId] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const { data: products } = useProducts();

  const {
    download: downloadConsumptionCsv,
    isDownloading: isConsumptionCsvLoading,
  } = useConsumptionByRoomCsv(consumptionFrom, consumptionTo);
  const {
    download: downloadConsumptionPdf,
    isDownloading: isConsumptionPdfLoading,
  } = useConsumptionByRoomPdf(consumptionFrom, consumptionTo);
  const { download: downloadRankingCsv, isDownloading: isRankingCsvLoading } =
    useMealRankingCsv(rankingFrom, rankingTo, rankingLimit);
  const { download: downloadRankingPdf, isDownloading: isRankingPdfLoading } =
    useMealRankingPdf(rankingFrom, rankingTo, rankingLimit);
  const { download: downloadHistoryCsv, isDownloading: isHistoryCsvLoading } =
    useStockHistoryCsv(historyProductId, historyFrom, historyTo);
  const { download: downloadHistoryPdf, isDownloading: isHistoryPdfLoading } =
    useStockHistoryPdf(historyProductId, historyFrom, historyTo);

  if (summaryLoading) {
    return (
      <div className="space-y-6 transition-theme">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            /* biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading placeholder */
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 transition-theme">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Produtos</p>
            <p className="text-2xl font-bold text-navy-700 dark:text-gold-500">
              {summary?.totalProducts ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Itens em Estoque
            </p>
            <p className="text-2xl font-bold text-navy-700 dark:text-gold-500">
              {summary?.totalStockItems ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Estoque Baixo
            </p>
            <p className="text-2xl font-bold text-red-500">
              {summary?.lowStockAlerts?.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mov. Hoje
            </p>
            <p className="text-2xl font-bold text-navy-700 dark:text-gold-500">
              {summary?.todayMovements ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {summary && summary.lowStockAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Estoque Baixo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
                      Produto
                    </th>
                    <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">
                      Qtd
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lowStockAlerts.map((alert) => (
                    <tr
                      key={alert.productId}
                      className="border-b border-gray-100 dark:border-gray-800/50"
                    >
                      <td className="p-3 text-gray-900 dark:text-gray-100">
                        {alert.productName}
                      </td>
                      <td className="p-3 text-right">
                        <Badge variant="danger">{alert.quantity}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {monthly && monthly.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Consumo Mensal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Reposições
                </p>
                <BarChart
                  data={monthly.map((m) => ({
                    label: m.month.slice(0, 3),
                    value: m.replenishQty,
                  }))}
                  height={180}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Marmitas Retiradas
                </p>
                <BarChart
                  data={monthly.map((m) => ({
                    label: m.month.slice(0, 3),
                    value: m.mealOutQty,
                  }))}
                  height={180}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {rooms && rooms.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Consumo por Quarto</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                data={rooms.map((r) => ({
                  label: `Q${r.room}`,
                  value: r.totalQuantity,
                }))}
                height={220}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {categories && categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição do Estoque por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">
                      {cat.category === 'BEVERAGE' ? 'Bebidas' : 'Marmitas'}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {cat.percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden transition-theme">
                    <div
                      className="h-full bg-gold-500 rounded-full transition-all"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary && summary.recentMovements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Movimentações Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
                      Produto
                    </th>
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">
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
                  {summary.recentMovements.map((mov) => (
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
                      <td className="p-3 text-right text-gray-700 dark:text-gray-300">
                        {mov.quantity}
                      </td>
                      <td className="p-3 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        {formatDateShort(mov.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Consumo por Quarto</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Exportar consumo agrupado por quarto e produto
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="date"
                label="De"
                value={consumptionFrom}
                onChange={(e) => setConsumptionFrom(e.target.value)}
              />
              <Input
                type="date"
                label="Até"
                value={consumptionTo}
                onChange={(e) => setConsumptionTo(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                isLoading={isConsumptionCsvLoading}
                onClick={downloadConsumptionCsv}
              >
                CSV
              </Button>
              <Button
                size="sm"
                variant="primary"
                isLoading={isConsumptionPdfLoading}
                onClick={downloadConsumptionPdf}
              >
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de Marmitas</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Exportar ranking de produtos retirados
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="date"
                label="De"
                value={rankingFrom}
                onChange={(e) => setRankingFrom(e.target.value)}
              />
              <Input
                type="date"
                label="Até"
                value={rankingTo}
                onChange={(e) => setRankingTo(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Input
                type="number"
                label="Limite"
                min={1}
                max={100}
                value={rankingLimit}
                onChange={(e) => setRankingLimit(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                isLoading={isRankingCsvLoading}
                onClick={downloadRankingCsv}
              >
                CSV
              </Button>
              <Button
                size="sm"
                variant="primary"
                isLoading={isRankingPdfLoading}
                onClick={downloadRankingPdf}
              >
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Estoque</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Exportar movimentações de um produto
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select
              label="Produto"
              placeholder="Selecione um produto"
              value={historyProductId}
              onChange={(e) => setHistoryProductId(e.target.value)}
              options={
                products?.map((p) => ({
                  value: p.id,
                  label: p.name,
                })) ?? []
              }
            />
            <div className="flex gap-2">
              <Input
                type="date"
                label="De"
                value={historyFrom}
                onChange={(e) => setHistoryFrom(e.target.value)}
              />
              <Input
                type="date"
                label="Até"
                value={historyTo}
                onChange={(e) => setHistoryTo(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!historyProductId}
                isLoading={isHistoryCsvLoading}
                onClick={downloadHistoryCsv}
              >
                CSV
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!historyProductId}
                isLoading={isHistoryPdfLoading}
                onClick={downloadHistoryPdf}
              >
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
