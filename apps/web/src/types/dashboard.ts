export interface DashboardSummary {
  totalProducts: number;
  totalStockItems: number;
  lowStockAlerts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    threshold: number;
  }>;
  todayMovements: number;
  recentMovements: Array<{
    id: string;
    type: string;
    productName: string;
    quantity: number;
    room: number | null;
    userName: string;
    createdAt: string;
  }>;
}

export interface MonthlyConsumption {
  month: string;
  replenishQty: number;
  mealOutQty: number;
}

export interface RoomComparison {
  room: number;
  totalQuantity: number;
}

export interface CategoryDistribution {
  category: string;
  quantity: number;
  percentage: number;
}

export interface StockEvolution {
  date: string;
  totalQuantity: number;
}
