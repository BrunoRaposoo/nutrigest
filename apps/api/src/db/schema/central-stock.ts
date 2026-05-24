import { integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from './products';

export const centralStock = pgTable('central_stock', {
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .primaryKey()
    .notNull(),
  quantity: integer('quantity').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
