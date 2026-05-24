import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { MovementFilters, StockMovement } from '../../types/stock';

export function useMovements(filters: MovementFilters = {}) {
  return useQuery<StockMovement[]>({
    queryKey: ['stock-movements', filters],
    queryFn: () =>
      api.get('/stock-movements', { params: filters }).then((r) => r.data),
  });
}

export function useCreateInMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      items: Array<{ productId: string; quantity: number }>;
      description?: string;
    }) => api.post('/stock-movements/in', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['central-stock'] });
    },
  });
}

export function useCreateReplenish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      room: number;
      items: Array<{ productId: string; quantity: number }>;
    }) =>
      api.post(`/stock-movements/replenish/${data.room}`, {
        items: data.items,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['central-stock'] });
    },
  });
}

export function useCreateMealOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { productId: string; quantity: number }) =>
      api.post('/stock-movements/meal-out', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['central-stock'] });
    },
  });
}
