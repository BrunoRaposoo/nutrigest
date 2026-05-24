import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(6).max(100),
  role: z
    .enum(['ADMIN', 'TECHNICIAN', 'OPERATOR'])
    .optional()
    .default('OPERATOR'),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

export type CreateUserData = z.infer<typeof CreateUserSchema>;
