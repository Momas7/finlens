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
  // Oito lançamentos pela interface: passa de 30 s com a suíte inteira em paralelo.
  test.setTimeout(90_000);
  await signUp(page);
  await createCheckingAccount(page, 'Inter', '5.000,00');
  for (const [k, amount] of [
    [4, '55,90'],
    [3, '55,90'],
    [2, '55,90'],
    [1, '59,90'],
    [0, '59,90'],
  ] as const) {
    await charge(page, 'NETFLIX.COM', amount, ago(3 + 30 * k));
  }
  for (const k of [2, 1, 0]) await charge(page, 'SPOTIFY AB', '21,90', ago(3 + 28 * k));
}

test('lista as recorrências com total, próxima data e selos', async ({ page }) => {
  await seed(page);
  await page.getByRole('link', { name: 'Recorrências' }).click();
  await expect(page.getByRole('heading', { name: 'Recorrências', level: 1 })).toBeVisible();
  await expect(page.getByText('2 cobranças recorrentes, R$ 81,80 por mês')).toBeVisible();
  const list = page.getByRole('list', { name: 'Cobranças recorrentes' });
  await expect(list.getByRole('listitem').filter({ hasText: 'Netflix' })).toContainText(
    'subiu de R$ 55,90 para R$ 59,90',
  );
  await expect(list.getByRole('listitem').filter({ hasText: 'Netflix' })).toContainText(
    'Próxima por volta de',
  );
  await expect(list.getByRole('listitem').filter({ hasText: 'Spotify' })).toContainText('nova');
});

test('aumento de preço vira insight dispensável na Início', async ({ page }) => {
  await seed(page);
  await page.goto('/painel');
  const block = page.getByRole('region', { name: 'O que mudou' });
  await expect(block).toContainText('Preço subiu: Netflix');
  await block.getByRole('button', { name: 'Dispensar: Preço subiu: Netflix' }).click();
  await expect(page.getByText('Preço subiu: Netflix')).toHaveCount(0);
});

test('atrasada e encerradas', async ({ page }) => {
  test.setTimeout(90_000);
  await signUp(page);
  await createCheckingAccount(page, 'Inter', '5.000,00');
  for (const k of [2, 1, 0]) await charge(page, 'SMARTFIT', '99,90', ago(45 + 30 * k));
  for (const k of [2, 1, 0]) await charge(page, 'CLUBE DO LIVRO', '39,90', ago(100 + 30 * k));
  await charge(page, 'PADARIA', '15,00', ago(1));
  await page.goto('/painel/recorrencias');
  const list = page.getByRole('list', { name: 'Cobranças recorrentes' });
  await expect(list.getByRole('listitem').filter({ hasText: 'Smart Fit' })).toContainText(
    'atrasada',
  );
  await expect(list.getByRole('listitem').filter({ hasText: 'Smart Fit' })).toContainText(
    'não apareceu',
  );
  await page.getByText('Encerradas (1)').click();
  await expect(
    page.getByRole('list', { name: 'Cobranças encerradas' }).getByRole('listitem'),
  ).toContainText('Última cobrança em');
});

test('estado vazio', async ({ page }) => {
  await signUp(page);
  await page.goto('/painel/recorrencias');
  await expect(
    page.getByText(
      'Nenhuma cobrança recorrente encontrada. Elas aparecem quando algo se repete 3 vezes ou mais.',
    ),
  ).toBeVisible();
});
