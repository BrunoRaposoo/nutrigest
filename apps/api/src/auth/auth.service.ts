import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { passwordResetTokens, refreshTokens, users } from '../db/schema';
import type { ForgotPasswordData } from './dto/forgot-password.dto';
import type { LoginData } from './dto/login.dto';
import type { RefreshData } from './dto/refresh.dto';
import type { RegisterData } from './dto/register.dto';
import type { ResetPasswordData } from './dto/reset-password.dto';
import type { UpdateProfileData } from './dto/update-profile.dto';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwtService: JwtService,
  ) {}

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
        role: 'OPERATOR',
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

  async login(dto: LoginData) {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.db.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, user.id));

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async logout(userId: string) {
    await this.db.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, userId));
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
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
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileData) {
    const [existing] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existing) {
      throw new UnauthorizedException('User not found');
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
    if (dto.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Senha atual é obrigatória para alterar a senha',
        );
      }
      const isCurrentValid = await bcrypt.compare(
        dto.currentPassword,
        existing.passwordHash,
      );
      if (!isCurrentValid) {
        throw new UnauthorizedException('Senha atual incorreta');
      }
      if (dto.currentPassword === dto.password) {
        throw new BadRequestException(
          'A nova senha não pode ser igual à atual',
        );
      }
      values.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (Object.keys(values).length === 0) {
      return this.getProfile(userId);
    }

    const [user] = await this.db.db
      .update(users)
      .set(values)
      .where(eq(users.id, userId))
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

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshTokenDigest = sha256(rawRefreshToken);

    await this.db.db.insert(refreshTokens).values({
      userId,
      tokenDigest: refreshTokenDigest,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async forgotPassword(dto: ForgotPasswordData) {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      return {
        message: 'If that email exists, a reset token has been generated',
      };
    }

    await this.db.db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    const rawToken = randomBytes(48).toString('hex');
    const tokenDigest = sha256(rawToken);

    await this.db.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenDigest,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    if (process.env.NODE_ENV === 'production') {
      return {
        message: 'If that email exists, a reset token has been generated',
      };
    }

    return { resetToken: rawToken };
  }

  async resetPassword(dto: ResetPasswordData) {
    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const [stored] = await this.db.db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenDigest, sha256(dto.token)),
          eq(passwordResetTokens.userId, user.id),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .limit(1);

    if (!stored) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    await this.db.db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));

    await this.db.db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, stored.id));

    return { message: 'Password updated successfully' };
  }

  async refresh(dto: RefreshData) {
    const [matchedToken] = await this.db.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenDigest, sha256(dto.refreshToken)),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.db.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.id, matchedToken.id));

    const [user] = await this.db.db
      .select()
      .from(users)
      .where(eq(users.id, matchedToken.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
