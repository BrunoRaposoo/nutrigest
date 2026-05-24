import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(['BEVERAGE', 'MEAL']).optional(),
  unit: z.string().min(1).max(50).optional(),
});

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}

export type UpdateProductData = z.infer<typeof UpdateProductSchema>;
