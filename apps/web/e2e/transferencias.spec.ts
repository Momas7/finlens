import { expect, type Page, test } from '@playwright/test';
import { addIncome, createCheckingAccount, signUp } from './helpers';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);

async function savings(page: Page) {
  await page.goto('/painel/contas/nova');
  await page.getByLabel('Nome').fill('Reserva');
  await page.getByLabel('Tipo').selectOption('savings');
  await page.getByLabel('Saldo inicial').fill('0,00');
  await page.getByLabel('Data do saldo').fill(`${today.slice(0, 7)}-01`);
  await page.getByRole('button', { name: 'Salvar conta' }).click();
  await expect(page).toHaveURL(/\/painel\/contas$/);
}

async function move(
  page: Page,
  kind: 'Saída' | 'Entrada',
  account: string,
  amount: string,
  description: string,
) {
  await page.goto('/painel/transacoes/nova');
  await page.getByRole('radio', { name: kind }).check();
  await page.getByLabel('Conta').selectOption({ label: account });
  await page.getByLabel('Valor').fill(amount);
  await page.getByLabel('Descrição').fill(description);
  await page.getByRole('button', { name: 'Salvar lançamento' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);
}

test('transferência vira selo nas duas pontas e não muda o Sobrou', async ({ page }) => {
  await signUp(page);
  await createCheckingAccount(page, 'Inter', '1.000,00');
  await savings(page);
  await addIncome(page, 'SALARIO', '3.000,00', 'Receitas › Salário');
  await move(page, 'Saída', 'Inter', '500,00', 'PIX RESERVA');
  await move(page, 'Entrada', 'Reserva', '500,00', 'PIX RECEBIDO');
  await page.goto('/painel/transacoes');
  await expect(page.getByRole('row', { name: /PIX RESERVA/ })).toContainText(
    'Transferência com Reserva',
  );
  await expect(page.getByRole('row', { name: /PIX RECEBIDO/ })).toContainText(
    'Transferência com Inter',
  );
  await page.goto('/painel');
  await expect(page.getByText('R$ 3.000,00').first()).toBeVisible();
});

async function ambiguous(page: Page) {
  await signUp(page);
  await createCheckingAccount(page, 'Inter', '1.000,00');
  await savings(page);
  await move(page, 'Saída', 'Inter', '40,00', 'ENVIO');
  await move(page, 'Entrada', 'Reserva', '40,00', 'ENTRADA');
}

test('sugestão na Revisão: é transferência e não é', async ({ page }) => {
  await ambiguous(page);
  await expect(page.getByRole('link', { name: /^Revisão, \d+ pendentes$/ })).toBeVisible();
  await page.goto('/painel/revisao');
  const region = page.getByRole('region', { name: 'Transferências a confirmar' });
  await expect(region).toContainText('Valores iguais e opostos');
  await region.getByRole('button', { name: /^É transferência/ }).click();
  await expect(page.getByRole('region', { name: 'Transferências a confirmar' })).toHaveCount(0);
  await page.goto('/painel/transacoes');
  await expect(page.getByRole('row', { name: /ENVIO/ })).toContainText('Transferência com Reserva');
});

test('"Não é" some e não volta; desfazer transferência', async ({ page }) => {
  await ambiguous(page);
  await page.goto('/painel/revisao');
  await page
    .getByRole('region', { name: 'Transferências a confirmar' })
    .getByRole('button', { name: /^Não é/ })
    .click();
  await expect(page.getByRole('region', { name: 'Transferências a confirmar' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Transferências a confirmar' })).toHaveCount(0);

  await move(page, 'Saída', 'Inter', '70,00', 'PIX TESTE');
  await move(page, 'Entrada', 'Reserva', '70,00', 'PIX TESTE VOLTA');
  await page.goto('/painel/transacoes');
  await page
    .getByRole('row', { name: /PIX TESTE VOLTA/ })
    .getByRole('link')
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Editar lançamento' })).toBeVisible();
  await page.getByRole('button', { name: 'Desfazer transferência' }).click();
  await expect(page).toHaveURL(/\/painel\/transacoes$/);
  await expect(page.getByRole('row', { name: /PIX TESTE VOLTA/ })).not.toContainText(
    'Transferência com',
  );
});
