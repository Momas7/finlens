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
  // A ação confirma e redireciona (semelhantes vazios → revisão); navegar antes cortaria a ação.
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

async function amazonScenario(page: import('@playwright/test').Page) {
  await signUp(page);
  await createCheckingAccount(page, 'Inter', '5.000,00');
  // Histórico que varia por faixa: compra pequena confirmada em Outras compras.
  await addExpense(page, 'AMAZON BR', '25,00', 'Compras › Outras compras');
  for (const amount of ['349,90', '299,00', '39,90']) await addExpense(page, 'AMAZON BR', amount);
  await page.goto('/painel/transacoes');
  await page
    .getByRole('row', { name: /349,90/ })
    .getByRole('link', { name: 'AMAZON BR' })
    .click();
  await expect(page.getByRole('heading', { name: 'Editar lançamento' })).toBeVisible();
  await page
    .getByLabel('Categoria', { exact: true })
    .selectOption({ label: 'Compras › Casa e decoração' });
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Aplicar Compras › Casa e decoração a 2 lançamentos parecidos?',
    }),
  ).toBeVisible();
}

test('corrigir e aplicar a parecidos', async ({ page }) => {
  await amazonScenario(page);
  const near = page.getByRole('checkbox', { name: /299,00/ });
  const far = page.getByRole('checkbox', { name: /39,90/ });
  await expect(near).toBeChecked();
  await expect(far).not.toBeChecked();
  await expect(page.getByText('valor diferente do que você corrigiu')).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar aos selecionados' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);
  const near2 = page.getByRole('row', { name: /299,00/ });
  await expect(near2).toContainText('Compras › Casa e decoração');
  await expect(near2).not.toContainText('automática');
  await expect(page.getByRole('row', { name: /39,90/ })).toContainText('automática');
});

test('agora não mantém tudo', async ({ page }) => {
  await amazonScenario(page);
  await page.getByRole('link', { name: 'Agora não' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);
  await expect(page.getByRole('row', { name: /299,00/ })).toContainText('automática');
  await expect(page.getByRole('row', { name: /299,00/ })).toContainText('Outras compras');
});
