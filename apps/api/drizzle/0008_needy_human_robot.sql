-- Custom migration: safely add CONSUMPTION to stock_movement_type enum
CREATE TYPE stock_movement_type_new AS ENUM ('IN', 'CONSUMPTION', 'REPLENISH', 'MEAL_OUT');
ALTER TABLE stock_movements ALTER COLUMN type TYPE stock_movement_type_new USING (type::text::stock_movement_type_new);
DROP TYPE stock_movement_type;
ALTER TYPE stock_movement_type_new RENAME TO stock_movement_type;
