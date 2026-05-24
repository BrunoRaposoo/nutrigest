import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateStockSchema = z.object({
  quantity: z.number().int().min(0),
});

export class UpdateStockDto extends createZodDto(UpdateStockSchema) {}

export type UpdateStockData = z.infer<typeof UpdateStockSchema>;
