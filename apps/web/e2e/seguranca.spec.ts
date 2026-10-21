import { expect, type Page, test } from '@playwright/test';
import { PASSWORD, signUp } from './helpers';
import { totp } from './totp';

const security = (page: Page) => page.getByRole('region', { name: /Segurança/ });

async function enableTwoFactor(page: Page) {
  await page.goto('/painel/conta');
  await page.getByRole('button', { name: 'Ativar 2FA' }).click();
  await security(page).getByLabel('Senha atual').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByAltText('QR code para o aplicativo autenticador')).toBeVisible();
  const secret = (await page.locator('code').first().innerText()).trim();
  const codes = (await page.locator('ul.figure li').allInnerTexts()).map((c) => c.trim());
  expect(codes).toHaveLength(10);
  await page.getByLabel('Código do aplicativo').fill(totp(secret));
  await page.getByRole('button', { name: 'Confirmar e ativar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Ativado' })).toBeVisible();
  return { secret, codes };
}

async function logIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/$|\/login/);
}

test('ativar o 2FA, entrar com o código e com um código de reserva', async ({ page }) => {
  test.setTimeout(150_000);
  const email = await signUp(page);
  const { secret, codes } = await enableTwoFactor(page);
  await expect(page.getByRole('table', { name: 'Atividade recente da conta' })).toContainText(
    'Ativou o 2FA',
  );

  await signOut(page);
  await logIn(page, email);
  await expect(page.getByRole('heading', { name: 'Confirme que é você' })).toBeVisible();
  await page.getByLabel('Código do aplicativo').fill('000000');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Código inválido.')).toBeVisible();
  await page.getByLabel('Código do aplicativo').fill(totp(secret));
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel/);

  // Código de reserva: vale uma vez.
  await signOut(page);
  await logIn(page, email);
  await page.getByRole('button', { name: 'Usar código de reserva' }).click();
  await page.getByLabel('Código de reserva').fill(codes[0] ?? '');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel/);
  await signOut(page);
  await logIn(page, email);
  await page.getByRole('button', { name: 'Usar código de reserva' }).click();
  await page.getByLabel('Código de reserva').fill(codes[0] ?? '');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Código inválido.')).toBeVisible();
});

test('desativar o 2FA volta ao login simples e a atividade registra', async ({ page }) => {
  test.setTimeout(150_000);
  const email = await signUp(page);
  await enableTwoFactor(page);
  await page.getByRole('button', { name: 'Desativar 2FA' }).click();
  await security(page).getByLabel('Senha atual').fill('senha-errada-000');
  await page.getByRole('button', { name: 'Desativar', exact: true }).click();
  await expect(page.getByText('Senha incorreta.')).toBeVisible();
  await security(page).getByLabel('Senha atual').fill(PASSWORD);
  await page.getByRole('button', { name: 'Desativar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Desativado' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Atividade recente da conta' });
  await expect(table).toContainText('Desativou o 2FA');
  await signOut(page);
  await logIn(page, email);
  await expect(page).toHaveURL(/\/painel/);
});
