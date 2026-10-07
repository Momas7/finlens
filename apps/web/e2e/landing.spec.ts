import { expect, test } from '@playwright/test';

test('landing sem sessão', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Importe o extrato. O Finlens mede para onde vai seu dinheiro.',
  );
  await expect(page.getByRole('meter', { name: /IFOOD\*REST/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar conta' }).first()).toHaveAttribute(
    'href',
    '/signup',
  );
  await expect(page.getByRole('link', { name: 'Entrar' }).first()).toHaveAttribute(
    'href',
    '/login',
  );
  await expect(page.getByRole('link', { name: /GitHub/ })).toHaveAttribute(
    'href',
    'https://github.com/Momas7/finlens',
  );
});
