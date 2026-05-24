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
