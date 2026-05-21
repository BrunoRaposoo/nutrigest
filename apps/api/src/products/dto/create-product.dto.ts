import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['BEVERAGE', 'MEAL']),
  unit: z.string().min(1).max(50).optional().default('un'),
});

export class CreateProductDto extends createZodDto(CreateProductSchema) {}

export type CreateProductData = z.infer<typeof CreateProductSchema>;
