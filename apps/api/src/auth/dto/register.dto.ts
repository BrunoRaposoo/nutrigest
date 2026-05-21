import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(6).max(100),
  role: z
    .enum(['ADMIN', 'TECHNICIAN', 'OPERATOR'])
    .optional()
    .default('OPERATOR'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}

export type RegisterData = z.infer<typeof RegisterSchema>;
