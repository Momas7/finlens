import { expect, type Page, test } from '@playwright/test';
import { addExpense, addIncome, createCheckingAccount, signUp } from './helpers';

const monthFmt = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(date);
const now = new Date();
const thisMonth = monthFmt(now);
const lastMonth = monthFmt(new Date(now.getFullYear(), now.getMonth() - 1, 15));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function seed(page: Page) {
  await signUp(page);
  await createCheckingAccount(page);
  await addIncome(page, 'SALARIO', '7.200,00', 'Receitas › Salário');
  await addExpense(page, 'ALUGUEL', '1.850,00', 'Moradia › Aluguel e financiamento');
  await addExpense(page, 'MERCADO DIA', '423,50', 'Alimentação › Mercado');
  await page.goto('/painel');
}

test('resumo do mês', async ({ page }) => {
  await seed(page);
  await expect(page.getByText(`Sobrou em ${thisMonth}`)).toBeVisible();
  await expect(page.getByText('R$ 4.926,50')).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Renda gasta' })).toHaveAttribute(
    'aria-valuetext',
    /32%/,
  );
  const where = page.getByRole('region', { name: 'Para onde foi' });
  await expect(where.getByRole('link').first()).toHaveAccessibleName(/^Moradia, R\$ 1\.850,00/);
  await expect(where.getByRole('link').nth(1)).toHaveAccessibleName(/^Alimentação, R\$ 423,50/);
});

test('categoria abre a lista filtrada', async ({ page }) => {
  await seed(page);
  await page
    .getByRole('region', { name: 'Para onde foi' })
    .getByRole('link', { name: /^Moradia/ })
    .click();
  await expect(page).toHaveURL(/categoryId=.*from=/);
  await expect(page.getByLabel('Categoria', { exact: true }).locator('option:checked')).toHaveText(
    'Moradia (todas)',
  );
  await expect(page.getByRole('link', { name: 'ALUGUEL' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'MERCADO DIA' })).toHaveCount(0);
});

test('navegar entre meses', async ({ page }) => {
  await seed(page);
  await expect(page.getByRole('link', { name: /›$/ })).toHaveCount(0);
  await page.getByRole('link', { name: `‹ ${cap(lastMonth)}` }).click();
  await expect(page.getByText(`Nada lançado em ${lastMonth}.`)).toBeVisible();
  await page.getByRole('link', { name: `${cap(thisMonth)} ›` }).click();
  await expect(page.getByText(`Sobrou em ${thisMonth}`)).toBeVisible();
});

test('mês inválido mostra o mês atual', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await page.goto('/painel?mes=2026-13');
  await expect(page.getByText(`Mês inválido, mostrando ${thisMonth}`)).toBeVisible();
});

test('sem categoria leva à revisão', async ({ page }) => {
  await seed(page);
  await addExpense(page, 'LOJA NOVA X', '10,00');
  await page.goto('/painel');
  const link = page
    .getByRole('region', { name: 'Para onde foi' })
    .getByRole('link', { name: /^Sem categoria/ });
  await expect(link).toContainText('1 a revisar');
  await link.click();
  await expect(page).toHaveURL(/\/painel\/revisao$/);
});
