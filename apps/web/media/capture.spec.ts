import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, expect, type Page, test } from '@playwright/test';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/media');
const EMAIL = 'demo@finlens.local';
const PASSWORD = 'demo-finlens-123';
const PAGES = [
  ['inicio', '/painel'],
  ['revisao', '/painel/revisao'],
  ['orcamentos', '/painel/orcamentos'],
  ['metas', '/painel/metas'],
  ['insights', '/painel/insights'],
] as const;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/painel/);
}

async function newPage(
  browser: Browser,
  theme: string,
  width: number,
  height: number,
  video?: string,
) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    ...(video && { recordVideo: { dir: video, size: { width, height } }, deviceScaleFactor: 1 }),
  });
  await context.addInitScript((t) => window.localStorage.setItem('finlens-theme', t), theme);
  return context.newPage();
}

// Espera a animação da régua terminar antes de fotografar.
const settle = (page: Page) => page.waitForTimeout(1200);

test('capturas', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  for (const theme of ['light', 'dark']) {
    const page = await newPage(browser, theme, 1440, 900);
    await login(page);
    for (const [name, path] of PAGES) {
      await page.goto(path);
      await settle(page);
      await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
    }
    await page.context().close();
  }
  const mobile = await newPage(browser, 'light', 390, 844);
  await login(mobile);
  await settle(mobile);
  await mobile.screenshot({ path: `${OUT}/inicio-mobile.png`, fullPage: true });
  await mobile.context().close();
});

test('gif do percurso', async ({ browser }) => {
  const videoDir = `${OUT}/.video`;
  rmSync(videoDir, { recursive: true, force: true });
  const page = await newPage(browser, 'light', 1280, 800, videoDir);
  await login(page);
  await settle(page);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1500);
  await page.getByRole('link', { name: /^Revisão/ }).click();
  await expect(page.getByRole('heading', { name: 'Revisão', level: 1 })).toBeVisible();
  await page.waitForTimeout(1200);
  const inbox = page.getByRole('region', { name: 'Precisam de você' });
  await inbox
    .getByLabel('Categoria para LOJA DO BAIRRO ZETA')
    .selectOption({ label: 'Compras › Outras compras' });
  await page.waitForTimeout(600);
  await inbox
    .getByRole('button', { name: /^Confirmar/ })
    .first()
    .click();
  await page.waitForTimeout(1500);
  await page.getByRole('link', { name: 'Insights' }).click();
  await page.waitForTimeout(2000);
  await page.getByRole('link', { name: 'Orçamentos' }).click();
  await page.waitForTimeout(2000);
  const video = page.video();
  await page.context().close();
  const webm = await video?.path();
  if (!webm) throw new Error('vídeo não gravado');
  const gif = `${OUT}/finlens.gif`;
  // Paleta própria do vídeo: GIF nítido e leve.
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      webm,
      '-vf',
      'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
      gif,
    ],
    { stdio: 'ignore' },
  );
  rmSync(videoDir, { recursive: true, force: true });
});
