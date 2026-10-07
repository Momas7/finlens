# Identidade visual "Fita métrica" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar a identidade "Fita métrica" ao web: tokens, tema claro/escuro, componentes base com a régua-assinatura, landing pública, login/cadastro e área logada em `/painel`.

**Architecture:** Tokens como CSS vars em `globals.css` expostos ao Tailwind v4 via `@theme`. Lógica com regra (geometria da régua, resolução de tema) em funções puras testadas no Vitest; componentes React finos por cima. Rotas: `/` landing, `/painel` área logada, controle por `src/proxy.ts`.

**Tech Stack:** Next.js 16 (App Router), React 19.3, Tailwind v4, `next/font/google` (Archivo), Vitest, Playwright, `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-10-07-identidade-visual-design.md`

## Global Constraints

- Cores exatamente as da tabela do spec (claro/escuro), nomes de token: `page`, `raised`, `ink`, `ink-soft`, `scale`, `tape`, `on-tape`, `mark`, `gain`.
- Fonte única Archivo, eixos `wdth` e `wght`; números de destaque com `font-stretch: 80%`, peso 600, `tabular-nums`.
- Escala de tipo: 13 / 15 / 18 / 24 / 32 / 48 px. Raio 6px controles, 10px painéis. Sem sombras. Foco: anel 2px `ink`, offset 2px.
- `tape` só marca medida; nunca fundo de botão. Botão primário usa `ink`.
- Sem rótulos em caixa alta, sem fonte monoespaçada para dados, sem emoji.
- Movimento só na régua (400ms ease-out); nada se move com `prefers-reduced-motion: reduce`.
- Tema persistido em `localStorage` chave `finlens-theme`, valores `system` | `light` | `dark`, aplicado como `data-theme` (`light`|`dark`) no `<html>`.
- Textos da interface em pt-BR, sentence case. Mensagens de erro atuais de login/cadastro mantidas.
- Commits sem linha de coautoria.

## Review Focus

1. **Régua com valor acima do máximo** (gasto 1.200 num orçamento de 750, sem `max` maior): esperado trecho excedente limitado à largura da régua, sem vazar do layout, e `aria-valuetext` com o valor real. — Task 2.
2. **Valores degenerados na régua** (`max = 0`, valor negativo): esperado régua vazia, sem `NaN` em estilo. — Task 2.
3. **`localStorage` indisponível** (modo privado, bloqueado): esperado tema do sistema, sem erro. — Task 1.
4. **Valor inválido salvo em `finlens-theme`**: esperado tratado como `system`. — Task 1.
5. **Nome de usuário longo em tela de celular (375px)**: esperado sem rolagem horizontal na área logada. — Task 4.

---

## File Structure

```
apps/web/
├─ vitest.config.ts                         (novo) testes unitários do web
├─ src/app/globals.css                      tokens + @theme
├─ src/app/layout.tsx                       Archivo, script de tema, data-theme
├─ src/app/icon.svg                         favicon (símbolo da régua)
├─ src/lib/theme.ts                         resolveTheme, readStoredTheme, THEME_STORAGE_KEY, themeScript
├─ src/lib/theme.test.ts
├─ src/lib/scale-geometry.ts                scaleGeometry
├─ src/lib/scale-geometry.test.ts
├─ src/components/ui/scale.tsx
├─ src/components/ui/figure.tsx
├─ src/components/ui/button.tsx             (reescrito: variantes + ButtonLink)
├─ src/components/ui/field.tsx              (substitui input.tsx e label.tsx)
├─ src/components/ui/panel.tsx              (substitui card.tsx)
├─ src/components/logo.tsx
├─ src/components/theme-toggle.tsx
├─ src/proxy.ts                             rotas públicas / redirecionamentos
├─ src/app/page.tsx                         landing
├─ src/app/(landing)/classifier-demo.tsx    demonstração
├─ src/app/(auth)/layout.tsx                layout dividido
├─ src/app/(auth)/login/page.tsx
├─ src/app/(auth)/signup/page.tsx
├─ src/app/painel/layout.tsx                área logada (move de (app))
├─ src/app/painel/page.tsx
├─ src/app/painel/sign-out-button.tsx
└─ e2e/{auth,landing,theme,a11y}.spec.ts
```

---

### Task 1: Tokens, fonte e tema

**Files:**
- Create: `apps/web/vitest.config.ts`, `apps/web/src/lib/theme.ts`, `apps/web/src/components/theme-toggle.tsx`
- Modify: `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/package.json` (script `test`, devDeps `vitest`, `@axe-core/playwright`)
- Test: `apps/web/src/lib/theme.test.ts`, `apps/web/e2e/theme.spec.ts`

