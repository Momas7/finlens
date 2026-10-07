import { expect, test } from '@playwright/test';
import { PASSWORD, signUp } from './helpers';

test('cadastro, painel, logout e login', async ({ page }) => {
  await page.goto('/painel');
  await expect(page).toHaveURL(/\/login/);
  const email = await signUp(page);
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
  await expect(page.getByText('Workspace: Pessoal')).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/painel/);
  await expect(page.getByRole('heading', { name: 'Olá, Ana' })).toBeVisible();
});

test('com sessão, / vai para /painel', async ({ page }) => {
  await signUp(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/painel/);
});

test('senha errada mostra erro', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('ninguem@example.com');
  await page.getByLabel('Senha').fill('senha-errada-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
});

test('cookie de sessão inválido leva ao login sem loop de redirect', async ({ page, context }) => {
  await context.addCookies([
    { name: 'better-auth.session_token', value: 'sessao-invalida', url: 'http://localhost:3000' },
  ]);
  await page.goto('/painel');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('nome longo não causa rolagem horizontal no celular', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signUp(page, 'Maria Aparecida dos Santos Albuquerque Figueiredo');
  await expect(page.getByRole('heading', { name: /Olá, Maria/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
