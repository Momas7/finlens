import { defineConfig, devices } from '@playwright/test';

/** Gera as imagens do README contra um app com a conta demo (veja `pnpm docs:media`). */
export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  reporter: 'list',
  use: { baseURL: process.env.MEDIA_BASE_URL ?? 'http://localhost:3000' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
