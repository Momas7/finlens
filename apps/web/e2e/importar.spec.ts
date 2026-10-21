import path from 'node:path';
import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

const fatura = path.join(process.cwd(), 'e2e', 'fixtures', 'fatura-inter.csv');

async function createCard(page: import('@playwright/test').Page) {
  await page.goto('/painel/contas/nova');
  await page.getByLabel('Nome').fill('Cartão Inter');
  await page.getByLabel('Tipo').selectOption('credit_card');
  await page.getByLabel('Fechamento').fill('5');
  await page.getByLabel('Vencimento').fill('12');
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page).toHaveURL(/\/painel\/contas$/);
}

test('importar a fatura do Inter: prévia, confirmar e repetir', async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await createCard(page);

  await page.goto('/painel/transacoes');
  await page.getByRole('link', { name: 'Importar' }).click();
  await expect(page.getByRole('heading', { name: 'Importar extrato', level: 1 })).toBeVisible();
  await page.getByLabel('Arquivo do extrato').setInputFiles(fatura);
  await page.getByRole('button', { name: 'Ler arquivo' }).click();

  await expect(
    page.getByRole('status').filter({ hasText: '4 lançamentos no arquivo' }),
  ).toContainText('4 novos');
  await expect(page.getByRole('status')).toContainText('1 pagamentos de fatura');
  await expect(page.getByText('LOJA ALFA CENTRO SALVADOR BRA PARC 01/02')).toBeVisible();
  await page.getByRole('button', { name: 'Importar 4' }).click();

  await expect(page).toHaveURL(/\/painel\/revisao\?importados=4/);
  await expect(page.getByText('4 lançamentos importados.')).toBeVisible();

  // O mesmo arquivo não entra de novo.
  await page.goto('/painel/importar');
  await page.getByLabel('Arquivo do extrato').setInputFiles(fatura);
  await page.getByRole('button', { name: 'Ler arquivo' }).click();
  await expect(page.getByText('Este arquivo já foi importado.')).toBeVisible();
});

test('CSV desconhecido pede o mapeamento das colunas', async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await createCard(page);
  await page.goto('/painel/importar');
  await page.getByLabel('Arquivo do extrato').setInputFiles({
    name: 'banco.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'dia;historico;valor\n05/10/2026;PADARIA XYZ;45,90\n06/10/2026;MERCADO ABC;120,00\n',
    ),
  });
  await page.getByRole('button', { name: 'Ler arquivo' }).click();
  await expect(page.getByText('Não reconheci este formato')).toBeVisible();
  await page.getByLabel('O gasto aparece como').selectOption('positive');
  await page.getByRole('button', { name: 'Ver prévia' }).click();
  await expect(page.getByRole('status')).toContainText('2 novos');
  await expect(page.getByText('PADARIA XYZ')).toBeVisible();
  await page.getByRole('button', { name: 'Importar 2' }).click();
  await expect(page).toHaveURL(/importados=2/);
});
