import {
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
  'REPLENISH',
  'MEAL_OUT',
]);

export const stockMovements = pgTable('stock_movements', {
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
});
