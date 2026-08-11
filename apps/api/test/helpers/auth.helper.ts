import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import * as bcrypt from 'bcrypt';
import { DbService } from '../../src/db/db.service';
import { users } from '../../src/db/schema';

export type TestRole = 'ADMIN' | 'TECHNICIAN' | 'OPERATOR';

export async function createUserWithRole(
  app: NestFastifyApplication,
  role: TestRole,
) {
  const db = app.get(DbService);
  const email = `e2e-${role}-${Date.now()}-${Math.random()}@example.com`;
  const password = 'password123';

  const [user] = await db.db
    .insert(users)
    .values({
      name: `${role} User`,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    })
    .returning({ id: users.id, email: users.email, role: users.role });

  return { user, email, password };
}

export async function registerAndLogin(
  app: NestFastifyApplication,
  role: TestRole = 'OPERATOR',
) {
  const { email, password } = await createUserWithRole(app, role);

  const loginRes = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });

  return JSON.parse(loginRes.body) as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: TestRole };
  };
}
