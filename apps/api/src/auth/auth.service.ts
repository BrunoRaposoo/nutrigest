import { Injectable, ConflictException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import type { RegisterData } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private db: DbService) {}

  async register(dto: RegisterData) {
    const existing = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const [user] = await this.db.db
      .insert(users)
      .values({
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    return user;
  }
}
