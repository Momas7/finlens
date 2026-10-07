import { expect, test } from '@playwright/test';

test('tema escolhido persiste após recarregar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const toggle = page.getByRole('button', { name: /Trocar tema/ });
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /Trocar tema/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('tema sincroniza entre abas', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  for (const p of [a, b]) {
    await p.emulateMedia({ colorScheme: 'light' });
    await p.goto('/login');
  }
  await a.getByRole('button', { name: /Trocar tema/ }).click();
  await expect(b.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(b.getByRole('button', { name: /Tema: Escuro/ })).toBeVisible();
});

test('storage bloqueado não quebra a página', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
  expect(errors).toEqual([]);
});
