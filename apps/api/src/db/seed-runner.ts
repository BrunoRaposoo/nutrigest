import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { users } from './schema/users';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@nutrigest.com'))
    .limit(1);

  if (existing.length > 0) {
    console.log('Admin user already exists, skipping seed');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash('Admin@123', 10);

  await db.insert(users).values({
    name: 'Admin',
    email: 'admin@nutrigest.com',
    passwordHash,
    role: 'ADMIN',
  });

  console.log('Admin user seeded successfully');
  console.log('  Email: admin@nutrigest.com');
  console.log('  Password: Admin@123');
  console.log('  Role: ADMIN');

  await pool.end();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
