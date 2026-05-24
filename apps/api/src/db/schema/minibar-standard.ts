import { integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { products } from './products';

export const minibarStandard = pgTable(
  'minibar_standard',
  {
    room: integer('room').notNull(),
    productId: uuid('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    standardQuantity: integer('standard_quantity').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: unique('minibar_standard_room_product_pk').on(
      table.room,
      table.productId,
    ),
  }),
);
