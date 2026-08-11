import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { products } from './products';

export const centralStock = pgTable(
  'central_stock',
  {
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .primaryKey()
      .notNull(),
    quantity: integer('quantity').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [check('central_stock_quantity_nonnegative', sql`${table.quantity} >= 0`)],
);