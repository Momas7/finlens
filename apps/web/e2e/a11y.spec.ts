import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { addExpense, createCheckingAccount, signUp } from './helpers';

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
