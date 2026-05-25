export type MovementType = 'IN' | 'CONSUMPTION' | 'REPLENISH' | 'MEAL_OUT';

export interface CentralStockItem {
  productId: string;
  productName: string;
  productCategory: string;
  productImageUrl: string | null;
  quantity: number;
  updatedAt: string | null;
}

export interface MinibarItem {
  productId: string;
  productName: string;
  productCategory: string;
  productImageUrl: string | null;
  standardQuantity: number;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  type: MovementType;
  productId: string;
  productName: string;
  productCategory: string;
  quantity: number;
  room: number | null;
  userId: string;
  userName: string;
  description: string | null;
  createdAt: string;
}

export interface MovementFilters {
  type?: MovementType;
  room?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ReplenishItem {
  productId: string;
  productName: string;
  consumedQuantity: number;
  restockedQuantity: number;
}
