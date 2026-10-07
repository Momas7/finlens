import { expect, type Page, test } from '@playwright/test';
import { createCheckingAccount, signUp } from './helpers';

async function launch(
  page: Page,
  opts: { kind: 'Saída' | 'Entrada'; amount: string; description: string; category: string },
) {
  await page.goto('/painel/transacoes');
  await page.getByRole('link', { name: 'Novo lançamento' }).click();
  await page.getByRole('radio', { name: opts.kind }).check();
  await page.getByLabel('Valor').fill(opts.amount);
  await page.getByLabel('Descrição').fill(opts.description);
  await page.getByLabel('Conta').selectOption({ label: 'Inter' });
  await page.getByLabel('Categoria', { exact: true }).selectOption({ label: opts.category });
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes(\?|$)/);
}

test('lançar, filtrar, editar e excluir', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await launch(page, {
    kind: 'Saída',
    amount: '45,90',
    description: 'iFood jantar',
    category: 'Alimentação › Delivery',
  });
  await expect(page.getByRole('row', { name: /iFood jantar.*−R\$ 45,90/ })).toBeVisible();
  await launch(page, {
    kind: 'Entrada',
    amount: '5.000,00',
    description: 'Salário',
    category: 'Receitas › Salário',
  });
  await expect(page.getByRole('row', { name: /Salário.*R\$ 5\.000,00/ })).toBeVisible();

  await page.getByLabel('Buscar').fill('ifood');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page).toHaveURL(/q=ifood/);
  await expect(page.getByRole('row', { name: /Salário/ })).toHaveCount(0);

  await page.getByRole('link', { name: 'iFood jantar' }).click();
  await page.getByLabel('Descrição').fill('iFood almoço');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page.getByRole('row', { name: /iFood almoço/ })).toBeVisible();

  await page.getByRole('link', { name: 'iFood almoço' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Excluir lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);
  await expect(page.getByRole('row', { name: /iFood/ })).toHaveCount(0);
});

test('saldo da conta reflete lançamento', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await launch(page, {
    kind: 'Saída',
    amount: '45,90',
    description: 'Mercado',
    category: 'Alimentação › Mercado',
  });
  await page.getByRole('link', { name: 'Contas' }).click();
  await expect(page.getByRole('row', { name: /Inter.*R\$ 1\.454,10/ })).toBeVisible();
});

test('valor inválido mostra erro', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page);
  await page.goto('/painel/transacoes/nova');
  await page.getByLabel('Valor').fill('abc');
  await page.getByLabel('Descrição').fill('Teste');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page.getByLabel('Valor')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Informe um valor maior que zero, como 45,90.')).toBeVisible();
  await expect(page.getByLabel('Descrição')).toHaveValue('Teste');
  await expect(page.getByLabel('Valor')).toHaveValue('abc');
});

test('editar lançamento de conta arquivada mantém a conta', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page, 'Inter');
  await createCheckingAccount(page, 'Nubank');
  await launch(page, {
    kind: 'Saída',
    amount: '10,00',
    description: 'Padaria',
    category: 'Alimentação › Padaria',
  });
  await page.getByRole('link', { name: 'Contas' }).click();
  await page.getByRole('link', { name: 'Inter' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Arquivar conta' }).click();
  await expect(page).toHaveURL(/\/painel\/contas$/);
  await expect(page.getByRole('row', { name: /^Inter/ })).toHaveCount(0);
  await page.goto('/painel/transacoes');
  await expect(page.getByRole('row', { name: /Padaria.*Inter \(arquivada\)/ })).toBeVisible();
  await page.getByRole('link', { name: 'Padaria' }).click();
  await page.getByLabel('Descrição').fill('Padaria da esquina');
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(
    page.getByRole('row', { name: /Padaria da esquina.*Inter \(arquivada\)/ }),
  ).toBeVisible();
});

test('filtros inválidos na URL não quebram a página', async ({ page }) => {
  await signUp(page);
  await page.goto('/painel/transacoes?from=2026-02-31');
  await expect(page.getByRole('heading', { name: 'Transações' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Alguns filtros eram inválidos',
  );
  await expect(page.getByLabel('Buscar')).toHaveAttribute('maxlength', '100');
});
