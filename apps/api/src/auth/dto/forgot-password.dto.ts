import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ForgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}

export type ForgotPasswordData = z.infer<typeof ForgotPasswordSchema>;
