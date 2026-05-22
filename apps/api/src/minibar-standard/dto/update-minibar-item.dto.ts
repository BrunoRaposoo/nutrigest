import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateMinibarItemSchema = z.object({
  standardQuantity: z.number().int().min(1),
});

export class UpdateMinibarItemDto extends createZodDto(UpdateMinibarItemSchema) {}

export type UpdateMinibarItemData = z.infer<typeof UpdateMinibarItemSchema>;
