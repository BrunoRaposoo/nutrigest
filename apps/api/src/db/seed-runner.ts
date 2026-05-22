import 'dotenv/config';

import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { products, users } from './schema';

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
  } else {
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
  }

  const existingProducts = await db.select().from(products).limit(1);

  if (existingProducts.length > 0) {
    console.log('Products already exist, skipping seed');
  } else {
    const sampleProducts = [
      { name: 'Água Mineral 500ml', category: 'BEVERAGE' as const, unit: 'un' },
      {
        name: 'Suco de Laranja 300ml',
        category: 'BEVERAGE' as const,
        unit: 'un',
      },
      {
        name: 'Refrigerante Cola 350ml',
        category: 'BEVERAGE' as const,
        unit: 'un',
      },
      { name: 'Marmita Executiva', category: 'MEAL' as const, unit: 'un' },
      { name: 'Marmita Light', category: 'MEAL' as const, unit: 'un' },
      { name: 'Marmita Vegetariana', category: 'MEAL' as const, unit: 'un' },
    ];

    await db.insert(products).values(sampleProducts);
    console.log(`${sampleProducts.length} products seeded`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
