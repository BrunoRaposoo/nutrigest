import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AddMinibarItemSchema = z.object({
  productId: z.string().uuid(),
  standardQuantity: z.number().int().min(1),
});

export class AddMinibarItemDto extends createZodDto(AddMinibarItemSchema) {}

export type AddMinibarItemData = z.infer<typeof AddMinibarItemSchema>;
