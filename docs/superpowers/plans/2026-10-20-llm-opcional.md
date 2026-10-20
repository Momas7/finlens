# LLM opcional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Sugerir com IA" na Revisão, com um servidor local compatível com OpenAI, desligado por padrão.

**Architecture:** Prompt e parser puros no domínio; cliente HTTP e rotas na API (cache e limite); botão cliente na Revisão.

**Spec:** `docs/superpowers/specs/2026-10-20-llm-opcional-design.md`

## Global Constraints

- Só descrição normalizada, sinal e nomes de categorias saem; confiança ≤ 0,80; nada é gravado na sugestão.
- Sem `Co-Authored-By` nem rodapé de ferramenta.

## Review Focus

1. Resposta com categoria de outro tipo (receita para saída) é descartada. — Task 1/2.
2. Servidor lento ou fora do ar: sem erro para o usuário e sem travar a Revisão. — Task 2.
3. Descrição normalizada vazia: sem chamada. — Task 2.
4. Cache não vaza entre sinais (saída/entrada) nem entre workspaces (a chave inclui o texto e o sinal, e as categorias vêm do workspace da requisição, então inclui o workspace). — Task 2.
5. Recurso desligado: nada no cliente nem na rede. — Task 2/3.

### Task 1: Domínio — prompt e parser
**Files:** Create `packages/domain/src/llm/{prompt.ts,prompt.test.ts,index.ts}`; Modify `packages/domain/src/index.ts`.
- [ ] Testes RED → implementar → GREEN → `git commit -m "feat(domain): llm prompt and answer parser"`

### Task 2: API
**Files:** Create `apps/api/src/modules/llm/{client,routes}.ts`, `apps/api/test/llm.integration.test.ts`; Modify `config.ts`, `app.ts`, `.env.example`, `packages/contracts/src/llm.ts` (+ index).
- [ ] Testes com servidor HTTP falso (porta efêmera) RED → implementar → GREEN → `git commit -m "feat(api): optional local llm suggestion"`

### Task 3: Web
**Files:** Create `apps/web/src/app/painel/revisao/llm-button.tsx`, `apps/web/e2e/fake-llm.mjs`, `apps/web/e2e/llm.spec.ts`; Modify `revisao/{page,group-form}.tsx`, `apps/web/playwright.config.ts` (servidor falso + env), `e2e/a11y.spec.ts`.
- [ ] E2E RED → implementar → GREEN → `git commit -m "feat(web): suggest with local ai on review"`

### Task 4: README e verificação final
- [ ] README (seção "IA local opcional", variáveis, aviso de privacidade; roadmap); suíte completa PASS.
