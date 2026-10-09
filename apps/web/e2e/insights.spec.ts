import { expect, type Page, test } from '@playwright/test';
import { addExpense, createCheckingAccount, signUp } from './helpers';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);
const month = today.slice(0, 7);
const day = Number(today.slice(8));

async function duplicate(page: Page) {
  await signUp(page);
  await createCheckingAccount(page);
  for (const d of ['01', '02']) {
    await addExpense(page, 'NETFLIX', '55,90', 'Assinaturas › Streaming de vídeo', `${month}-${d}`);
  }
}

test.skip(day < 2, 'precisa de dois dias no mês corrente');

test('duplicata aparece na Início e some ao dispensar', async ({ page }) => {
  await duplicate(page);
  await page.goto('/painel');
  const block = page.getByRole('region', { name: 'O que mudou' });
  await expect(block).toContainText('Possível cobrança duplicada');
  await expect(block).toContainText(`R$ 55,90 apareceu em 01/${month.slice(5)}`);
  await block.getByRole('button', { name: 'Dispensar: Possível cobrança duplicada' }).click();
  await expect(page.getByRole('region', { name: 'O que mudou' })).toHaveCount(0);
});

test('ação abre a lista filtrada', async ({ page }) => {
  await duplicate(page);
  await page.goto('/painel');
  await page
    .getByRole('region', { name: 'O que mudou' })
    .getByRole('link', { name: /Ver lançamentos/ })
    .click();
  await expect(page).toHaveURL(/\/painel\/transacoes\?q=/);
  await expect(page.getByRole('link', { name: 'NETFLIX' }).first()).toBeVisible();
});

test('página de insights e estado vazio', async ({ page }) => {
  await signUp(page);
  await page.goto('/painel/insights');
  await expect(page.getByRole('heading', { name: 'O que mudou', level: 1 })).toBeVisible();
  await expect(page.getByText('Nada fora do comum por enquanto.')).toBeVisible();
});

test('página lista com selo novo', async ({ page }) => {
  await duplicate(page);
  await page.getByRole('link', { name: 'Insights' }).click();
  const list = page.getByRole('list', { name: 'Insights' });
  await expect(list).toContainText('Possível cobrança duplicada');
  await expect(list).toContainText('novo');
});
