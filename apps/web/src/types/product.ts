export type ProductCategory = 'BEVERAGE' | 'MEAL';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductData {
  name: string;
  category: ProductCategory;
  unit?: string;
}

export interface UpdateProductData {
  name?: string;
  category?: ProductCategory;
  unit?: string;
}
