import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { addExpense, addIncome, createCheckingAccount, signUp } from './helpers';

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`acessibilidade (${theme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => window.localStorage.setItem('finlens-theme', t), theme);
    });

    for (const path of ['/', '/login', '/signup']) {
      test(path, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await seriousViolations(page)).toEqual([]);
      });
    }

    test('/painel', async ({ page }) => {
      await signUp(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page)).toEqual([]);
      for (const path of [
        '/painel/contas',
        '/painel/contas/nova',
        '/painel/transacoes',
        '/painel/transacoes/nova',
        '/painel/categorias',
      ]) {
        await page.goto(path);
        expect(await seriousViolations(page), path).toEqual([]);
      }
      // Formulário com sugestão visível.
      await createCheckingAccount(page);
      await page.goto('/painel/transacoes/nova');
      await page.getByLabel('Descrição').fill('IFOOD*REST');
      await expect(page.getByRole('status', { name: 'Sugestão automática' })).toContainText(
        'Delivery',
      );
      expect(await seriousViolations(page), 'sugestão').toEqual([]);
    });

    test('/painel com dados', async ({ page }) => {
      await signUp(page);
      await createCheckingAccount(page);
      await addIncome(page, 'SALARIO', '7.200,00', 'Receitas › Salário');
      await addExpense(page, 'ALUGUEL', '1.850,00', 'Moradia › Aluguel e financiamento');
      await addExpense(page, 'LOJA NOVA X', '10,00');
      await page.goto('/painel');
      await expect(page.getByRole('meter', { name: 'Renda gasta' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('/painel/revisao', async ({ page }) => {
      await signUp(page);
      await page.goto('/painel/revisao');
      expect(await seriousViolations(page), 'vazia').toEqual([]);
      await createCheckingAccount(page);
      for (const amount of ['12,50', '9,80', '15,00']) {
        await addExpense(page, 'PADARIA SAO JOAO', amount, 'Alimentação › Padaria');
      }
      await addExpense(page, 'LOJA NOVA X', '10,00');
      await page.goto('/painel/revisao');
      await expect(page.getByRole('region', { name: 'Regras sugeridas' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page), 'com grupos').toEqual([]);

      // Tela de semelhantes depois de corrigir uma padaria automática.
      await addExpense(page, 'PADARIA SAO JOAO', '11,00');
      await addExpense(page, 'PADARIA SAO JOAO', '13,00');
      await page.goto('/painel/transacoes');
      await page.getByRole('row', { name: /11,00/ }).getByRole('link').first().click();
      await expect(page.getByRole('heading', { name: 'Editar lançamento' })).toBeVisible();
      await page
        .getByLabel('Categoria', { exact: true })
        .selectOption({ label: 'Alimentação › Mercado' });
      await page.getByRole('button', { name: 'Salvar lançamento' }).click();
      await expect(page.getByRole('heading', { name: /^Aplicar/ })).toBeVisible();
      expect(await seriousViolations(page), 'semelhantes').toEqual([]);
    });
  });
}

test('erro de login legível (claro)', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('finlens-theme', 'light'));
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('ninguem@example.com');
  await page.getByLabel('Senha').fill('senha-errada-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});
