import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './client';

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

export async function runMigrations(ownerUrl: string): Promise<void> {
  const db = createDb(ownerUrl);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await db.$client.end();
  }
}