**Interfaces:**
- Produces:
  - `type ThemePreference = 'system' | 'light' | 'dark'`
  - `THEME_STORAGE_KEY = 'finlens-theme'`
  - `readStoredTheme(storage: Pick<Storage, 'getItem'> | undefined): ThemePreference` — inválido, ausente ou exceção → `'system'`.
  - `resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): 'light' | 'dark'`
  - `themeScript: string` — JS inline que lê a chave, resolve e define `document.documentElement.dataset.theme` antes da pintura.
  - `<ThemeToggle />` — botão cíclico sistema → claro → escuro, `aria-label` "Tema: {Sistema|Claro|Escuro}. Trocar tema".
  - Classes Tailwind de cor: `bg-page`, `bg-raised`, `text-ink`, `text-ink-soft`, `border-scale`, `bg-tape`, `text-on-tape`, `text-mark`, `bg-mark`, `text-gain`. Utilitário CSS `.figure` (condensado, 600, tabular).

- [ ] **Step 1: Write the failing tests**

```ts
// theme.test.ts
it.each([['light','light'],['dark','dark'],['system','system'],['purple','system'],[null,'system']])(
  'readStoredTheme(%s) -> %s', (stored, expected) =>
    expect(readStoredTheme({ getItem: () => stored })).toBe(expected));
it('readStoredTheme sem storage -> system', () => expect(readStoredTheme(undefined)).toBe('system'));
it('readStoredTheme com storage que lança -> system', () =>
  expect(readStoredTheme({ getItem: () => { throw new Error('blocked'); } })).toBe('system'));
it('resolveTheme', () => {
  expect(resolveTheme('system', true)).toBe('dark');
  expect(resolveTheme('system', false)).toBe('light');
  expect(resolveTheme('light', true)).toBe('light');
  expect(resolveTheme('dark', false)).toBe('dark');
});

// e2e/theme.spec.ts
test('tema escolhido persiste após recarregar', async ({ page }) => {
  await page.goto('/login');
  const toggle = page.getByRole('button', { name: /Trocar tema/ });
  await toggle.click(); // sistema -> claro
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await toggle.click(); // claro -> escuro
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @finlens/web test` — Expected: FAIL (módulo `./theme` inexistente).

- [ ] **Step 3: Implement tokens, `theme.ts`, `ThemeToggle` e layout**

`globals.css`: vars em `:root` (claro), `[data-theme="dark"]` e `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {...} }`; `@theme inline` mapeia `--color-*`; `body` com `bg-page text-ink`, Archivo, 15px; `:focus-visible` com anel do spec; `@media (prefers-reduced-motion: reduce)` zera animações. `layout.tsx`: `Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo' })`, `<html lang="pt-BR" suppressHydrationWarning>`, `<script dangerouslySetInnerHTML={{ __html: themeScript }} />` no `<head>`. Toggle: estado inicial lido no `useEffect` (evita mismatch de hidratação), grava no storage com try/catch e atualiza `data-theme`. O toggle aparece temporariamente no layout `(auth)` para o e2e (posição final na Task 4).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @finlens/web test && pnpm --filter @finlens/web test:e2e` — Expected: PASS (inclui e2e de auth existentes).

- [ ] **Step 5: Commit** — `feat(web): add design tokens, Archivo and theme switching`

---

### Task 2: Régua (`Scale`) e `Figure`

**Files:**
- Create: `apps/web/src/lib/scale-geometry.ts`, `apps/web/src/components/ui/scale.tsx`, `apps/web/src/components/ui/figure.tsx`
- Test: `apps/web/src/lib/scale-geometry.test.ts`

**Interfaces:**
- Produces:
  - `scaleGeometry(input: { value: number; max: number; limit?: number; ticks?: number }): { filledPct: number; overPct: number; markerPct: number; limitPct: number | null; tickPcts: number[] }` — percentuais 0–100 com até 2 casas. `filledPct` = trecho até `min(value, limit ?? max)`; `overPct` = trecho entre `limit` e `value`, limitado a `100 - limitPct`; `markerPct` = `min(value, max)`; `ticks` padrão 10 gera `ticks + 1` posições (0 e 100 incluídos). `max <= 0` ou valor não finito → tudo 0, `limitPct` null.
  - `<Scale value max limit? ticks? label valueText />` — `role="meter"`, `aria-label={label}`, `aria-valuemin=0`, `aria-valuemax={max}`, `aria-valuenow={value}`, `aria-valuetext={valueText}`; classe `scale-measure` anima a largura (400ms).
  - `<Figure value: string caption: string size?: 'md' | 'lg' />` — 32px (`md`) ou 48px (`lg`).

- [ ] **Step 1: Write the failing test**

```ts
it('dentro do limite', () => expect(scaleGeometry({ value: 612, max: 750 })).toMatchObject({ filledPct: 81.6, overPct: 0, markerPct: 81.6, limitPct: null }));
it('acima do limite', () => {
  const g = scaleGeometry({ value: 900, max: 1000, limit: 750 });
  expect(g).toMatchObject({ filledPct: 75, overPct: 15, markerPct: 90, limitPct: 75 });
});
it('acima do máximo não vaza', () => {
  const g = scaleGeometry({ value: 1200, max: 750, limit: 750 });
  expect(g).toMatchObject({ filledPct: 100, overPct: 0, markerPct: 100, limitPct: 100 });
});
it('excedente limitado ao fim da régua', () =>
  expect(scaleGeometry({ value: 2000, max: 1000, limit: 600 }).overPct).toBe(40));
