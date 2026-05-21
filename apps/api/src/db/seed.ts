import { DbService } from './db.service';
import { users } from './schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

export async function seedDatabase(db: DbService) {
  const existing = await db.db
    .select()
    .from(users)
    .where(eq(users.email, 'admin@nutrigest.com'))
    .limit(1);

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash('Admin@123', 10);
    await db.db.insert(users).values({
      name: 'Admin',
      email: 'admin@nutrigest.com',
      passwordHash,
      role: 'ADMIN',
    });
    console.log('Admin user seeded');
  }
}
