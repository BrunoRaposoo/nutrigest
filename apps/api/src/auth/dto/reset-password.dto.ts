import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResetPasswordSchema = z.object({
  email: z.string().email().max(255),
  token: z.string().min(1),
  password: z.string().min(6).max(100),
});

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

export type ResetPasswordData = z.infer<typeof ResetPasswordSchema>;
