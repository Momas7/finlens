import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { addExpense, createCheckingAccount, PASSWORD, signUp } from './helpers';

test('baixar os dados em JSON e CSV', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await addExpense(page, 'CAFE DA ESQUINA', '12,50');
  await page.getByRole('link', { name: 'Sua conta' }).click();
  await expect(page.getByRole('heading', { name: 'Sua conta', level: 1 })).toBeVisible();

  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Baixar tudo (JSON)' }).click(),
  ]);
  expect(json.suggestedFilename()).toMatch(/^finlens-\d{4}-\d{2}-\d{2}\.json$/);
  expect(readFileSync((await json.path()) as string, 'utf8')).toContain(
    '"format":"finlens-export/1"',
  );

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Baixar lançamentos (CSV)' }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/^finlens-lancamentos-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = readFileSync((await csv.path()) as string, 'utf8');
  expect(content).toContain('data;conta;descrição;valor;categoria;situação');
  expect(content).toContain('CAFE DA ESQUINA;-12,50');
});

test('senha errada não exclui', async ({ page }) => {
  await signUp(page);
  await page.goto('/painel/conta');
  await page.getByLabel('Senha atual').fill('senha-errada-000');
  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Excluir conta definitivamente' }).click();
  await expect(page.getByText('Senha incorreta.')).toBeVisible();
});

test('excluir a conta apaga o acesso', async ({ page }) => {
  const email = await signUp(page);
  await page.goto('/painel/conta');
  await page.getByLabel('Senha atual').fill(PASSWORD);
  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Excluir conta definitivamente' }).click();
  await expect(page).toHaveURL(/\/\?conta=excluida$/);
  await expect(page.getByText('Sua conta foi excluída.')).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