it.each([[{ value: 10, max: 0 }], [{ value: -5, max: 100 }], [{ value: Number.NaN, max: 100 }]])('degenerado %j', (i) => {
  const g = scaleGeometry(i);
  expect(g.filledPct).toBe(0); expect(g.overPct).toBe(0); expect(g.markerPct).toBe(0);
});
it('traços', () => expect(scaleGeometry({ value: 1, max: 4, ticks: 4 }).tickPcts).toEqual([0, 25, 50, 75, 100]));
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @finlens/web test` — Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement `scaleGeometry`, `Scale`, `Figure`**
- [ ] **Step 4: Run to verify it passes** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): add measuring scale and figure components`

---

### Task 3: Componentes base e marca

**Files:**
- Create: `apps/web/src/components/ui/field.tsx`, `apps/web/src/components/ui/panel.tsx`, `apps/web/src/components/logo.tsx`, `apps/web/src/app/icon.svg`
- Modify: `apps/web/src/components/ui/button.tsx`
- Delete: `apps/web/src/components/ui/{input,label,card}.tsx`, `apps/web/src/app/favicon.ico`

**Interfaces:**
- Produces:
  - `<Button variant?: 'primary' | 'secondary' | 'ghost' size?: 'md' | 'lg' {...button props} />` e `<ButtonLink href variant? size? />` (usa `next/link`, mesmas classes).
  - `<Field label: string name: string hint?: string error?: string {...input props} />` — gera `id` com `useId`; `aria-describedby` aponta para hint/erro; `aria-invalid` quando `error`.
  - `<Panel as?: 'div' | 'section' | 'aside' className? />`
  - `<Logo size?: 'sm' | 'md' />` — texto "finlens" + svg de 5 traços (o do meio mais alto, em `tape`), `aria-label="Finlens"`.

Sem teste unitário próprio: comportamento coberto pelos e2e/axe das Tasks 4–5 (rótulos acessíveis, erro anunciado).

- [ ] **Step 1: Implementar componentes e `icon.svg`** (mesmo símbolo do `Logo`, 32×32, fundo `#1A1F24`).
- [ ] **Step 2: Verificar** — `pnpm --filter @finlens/web typecheck && pnpm lint` — Expected: sem erros (páginas antigas ainda importam `input/label/card`; trocar os imports dessas páginas para `Field`/`Panel` neste mesmo passo, sem redesenhar).
- [ ] **Step 3: Rodar e2e** — `pnpm --filter @finlens/web test:e2e` — Expected: PASS.
- [ ] **Step 4: Commit** — `feat(web): add base components and logo`

---

### Task 4: Rotas, autenticação e área logada

**Files:**
- Modify: `apps/web/src/proxy.ts`, `apps/web/src/app/(auth)/layout.tsx`, `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/app/(auth)/signup/page.tsx`, `apps/web/e2e/auth.spec.ts`
- Create: `apps/web/src/app/painel/{layout,page,sign-out-button}.tsx` (move de `(app)`), `apps/web/e2e/a11y.spec.ts`
- Delete: `apps/web/src/app/(app)/`

**Interfaces:**
- Consumes: `Field`, `Button`, `Panel`, `Logo`, `Scale`, `Figure`, `ThemeToggle`, `getMe()` (`src/lib/me.ts`).
- Produces: rotas conforme tabela do spec. Proxy: públicas `/`, `/login`, `/signup`; com sessão em `/`, `/login`, `/signup` → `/painel`; sem sessão em qualquer outra → `/login`. Login/cadastro → `router.replace('/painel')`.

- [ ] **Step 1: Atualizar e2e (falham antes da mudança)**

`auth.spec.ts`: o primeiro teste passa a começar em `page.goto('/painel')` esperando `/login`; após cadastro e login espera `toHaveURL(/\/painel/)` e o heading `Olá, Ana`; mantém `Workspace: Pessoal` visível; mantém os testes de senha errada e cookie inválido (este navega para `/painel`). Novo teste:

