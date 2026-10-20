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
      // Percorre seis telas com axe e cria conta: passa de 30s com a suíte inteira em paralelo.
      test.setTimeout(60_000);
      await signUp(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page)).toEqual([]);
      for (const path of [
        '/painel/contas',
        '/painel/contas/nova',
        '/painel/transacoes',
        '/painel/transacoes/nova',
        '/painel/categorias',
        '/painel/conta',
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

    test('insights', async ({ page }) => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(),
      );
      test.skip(Number(today.slice(8)) < 2, 'precisa de dois dias no mês');
      await signUp(page);
      await createCheckingAccount(page);
      for (const d of ['01', '02']) {
        await addExpense(page, 'NETFLIX', '55,90', undefined, `${today.slice(0, 7)}-${d}`);
      }
      await page.goto('/painel');
      await expect(page.getByRole('region', { name: 'O que mudou' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page), 'início').toEqual([]);
      await page.goto('/painel/insights');
      expect(await seriousViolations(page), 'página').toEqual([]);
    });

    test('/painel/metas', async ({ page }) => {
      await signUp(page);
      await createCheckingAccount(page);
      await page.goto('/painel/metas');
      // Alvo abaixo do saldo: a meta fica "Concluída" e o selo entra na verificação.
      await page.getByLabel('Nome', { exact: true }).fill('Reserva');
      await page.getByLabel('Valor-alvo', { exact: true }).fill('1.000,00');
      await page.getByRole('button', { name: 'Criar meta' }).click();
      await expect(page.getByRole('region', { name: 'Reserva' })).toContainText('Concluída');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('revisão com transferência a confirmar', async ({ page }) => {
      await signUp(page);
      await createCheckingAccount(page);
      await page.goto('/painel/contas/nova');
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(),
      );
      await page.getByLabel('Nome').fill('Reserva');
      await page.getByLabel('Tipo').selectOption('savings');
      await page.getByLabel('Saldo inicial').fill('0,00');
      await page.getByLabel('Data do saldo').fill(`${today.slice(0, 7)}-01`);
      await page.getByRole('button', { name: 'Salvar conta' }).click();
      await expect(page).toHaveURL(/\/painel\/contas$/);
      for (const [kind, account, desc] of [
        ['Saída', 'Inter', 'ENVIO'],
        ['Entrada', 'Reserva', 'ENTRADA'],
      ] as const) {
        await page.goto('/painel/transacoes/nova');
        await page.getByRole('radio', { name: kind }).check();
        await page.getByLabel('Conta').selectOption({ label: account });
        await page.getByLabel('Valor').fill('40,00');
        await page.getByLabel('Descrição').fill(desc);
        await page.getByRole('button', { name: 'Salvar lançamento' }).click();
        await expect(page).toHaveURL(/\/painel\/transacoes$/);
      }
      await page.goto('/painel/revisao');
      await expect(page.getByRole('region', { name: 'Transferências a confirmar' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('/painel/recorrencias', async ({ page }) => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(),
      );
      const ago = (n: number) =>
        new Date(Date.parse(`${today}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
      await signUp(page);
      await createCheckingAccount(page);
      test.setTimeout(120_000);
      for (const k of [2, 1, 0]) {
        await addExpense(page, 'SPOTIFY AB', '21,90', undefined, ago(3 + 28 * k));
        await addExpense(page, 'SMARTFIT', '99,90', undefined, ago(45 + 30 * k));
        await addExpense(page, 'CLUBE DO LIVRO', '39,90', undefined, ago(100 + 30 * k));
      }
      await addExpense(page, 'PADARIA', '15,00', undefined, ago(1));
      await page.goto('/painel/recorrencias');
      await page.getByText(/^Encerradas/).click();
      await expect(page.getByRole('list', { name: 'Cobranças recorrentes' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('/painel/parcelas', async ({ page }) => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(),
      );
      const ago = (n: number) =>
        new Date(Date.parse(`${today}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
      test.setTimeout(120_000);
      await signUp(page);
      await createCheckingAccount(page);
      for (const [k, n] of [
        [33, '02'],
        [3, '03'],
      ] as const) {
        await addExpense(page, `MAGALU PARC ${n}/10`, '199,00', undefined, ago(k));
      }
      await addExpense(page, 'ESTANTE LOJA PARC 05/05', '80,00', undefined, ago(20));
      await page.goto('/painel/parcelas');
      await page.getByText(/^Encerradas/).click();
      await expect(page.getByRole('list', { name: 'Parcelamentos ativos' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page)).toEqual([]);
    });

    test('/painel/orcamentos', async ({ page }) => {
      await signUp(page);
      await createCheckingAccount(page);
      await page.goto('/painel/orcamentos');
      expect(await seriousViolations(page), 'vazia').toEqual([]);
      await page.getByLabel('Limite mensal para Alimentação').fill('100,00');
      await page.getByRole('button', { name: 'Definir orçamento de Alimentação' }).click();
      await addExpense(page, 'MERCADO', '85,00', 'Alimentação › Mercado');
      await page.goto('/painel/orcamentos');
      await expect(page.getByRole('meter', { name: 'Orçamento de Alimentação' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await seriousViolations(page), 'com orçamento').toEqual([]);
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
      await page.getByRole('button', { name: 'Sugerir com IA' }).click();
      await expect(page.getByText('A IA local não encontrou uma categoria.')).toBeVisible();
      expect(await seriousViolations(page), 'com sugestão da IA').toEqual([]);

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
