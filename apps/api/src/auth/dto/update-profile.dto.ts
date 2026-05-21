import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(6).max(100).optional(),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}

export type UpdateProfileData = z.infer<typeof UpdateProfileSchema>;
