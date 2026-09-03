import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

@Injectable()
export class DbService implements OnModuleInit {
  private readonly logger = new Logger(DbService.name);
  private pool!: Pool;
  public db!: NodePgDatabase<typeof schema>;

  async onModuleInit() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      this.logger.error(
        'DATABASE_URL environment variable is not set. ' +
          'Ensure .env file exists and contains DATABASE_URL.',
      );
      throw new Error(
        'Database connection failed: DATABASE_URL is not configured',
      );
    }

    this.logger.log('Connecting to database...');

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });

    this.pool.on('error', (err) => {
      this.logger.error(`Database pool error: ${err.message}`);
    });

    this.db = drizzle(this.pool, { schema });

    try {
      await this.db.execute('SELECT 1');
      this.logger.log('Database connection established successfully');
    } catch (error) {
      this.logger.error(
        `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Database pool closed');
    }
  }
}
