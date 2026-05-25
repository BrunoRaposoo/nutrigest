import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { MinibarItem } from '../../types/stock';

export function useMinibarStandard(room: number) {
  return useQuery<MinibarItem[]>({
    queryKey: ['minibar-standard', room],
    queryFn: () => api.get(`/minibar-standard/${room}`).then((r) => r.data),
    enabled: !!room,
  });
}

export function useRooms() {
  return useQuery<number[]>({
    queryKey: ['rooms'],
    queryFn: () => api.get('/minibar-standard/rooms').then((r) => r.data),
  });
}
