import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StockHistorySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export class StockHistoryDto extends createZodDto(StockHistorySchema) {}

export type StockHistoryData = z.infer<typeof StockHistorySchema>;
