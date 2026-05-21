export const ProductCategory = {
  BEVERAGE: 'BEVERAGE',
  MEAL: 'MEAL',
} as const;

export type ProductCategory =
  (typeof ProductCategory)[keyof typeof ProductCategory];