```ts
test('com sessão, / vai para /painel', async ({ page }) => { /* cadastra, depois */
  await page.goto('/'); await expect(page).toHaveURL(/\/painel/); });
test('nome longo não causa rolagem horizontal no celular', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  /* cadastra com nome 'Maria Aparecida dos Santos Albuquerque Figueiredo' */
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
```

`a11y.spec.ts`: para `light` e `dark` (definidos via `localStorage` com `page.addInitScript`), rodar `new AxeBuilder({ page }).analyze()` em `/login`, `/signup` e `/painel` (logado) e esperar zero violações com `impact` `serious` ou `critical`.

- [ ] **Step 2: Rodar** — `pnpm --filter @finlens/web test:e2e` — Expected: FAIL (`/painel` inexistente).
- [ ] **Step 3: Implementar proxy, layout de autenticação dividido e área logada**

Layout `(auth)`: grid duas colunas ≥1024px; esquerda com `Logo`, formulário e `ThemeToggle`; direita `Panel` com `Figure` "R$ 612" / "Alimentação em outubro", `Scale` (612 de 750, limite 750) e o insight "Seus gastos com delivery aumentaram 37% este mês." com evidência "R$ 480 contra média de R$ 350". Área logada: barra superior (`Logo`, mês corrente por `Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })`, `ThemeToggle`, "Workspace: {nome}", `SignOutButton`) com `min-w-0` e `truncate` nos textos; conteúdo com `<h1>Olá, {nome}</h1>` e estado vazio "Importe seu primeiro extrato" / "O Finlens classifica as transações e mostra para onde vai seu dinheiro." / botão "Importar extrato" desabilitado com texto visível "Disponível na próxima fase".

- [ ] **Step 4: Rodar** — `pnpm --filter @finlens/web test:e2e` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(web): redesign auth screens and move app shell to /painel`

---

### Task 5: Landing pública

**Files:**
- Create: `apps/web/src/app/page.tsx`, `apps/web/src/app/(landing)/classifier-demo.tsx`, `apps/web/e2e/landing.spec.ts`
- Modify: `apps/web/e2e/a11y.spec.ts` (incluir `/`)

**Interfaces:**
- Consumes: `Logo`, `ButtonLink`, `Panel`, `Scale`, `ThemeToggle`.
- Produces: `/` público conforme spec.

Conteúdo fixo da demonstração (descrição → estabelecimento, categoria, confiança): `IFOOD*REST` → iFood, Alimentação › Delivery, 96%; `UBER *TRIP` → Uber, Transporte › App de transporte, 98%; `NETFLIX.COM` → Netflix, Assinaturas › Streaming, 99%; `POSTO IPIRANGA` → Posto Ipiranga, Transporte › Combustível, 91%; `PAG*ACADEMIA` → Academia, Saúde › Academia, 74%; `AMAZON BR` → Amazon, Compras › Outros, 58% (com nota "Pede sua confirmação"). Cada linha usa `Scale` com `max=100`. Blocos: "Classifica sozinho" (de 300 transações, 274 classificadas sem você), "Aprende com você" (corrigiu Amazon para Casa? compras parecidas seguem a correção), "Mostra o problema e o impacto" (delivery + Uber somam R$ 1.000/mês; reduzir 20% libera R$ 200).

- [ ] **Step 1: Write failing e2e**

```ts
test('landing sem sessão', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Importe o extrato. O Finlens mede para onde vai seu dinheiro.');
  await expect(page.getByRole('meter', { name: /IFOOD\*REST/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/signup');
  await expect(page.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
  await expect(page.getByRole('link', { name: /GitHub/ })).toHaveAttribute('href', 'https://github.com/Momas7/finlens');
});
```

- [ ] **Step 2: Rodar** — Expected: FAIL.
- [ ] **Step 3: Implementar landing** (h1 com tipografia condensada 48px no desktop, 32px no celular; demo ao lado no desktop, abaixo no celular).
- [ ] **Step 4: Rodar** — `pnpm --filter @finlens/web test:e2e` — Expected: PASS, incluindo a11y em `/`.
- [ ] **Step 5: Commit** — `feat(web): add public landing with classifier demo`

---

### Task 6: Revisão visual e verificação final

- [ ] **Step 1: Capturas** — com API e web rodando, capturar `/`, `/login`, `/painel` em 1440×900 e 375×812, temas claro e escuro (Playwright script temporário no scratchpad, fora do repo). Revisar cada imagem contra o spec (contraste, alinhamento, régua, nada cortado) e corrigir o que destoar.
- [ ] **Step 2: Suite completa** — `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm --filter @finlens/web build && pnpm --filter @finlens/web test:e2e` — Expected: tudo PASS.
- [ ] **Step 3: Commit** (se houve ajustes) — `fix(web): visual polish from screenshot review`
