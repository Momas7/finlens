import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { runMigrations } from '../../src/migrate';

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não definida (veja .env.example)`);
  return value;
}

/** Cria um database isolado com as migrations aplicadas. Chame `drop()` ao final. */
export async function createTestDatabase(): Promise<{
  appUrl: string;
  ownerUrl: string;
  drop(): Promise<void>;
}> {
  const adminUrl = requireEnv('TEST_DATABASE_ADMIN_URL');
  const name = `finlens_test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`create database ${name} owner finlens_owner`);
  } finally {
    await admin.end();
  }

  const ownerUrl = withDatabase(requireEnv('DATABASE_OWNER_URL'), name);
  const appUrl = withDatabase(requireEnv('DATABASE_URL'), name);
  await runMigrations(ownerUrl);

  return {
    appUrl,
    ownerUrl,
    async drop() {
      const client = new pg.Client({ connectionString: adminUrl });
      await client.connect();
      try {
        await client.query(`drop database if exists ${name} with (force)`);
      } finally {
        await client.end();
      }
    },
  };
}
