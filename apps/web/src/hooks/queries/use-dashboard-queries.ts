import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  CategoryDistribution,
  DashboardSummary,
  MonthlyConsumption,
  RoomComparison,
} from '../../types/dashboard';

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data),
  });
}

export function useMonthlyConsumption(from?: string, to?: string) {
  return useQuery<MonthlyConsumption[]>({
    queryKey: ['dashboard', 'monthly-consumption', from, to],
    queryFn: () =>
      api
        .get('/dashboard/charts/monthly-consumption', { params: { from, to } })
        .then((r) => r.data),
  });
}

export function useRoomComparison(from?: string, to?: string) {
  return useQuery<RoomComparison[]>({
    queryKey: ['dashboard', 'room-comparison', from, to],
    queryFn: () =>
      api
        .get('/dashboard/charts/room-comparison', { params: { from, to } })
        .then((r) => r.data),
  });
}

export function useCategoryDistribution() {
  return useQuery<CategoryDistribution[]>({
    queryKey: ['dashboard', 'category-distribution'],
    queryFn: () =>
      api.get('/dashboard/charts/category-distribution').then((r) => r.data),
  });
}

// -- Export helpers (CSV / PDF) --

import { useDownloadReport } from '../use-download-report';

function buildQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (v): v is [string, string] => v[1] != null && v[1] !== '',
  );
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
}

export function useConsumptionByRoomCsv(from?: string, to?: string) {
  return useDownloadReport(
    `/dashboard/consumption-by-room/csv${buildQueryString({ from, to })}`,
    'consumption-by-room.csv',
    'csv',
  );
}

export function useConsumptionByRoomPdf(from?: string, to?: string) {
  return useDownloadReport(
    `/dashboard/consumption-by-room/pdf${buildQueryString({ from, to })}`,
    'consumption-by-room.pdf',
    'pdf',
  );
}

export function useMealRankingCsv(from?: string, to?: string, limit?: string) {
  const base = `/dashboard/meal-ranking/csv${buildQueryString({ from, to })}`;
  const url = limit ? `${base}&limit=${limit}` : base;
  return useDownloadReport(url, 'meal-ranking.csv', 'csv');
}

export function useMealRankingPdf(from?: string, to?: string, limit?: string) {
  const base = `/dashboard/meal-ranking/pdf${buildQueryString({ from, to })}`;
  const url = limit ? `${base}&limit=${limit}` : base;
  return useDownloadReport(url, 'meal-ranking.pdf', 'pdf');
}

export function useStockHistoryCsv(
  productId: string,
  from?: string,
  to?: string,
) {
  return useDownloadReport(
    `/dashboard/stock-history/${productId}/csv${buildQueryString({ from, to })}`,
    'stock-history.csv',
    'csv',
  );
}

export function useStockHistoryPdf(
  productId: string,
  from?: string,
  to?: string,
) {
  return useDownloadReport(
    `/dashboard/stock-history/${productId}/pdf${buildQueryString({ from, to })}`,
    'stock-history.pdf',
    'pdf',
  );
}
