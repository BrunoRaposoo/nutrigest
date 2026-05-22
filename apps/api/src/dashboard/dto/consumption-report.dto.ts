import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ConsumptionReportSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export class ConsumptionReportDto extends createZodDto(ConsumptionReportSchema) {}

export type ConsumptionReportData = z.infer<typeof ConsumptionReportSchema>;
