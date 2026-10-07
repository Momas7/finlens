import { assertAppRoleIsSafe, createDb } from '@finlens/db';
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig(process.env);
const db = createDb(config.databaseUrl);
await assertAppRoleIsSafe(db);
const app = await buildApp({ config, db });

const shutdown = async () => {
  await app.close();
  await db.$client.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: '0.0.0.0' });
