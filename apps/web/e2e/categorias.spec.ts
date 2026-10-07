import { expect, test } from '@playwright/test';
import { createCheckingAccount, signUp } from './helpers';

test('criar, renomear e arquivar categorias', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Categorias' }).click();
  await expect(page.getByRole('heading', { name: 'Categorias', level: 1 })).toBeVisible();

  const create = async (name: string, parent: string) => {
    await page.getByLabel('Nome', { exact: true }).fill(name);
    await page.getByLabel('Dentro de').selectOption({ label: parent });
    await page.getByRole('button', { name: 'Criar categoria' }).click();
  };

  await create('Casa', 'Nenhuma (categoria principal)');
  const tree = page.getByRole('list', { name: 'Suas categorias' });
  await expect(tree.getByText('Casa', { exact: true }).first()).toBeVisible();
  await create('Reforma', 'Casa');
  await expect(tree.getByText('Reforma', { exact: true }).first()).toBeVisible();
  await create('Viagem 2027', 'Nenhuma (categoria principal)');
  await expect(tree.getByText('Viagem 2027', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('');

  await create('casa', 'Nenhuma (categoria principal)');
  await expect(page.getByText('Já existe uma categoria com esse nome aqui.')).toBeVisible();

  await page.getByText('Renomear Reforma', { exact: true }).click();
  await page.getByLabel('Novo nome de Reforma').fill('Obras');
  await page.getByRole('button', { name: 'Salvar nome de Reforma' }).click();
  await expect(tree.getByText('Obras', { exact: true }).first()).toBeVisible();

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Arquivar Casa', exact: true }).click();
  await expect(tree.getByText('Casa', { exact: true })).toHaveCount(0);
  await expect(tree.getByText('Obras', { exact: true })).toHaveCount(0);

  await createCheckingAccount(page);
  await page.goto('/painel/transacoes/nova');
  await expect(
    page.getByLabel('Categoria', { exact: true }).locator('option', { hasText: 'Viagem 2027' }),
  ).toHaveCount(1);
});

test('regras aparecem e podem ser excluídas', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await page.goto('/painel/transacoes/nova');
  await page.getByLabel('Valor').fill('45,90');
  await page.getByLabel('Descrição').fill('IFOOD*REST');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await page.getByRole('link', { name: 'IFOOD*REST' }).click();
  await page.getByRole('button', { name: 'Sempre classificar assim' }).click();
  await expect(page.getByText('Regra criada.')).toBeVisible();

  await page.goto('/painel/categorias');
  const rules = page.getByRole('region', { name: 'Suas regras' });
  await expect(rules).toContainText('IFOOD REST');
  await expect(rules).toContainText('Alimentação › Delivery');
  page.once('dialog', (d) => d.accept());
  await rules.getByRole('button', { name: 'Excluir regra IFOOD REST' }).click();
  await expect(rules).toContainText('Nenhuma regra ainda.');
});
