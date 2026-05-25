import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateMealOutMovementSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  description: z.string().min(1, 'Descrição/destino é obrigatório'),
});

export class CreateMealOutMovementDto extends createZodDto(
  CreateMealOutMovementSchema,
) {}

export type CreateMealOutMovementData = z.infer<
  typeof CreateMealOutMovementSchema
>;
