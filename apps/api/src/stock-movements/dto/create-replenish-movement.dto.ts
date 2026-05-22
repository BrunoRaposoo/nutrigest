import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateReplenishMovementSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        consumedQuantity: z.number().int().min(1),
      }),
    )
    .min(1),
});

export class CreateReplenishMovementDto extends createZodDto(
  CreateReplenishMovementSchema,
) {}

export type CreateReplenishMovementData = z.infer<
  typeof CreateReplenishMovementSchema
>;
export type ReplenishItem = CreateReplenishMovementData['items'][number];
