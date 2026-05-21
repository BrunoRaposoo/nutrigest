import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DbService } from './db.service';
import { products, users } from './schema';

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

  const existingProducts = await db.db.select().from(products).limit(1);

  if (existingProducts.length === 0) {
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

    await db.db.insert(products).values(sampleProducts);
    console.log(`${sampleProducts.length} products seeded`);
  }
}
