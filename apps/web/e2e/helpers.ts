import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'senha-forte-123';

export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Cadastra pela interface e espera chegar ao painel. */
export async function signUp(page: Page, name = 'Ana', email = uniqueEmail()) {
  await page.goto('/signup');
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/painel/);
  return email;
}
