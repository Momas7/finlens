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

/** Cria uma conta corrente pela interface. */
export async function createCheckingAccount(page: Page, name = 'Inter', balance = '1.500,00') {
  await page.goto('/painel/contas/nova');
  await page.getByLabel('Nome').fill(name);
  await page.getByLabel('Tipo').selectOption('checking');
  await page.getByLabel('Saldo inicial').fill(balance);
  await page.getByLabel('Data do saldo').fill('2026-10-01');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page).toHaveURL(/\/painel\/contas$/);
}

/** Lança uma saída pela interface; com categoria, escolhe-a explicitamente. */
export async function addExpense(
  page: Page,
  description: string,
  amount: string,
  category?: string,
) {
  await page.goto('/painel/transacoes/nova');
  await page.getByRole('radio', { name: 'Saída' }).check();
  await page.getByLabel('Valor').fill(amount);
  await page.getByLabel('Descrição').fill(description);
  if (category)
    await page.getByLabel('Categoria', { exact: true }).selectOption({ label: category });
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes(\/[^/]+\/semelhantes.*)?$/);
}
