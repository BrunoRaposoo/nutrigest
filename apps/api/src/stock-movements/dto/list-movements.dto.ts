import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ListMovementsSchema = z.object({
  type: z.enum(['IN', 'CONSUMPTION', 'REPLENISH', 'MEAL_OUT']).optional(),
  room: z.coerce.number().int().min(101).max(110).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListMovementsDto extends createZodDto(ListMovementsSchema) {}

export type ListMovementsData = z.infer<typeof ListMovementsSchema>;
