import { expect, type Page, test } from '@playwright/test';
import { createCheckingAccount, signUp } from './helpers';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);
const ago = (n: number) =>
  new Date(Date.parse(`${today}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

async function charge(page: Page, description: string, amount: string, date: string) {
  await page.goto('/painel/transacoes/nova');
  await page.getByRole('radio', { name: 'Saída' }).check();
  await page.getByLabel('Valor').fill(amount);
  await page.getByLabel('Data').fill(date);
  await page.getByLabel('Descrição').fill(description);
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);
}

async function seed(page: Page) {
  test.setTimeout(180_000);
  await signUp(page);
  await createCheckingAccount(page, 'Inter', '9.000,00');
  for (const [k, n] of [
    [63, '01'],
    [33, '02'],
    [3, '03'],
  ] as const) {
    await charge(page, `MAGALU PARC ${n}/10`, '199,00', ago(k));
  }
  for (const [k, n] of [
    [58, '07'],
    [29, '08'],
    [0, '09'],
  ] as const) {
    await charge(page, `NOTEBOOK DELL PARC ${n}/10`, '349,00', ago(k));
  }
  await charge(page, 'ESTANTE LOJA PARC 05/05', '80,00', ago(20));
}

test('página com planos, mês a mês e encerradas', async ({ page }) => {
  await seed(page);
  await page.getByRole('link', { name: 'Parcelas' }).click();
  await expect(page.getByRole('heading', { name: 'Parcelas', level: 1 })).toBeVisible();
  await expect(page.getByText('2 parcelamentos ativos')).toBeVisible();
  const list = page.getByRole('list', { name: 'Parcelamentos ativos' });
  await expect(list.getByRole('listitem').filter({ hasText: 'Magalu' })).toContainText(
    'parcela 3 de 10',
  );
  await expect(list.getByRole('listitem').filter({ hasText: 'Magalu' })).toContainText('Faltam 7');
  await expect(list.getByRole('listitem').filter({ hasText: 'Dell' })).toContainText(
    'parcela 9 de 10',
  );
  await expect(page.getByRole('table', { name: 'Compromisso mês a mês' })).toBeAttached();
  await page.getByText('Encerradas (1)').click();
  await expect(page.getByRole('list', { name: 'Parcelamentos encerrados' })).toContainText(
    'ESTANTE LOJA',
  );
});

test('parcelamento terminando vira insight dispensável na Início', async ({ page }) => {
  await seed(page);
  await page.goto('/painel');
  const block = page.getByRole('region', { name: 'O que mudou' });
  await expect(block).toContainText('Parcelamento termina: Dell');
  await block.getByRole('button', { name: 'Dispensar: Parcelamento termina: Dell' }).click();
  await expect(page.getByText('Parcelamento termina: Dell')).toHaveCount(0);
});

test('estado vazio', async ({ page }) => {
  await signUp(page);
  await page.goto('/painel/parcelas');
  await expect(
    page.getByText(
      'Nenhum parcelamento encontrado. Compras com PARC 03/10 no texto aparecem aqui.',
    ),
  ).toBeVisible();
});
