import { expect, type Page, test } from '@playwright/test';
import { addExpense, createCheckingAccount, signUp } from './helpers';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);
const [y, m] = today.split('-').map(Number) as [number, number];
const monthsAgo = (n: number) => {
  const d = new Date(Date.UTC(y, m - 1 - n, 5));
  return d.toISOString().slice(0, 10);
};
const MERCADO = 'Alimentação › Mercado';

async function start(page: Page) {
  await signUp(page);
  await createCheckingAccount(page);
}

async function define(page: Page, category: string, amount: string) {
  await page.goto('/painel/orcamentos');
  await page.getByLabel(`Limite mensal para ${category}`).fill(amount);
  await page.getByRole('button', { name: `Definir orçamento de ${category}` }).click();
  await expect(page.getByRole('region', { name: 'Com orçamento' })).toContainText(category);
}

test('definir a partir da sugestão', async ({ page }) => {
  await start(page);
  for (const [n, amount] of [
    [3, '600,00'],
    [2, '650,00'],
    [1, '720,00'],
  ] as const) {
    await addExpense(page, 'MERCADO', amount, MERCADO, monthsAgo(n));
  }
  await page.goto('/painel/orcamentos');
  const field = page.getByLabel('Limite mensal para Alimentação');
  await expect(field).toHaveValue('650,00');
  await expect(page.getByText('Sugestão: R$ 650,00, mediana de 3 meses')).toBeVisible();
  await page.getByRole('button', { name: 'Definir orçamento de Alimentação' }).click();
  await expect(page.getByRole('region', { name: 'Com orçamento' })).toContainText(
    'R$ 0,00 de R$ 650,00',
  );
});

test('passar do limite, ver na Início e alterar', async ({ page }) => {
  await start(page);
  await define(page, 'Alimentação', '100,00');
  await addExpense(page, 'MERCADO', '120,00', MERCADO);
  await page.goto('/painel/orcamentos');
  const budgets = page.getByRole('region', { name: 'Com orçamento' });
  await expect(budgets).toContainText('Passou R$ 20,00');
  await expect(page.getByRole('meter', { name: 'Orçamento de Alimentação' })).toHaveAttribute(
    'aria-valuetext',
    /120%/,
  );

  await page.goto('/painel');
  const alert = page.getByRole('link', { name: '1 atingiu o limite' });
  await expect(alert).toHaveAttribute('href', /\/painel\/orcamentos\?mes=\d{4}-\d{2}$/);
  await expect(page.getByRole('region', { name: 'Para onde foi' })).toContainText(
    'Passou do orçamento',
  );

  await page.goto('/painel/orcamentos');
  await page.getByText('Alterar orçamento de Alimentação').click();
  await page.getByLabel('Novo limite para Alimentação').fill('200,00');
  await page.getByRole('button', { name: 'Salvar limite de Alimentação' }).click();
  await expect(budgets).toContainText('60% usado');
});

test('mês passado é só leitura', async ({ page }) => {
  await start(page);
  await define(page, 'Alimentação', '100,00');
  await page.goto(`/painel/orcamentos?mes=${monthsAgo(1).slice(0, 7)}`);
  await expect(page.getByText('Orçamentos de meses passados não mudam.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Definir orçamento/ })).toHaveCount(0);
  await expect(page.getByText(/^Alterar orçamento/)).toHaveCount(0);
});

test('remover', async ({ page }) => {
  await start(page);
  await define(page, 'Alimentação', '100,00');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Remover orçamento de Alimentação' }).click();
  await expect(page.getByLabel('Limite mensal para Alimentação')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Com orçamento' })).toHaveCount(0);
});

test('valor inválido', async ({ page }) => {
  await start(page);
  await page.goto('/painel/orcamentos');
  await page.getByLabel('Limite mensal para Alimentação').fill('0');
  await page.getByRole('button', { name: 'Definir orçamento de Alimentação' }).click();
  await expect(page.getByText('Informe um valor maior que zero, como 750,00.')).toBeVisible();
});
