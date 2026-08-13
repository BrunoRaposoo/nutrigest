import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { products } from './products';
import { users } from './users';

export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'IN',
  'CONSUMPTION',
  'REPLENISH',
  'MEAL_OUT',
]);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: stockMovementTypeEnum('type').notNull(),
    productId: uuid('product_id')
      .references(() => products.id)
      .notNull(),
    quantity: integer('quantity').notNull(),
    room: integer('room'),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('stock_movements_type_idx').on(table.type),
    index('stock_movements_product_id_idx').on(table.productId),
    index('stock_movements_user_id_idx').on(table.userId),
    index('stock_movements_created_at_idx').on(table.createdAt),
  ],
);
