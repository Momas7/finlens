import { expect, type Page, test } from '@playwright/test';
import { createCheckingAccount, signUp } from './helpers';

async function startEntry(page: Page, description: string, amount: string) {
  await page.goto('/painel/transacoes/nova');
  await page.getByRole('radio', { name: 'Saída' }).check();
  await page.getByLabel('Valor').fill(amount);
  await page.getByLabel('Descrição').fill(description);
}

const suggestion = (page: Page) => page.getByRole('status', { name: 'Sugestão automática' });

test('sugestão ao digitar e salvar automática', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await startEntry(page, 'IFOOD*REST', '45,90');
  await expect(suggestion(page)).toContainText('Alimentação › Delivery');
  await expect(suggestion(page)).toContainText('90%');
  await expect(suggestion(page)).toContainText('iFood costuma ser Delivery.');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);
  await expect(
    page.getByRole('row', { name: /IFOOD\*REST.*Alimentação › Delivery.*automática/ }),
  ).toBeVisible();
});

test('correção ensina a próxima compra parecida', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await startEntry(page, 'AMAZON BR', '349,90');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(
    page.getByRole('row', { name: /AMAZON BR.*Compras › Outras compras.*automática/ }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'AMAZON BR' }).click();
  await expect(page.getByRole('heading', { name: 'Editar lançamento' })).toBeVisible();
  await page
    .getByLabel('Categoria', { exact: true })
    .selectOption({ label: 'Compras › Casa e decoração' });
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);

  await startEntry(page, 'AMAZON MKTPLACE PMTS', '299,00');
  await expect(suggestion(page)).toContainText('Compras › Casa e decoração');
  await expect(suggestion(page)).toContainText(
    'Você classificou Amazon como Casa e decoração 1 vez.',
  );
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(
    page.getByRole('row', { name: /AMAZON MKTPLACE PMTS.*Compras › Casa e decoração.*provável/ }),
  ).toBeVisible();
});

test('por que esta categoria e regra', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await startEntry(page, 'IFOOD*REST', '45,90');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await page.getByRole('link', { name: 'IFOOD*REST' }).click();
  const why = page.getByRole('region', { name: 'Por que esta categoria?' });
  await expect(why).toContainText('iFood costuma ser Delivery.');
  await expect(why.getByRole('meter', { name: 'Confiança da classificação' })).toBeVisible();
  await why.getByRole('button', { name: 'Sempre classificar assim' }).click();
  await expect(why).toContainText('Regra criada.');
});

test('editar mantém categoria confirmada que saiu da lista', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await startEntry(page, 'CLINICA VET AMIGO', '120,00');
  await page.getByLabel('Categoria', { exact: true }).selectOption({ label: 'Pets' });
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);

  // "Pets" ganha uma subcategoria: a raiz deixa de ser opção no seletor.
  await page.goto('/painel/categorias');
  await page.getByLabel('Nome', { exact: true }).fill('Ração');
  await page.getByLabel('Dentro de').selectOption({ label: 'Pets' });
  await page.getByRole('button', { name: 'Criar categoria' }).click();
  await expect(page.getByRole('list', { name: 'Subcategorias de Pets' })).toContainText('Ração');

  await page.goto('/painel/transacoes');
  await page.getByRole('link', { name: 'CLINICA VET AMIGO' }).click();
  await expect(page.getByRole('heading', { name: 'Editar lançamento' })).toBeVisible();
  await page.getByLabel('Data').fill('2026-10-01');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);
  const row = page.getByRole('row', { name: /CLINICA VET AMIGO/ });
  await expect(row).toContainText('Pets');
  await expect(row).not.toContainText('automática');
  await expect(row).not.toContainText('Sem categoria');
});
