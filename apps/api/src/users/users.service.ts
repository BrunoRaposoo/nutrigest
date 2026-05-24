import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { users } from '../db/schema';
import type { CreateUserData } from './dto/create-user.dto';
import type { UpdateUserData } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private db: DbService) {}

  async findAll() {
    return this.db.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users);
  }

  async findOne(id: string) {
    const [user] = await this.db.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(dto: CreateUserData) {
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
        updatedAt: users.updatedAt,
      });

    return user;
  }

  async update(id: string, dto: UpdateUserData) {
    const [existing] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.db.db
        .select()
        .from(users)
        .where(eq(users.email, dto.email))
        .limit(1);

      if (emailTaken.length > 0) {
        throw new ConflictException('Email already in use');
      }
    }

    const values: Partial<typeof users.$inferInsert> = {};
    if (dto.name) values.name = dto.name;
    if (dto.email) values.email = dto.email;
    if (dto.role) values.role = dto.role;
    if (dto.password) {
      values.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (Object.keys(values).length === 0) {
      return this.findOne(id);
    }

    const [user] = await this.db.db
      .update(users)
      .set(values)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return user;
  }

  async remove(id: string) {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.db.db.delete(users).where(eq(users.id, id));

    return { message: 'User deleted successfully' };
  }
}
