import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ConsumptionReportSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export class ConsumptionReportDto extends createZodDto(
  ConsumptionReportSchema,
) {}

export type ConsumptionReportData = z.infer<typeof ConsumptionReportSchema>;
