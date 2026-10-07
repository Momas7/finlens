import { expect, test } from '@playwright/test';

test('tema escolhido persiste após recarregar', async ({ page }) => {
  await page.goto('/login');
  const toggle = page.getByRole('button', { name: /Trocar tema/ });
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
