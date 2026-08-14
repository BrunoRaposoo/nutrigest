import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockMovements from './stock-movements';

vi.mock('../../hooks/queries/use-movement-queries', () => ({
  useMovements: vi.fn(),
  useCreateInMovement: vi.fn(),
  useCreateReplenish: vi.fn(),
  useCreateMealOut: vi.fn(),
}));

vi.mock('../../hooks/queries/use-product-queries', () => ({
  useProducts: vi.fn(),
}));

vi.mock('../../hooks/queries/use-minibar-queries', () => ({
  useMinibarStandard: vi.fn(),
  useRooms: vi.fn(),
}));

import {
  useMinibarStandard,
  useRooms,
} from '../../hooks/queries/use-minibar-queries';
import {
  useCreateInMovement,
  useCreateMealOut,
  useCreateReplenish,
  useMovements,
} from '../../hooks/queries/use-movement-queries';
import { useProducts } from '../../hooks/queries/use-product-queries';

const mockUseMovements = vi.mocked(useMovements);
const mockUseProducts = vi.mocked(useProducts);
const mockUseMinibarStandard = vi.mocked(useMinibarStandard);
const mockUseRooms = vi.mocked(useRooms);
const mockCreateIn = vi.mocked(useCreateInMovement);
const mockCreateReplenish = vi.mocked(useCreateReplenish);
const mockCreateMealOut = vi.mocked(useCreateMealOut);

function mockMutation() {
  return {
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMovements.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  } as never);
  mockUseProducts.mockReturnValue({ data: [] } as never);
  mockUseMinibarStandard.mockReturnValue({ data: [] } as never);
  mockUseRooms.mockReturnValue({ data: [] } as never);
  mockCreateIn.mockReturnValue(mockMutation() as never);
  mockCreateReplenish.mockReturnValue(mockMutation() as never);
  mockCreateMealOut.mockReturnValue(mockMutation() as never);
});

describe('StockMovements', () => {
  it('loads recent meals from the server with MEAL_OUT filter and limit 5', () => {
    const calls: unknown[][] = [];
    mockUseMovements.mockImplementation(((filters?: unknown) => {
      calls.push(filters ? [filters] : []);
      return {
        data: [],
        isLoading: false,
        isError: false,
        error: null,
      } as never;
    }) as never);

    render(<StockMovements />);

    const mealOutCall = calls.find(([f]) => f && typeof f === 'object');
    expect(mealOutCall).toBeDefined();
    expect(mealOutCall?.[0]).toEqual({
      type: 'MEAL_OUT',
      page: 1,
      limit: 5,
    });
  });

  it('renders recent meals returned by the server', async () => {
    const recentMeals = [
      {
        id: 'm1',
        productId: 'p1',
        productName: 'Marmita',
        type: 'MEAL_OUT',
        quantity: 2,
        room: null,
        description: 'João',
        userName: 'Ana',
        createdAt: '2026-08-13T10:00:00.000Z',
      },
    ];
    mockUseMovements.mockImplementation(((filters?: unknown) => {
      if (
        filters &&
        typeof filters === 'object' &&
        'type' in (filters as object)
      ) {
        return { data: recentMeals } as never;
      }
      return { data: [] } as never;
    }) as never);

    render(<StockMovements />);
    await userEvent.click(screen.getByRole('button', { name: 'Marmitas' }));

    expect(screen.getByText('Últimas retiradas')).toBeInTheDocument();
    expect(screen.getByText('João')).toBeInTheDocument();
  });
});
