import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Local: lê o .env da raiz. CI: variáveis vêm do ambiente do job.
const envFile = new URL('../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
