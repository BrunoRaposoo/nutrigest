import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ChartsQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export class ChartsQueryDto extends createZodDto(ChartsQuerySchema) {}

export type ChartsQueryData = z.infer<typeof ChartsQuerySchema>;
