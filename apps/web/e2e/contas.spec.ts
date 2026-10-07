import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test('criar conta corrente e cartão', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Contas' }).click();
  await page.getByRole('link', { name: 'Nova conta' }).click();
  await page.getByLabel('Nome').fill('Inter');
  await page.getByLabel('Tipo').selectOption('checking');
  await page.getByLabel('Instituição').fill('Banco Inter');
  await page.getByLabel('Saldo inicial').fill('1.500,00');
  await page.getByLabel('Data do saldo').fill('2026-10-01');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page.getByRole('row', { name: /Inter.*R\$ 1\.500,00/ })).toBeVisible();

  await page.getByRole('link', { name: 'Nova conta' }).click();
  await page.getByLabel('Nome').fill('Mercado Pago');
  await page.getByLabel('Tipo').selectOption('credit_card');
  await page.getByLabel('Dia de fechamento').fill('10');
  await page.getByLabel('Dia de vencimento').fill('17');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page.getByRole('row', { name: /Mercado Pago.*Fatura aberta/ })).toBeVisible();
});

test('validação mostra erro no campo', async ({ page }) => {
  await signUp(page);
  await page.goto('/painel/contas/nova');
  await page.getByLabel('Nome').fill('Cartão');
  await page.getByLabel('Tipo').selectOption('credit_card');
  await page.getByLabel('Dia de vencimento').fill('17');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  const closing = page.getByLabel('Dia de fechamento');
  await expect(closing).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Use um dia de 1 a 31.')).toBeVisible();
});
