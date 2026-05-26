import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MealRankingSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export class MealRankingDto extends createZodDto(MealRankingSchema) {}

export type MealRankingData = z.infer<typeof MealRankingSchema>;
