import { expect, test } from '@playwright/test';
import { addExpense, createCheckingAccount, signUp } from './helpers';

test('confirmar grupo e ver o contador baixar', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  for (const amount of ['12,50', '30,00', '8,90']) await addExpense(page, 'LOJA NOVA X', amount);
  await page.getByRole('link', { name: 'Revisão, 3 pendentes' }).click();
  await expect(page.getByRole('heading', { name: 'Revisão', level: 1 })).toBeVisible();

  const inbox = page.getByRole('region', { name: 'Precisam de você' });
  await expect(inbox).toContainText('3 lançamentos');
  await inbox
    .getByLabel('Categoria para LOJA NOVA X')
    .selectOption({ label: 'Compras › Outras compras' });
  await inbox.getByRole('button', { name: 'Confirmar 3' }).click();
  await page.goto('/painel/revisao');
  await expect(page.getByText('Tudo revisado.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Revisão', exact: true })).toBeVisible();
});

test('grupo sem sugestão exige categoria', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await addExpense(page, 'LOJA NOVA Y', '10,00');
  await page.goto('/painel/revisao');
  await page.getByRole('button', { name: 'Confirmar 1' }).click();
  await expect(page.getByText('Escolha a categoria.')).toBeVisible();
});

async function threeBakeryConfirmations(page: import('@playwright/test').Page) {
  await signUp(page);
  await createCheckingAccount(page);
  for (const amount of ['12,50', '9,80', '15,00']) {
    await addExpense(page, 'PADARIA SAO JOAO', amount, 'Alimentação › Padaria');
  }
  await page.goto('/painel/revisao');
  return page.getByRole('region', { name: 'Regras sugeridas' });
}

test('regra sugerida após 3 confirmações', async ({ page }) => {
  const rules = await threeBakeryConfirmations(page);
  await expect(rules).toContainText(
    'Sempre classificar PADARIA SAO JOAO como Alimentação › Padaria?',
  );
  await expect(rules).toContainText('Baseado em 3 confirmações suas.');
  await rules.getByRole('button', { name: 'Criar regra' }).click();
  await expect(page.getByRole('region', { name: 'Regras sugeridas' })).toHaveCount(0);
  await page.goto('/painel/categorias');
  await expect(page.getByRole('region', { name: 'Suas regras' })).toContainText('PADARIA SAO JOAO');
});

test('dispensar sugestão', async ({ page }) => {
  const rules = await threeBakeryConfirmations(page);
  await rules.getByRole('button', { name: 'Dispensar' }).click();
  await expect(page.getByRole('region', { name: 'Regras sugeridas' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Revisão', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Regras sugeridas' })).toHaveCount(0);
});
