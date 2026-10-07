import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema> & { $client: pg.Pool };
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function createDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return drizzle({ client: pool, schema, casing: 'snake_case' });
}
