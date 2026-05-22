import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateInMovementSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
  description: z.string().optional(),
});

export class CreateInMovementDto extends createZodDto(CreateInMovementSchema) {}

export type CreateInMovementData = z.infer<typeof CreateInMovementSchema>;
export type InMovementItem = CreateInMovementData['items'][number];
