import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(6).max(100).optional(),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'OPERATOR']).optional(),
});

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}

export type UpdateUserData = z.infer<typeof UpdateUserSchema>;
