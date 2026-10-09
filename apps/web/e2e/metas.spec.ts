import { expect, type Page, test } from '@playwright/test';
import { addIncome, signUp } from './helpers';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);
const nextYear = Number(today.slice(0, 4)) + 1;

async function savingsAccount(page: Page) {
  await page.goto('/painel/contas/nova');
  await page.getByLabel('Nome').fill('Reserva');
  await page.getByLabel('Tipo').selectOption('savings');
  await page.getByLabel('Saldo inicial').fill('2.000,00');
  await page.getByLabel('Data do saldo').fill(`${today.slice(0, 7)}-01`);
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page).toHaveURL(/\/painel\/contas$/);
}

async function createGoal(page: Page) {
  await page.goto('/painel/metas');
  await page.getByLabel('Nome', { exact: true }).fill('Viagem');
  await page.getByLabel('Valor-alvo', { exact: true }).fill('10.000,00');
  await page.getByLabel('Conta', { exact: true }).selectOption({ label: 'Reserva' });
  await page.getByLabel('Data-alvo', { exact: true }).fill(`${nextYear}-12-15`);
  await page.getByRole('button', { name: 'Criar meta' }).click();
  return page.getByRole('region', { name: 'Viagem' });
}

test('criar meta e ver os números', async ({ page }) => {
  await signUp(page);
  await savingsAccount(page);
  const card = await createGoal(page);
  await expect(card).toContainText('R$ 2.000,00 de R$ 10.000,00');
  await expect(card).toContainText('faltam R$ 8.000,00');
  await expect(card).toContainText('guarde R$');
  await expect(card).toContainText('Ainda sem ritmo');
});

test('depósito faz a meta andar', async ({ page }) => {
  await signUp(page);
  await savingsAccount(page);
  await createGoal(page);
  await addIncome(page, 'DEPOSITO', '500,00', 'Receitas › Outras receitas');
  await page.goto('/painel/metas');
  await expect(page.getByRole('region', { name: 'Viagem' })).toContainText(
    'R$ 2.500,00 de R$ 10.000,00',
  );
});

test('alterar e arquivar', async ({ page }) => {
  await signUp(page);
  await savingsAccount(page);
  const card = await createGoal(page);
  await card.getByText('Alterar Viagem').click();
  await page.getByLabel('Valor-alvo de Viagem').fill('2.000,00');
  await page.getByRole('button', { name: 'Salvar Viagem' }).click();
  await expect(page.getByRole('region', { name: 'Viagem' })).toContainText('Concluída');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Arquivar Viagem' }).click();
  await expect(page.getByText('Nenhuma meta ainda.')).toBeVisible();
  await expect(
    page.getByLabel('Conta', { exact: true }).locator('option', { hasText: 'Reserva' }),
  ).toHaveCount(1);
});

test('sem conta elegível', async ({ page }) => {
  await signUp(page);
  await page.goto('/painel/metas');
  await expect(
    page.getByText('Cadastre uma conta poupança para acompanhar uma meta.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cadastrar conta' })).toBeVisible();
});
