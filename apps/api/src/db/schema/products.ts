import { pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const productCategoryEnum = pgEnum('product_category', [
  'BEVERAGE',
  'MEAL',
]);

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: productCategoryEnum('category').notNull(),
  unit: varchar('unit', { length: 50 }).notNull().default('un'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
