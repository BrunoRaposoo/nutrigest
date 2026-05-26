import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const StockHistorySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export class StockHistoryDto extends createZodDto(StockHistorySchema) {}

export type StockHistoryData = z.infer<typeof StockHistorySchema>;
