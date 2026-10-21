# Finlens — Arquitetura e escopo do MVP

> Status: aprovado em 2026-10-06. Mudanças relevantes devem virar ADR em `docs/adr/`.

## 1. Visão

Finlens é um analista financeiro pessoal open source e self-hosted. O usuário importa extratos, o sistema classifica quase tudo sozinho, pede confirmação apenas do que tem dúvida, aprende com as correções e transforma os dados em insights acionáveis (problema, evidência, impacto em R$, sugestão).

Objetivo secundário: ser um projeto de portfólio que demonstre arquitetura limpa, pipeline de classificação híbrido e medido, motor de insights determinístico e isolamento de dados multi-tenant.

## 2. Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Distribuição | Open source (MIT), self-hosted via Docker/Podman Compose, com instância demo usando dados sintéticos | Portfólio público; evita operar serviço com dados financeiros reais de terceiros |
| Estrutura | Monorepo pnpm + Turborepo, monólito modular | Simples para o MVP, extensível para mobile e Open Finance |
| Frontend | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query + Recharts | — |
| API | Fastify + Zod, separada do frontend | Mobile, webhooks de Open Finance e workers precisam de API independente |
| ORM | Drizzle | Muito SQL analítico, RLS com `SET LOCAL`, `pg_trgm` |
| Auth | Better Auth | Independente de framework; sessão, 2FA |
| Fila | pg-boss (fila no Postgres) | Zero infraestrutura extra no MVP |
| Banco | PostgreSQL 17 + `pg_trgm` (`pgvector` na v2) | — |
| LLM | Interface `LlmProvider` (Claude, Ollama ou fake), desligado por padrão | Uso mínimo e opcional; self-hosters podem usar modelo local |
| Bancos iniciais | Banco Inter e Mercado Pago | Bancos usados pelo autor |
| Dinheiro | `bigint` em centavos, sinal `+` entrada / `-` saída | Nunca float |
| Datas | `DATE` em `America/Sao_Paulo`; compras de cartão guardam data da compra e mês da fatura | Análise de comportamento vs fluxo de caixa |
| Tenant | `workspace` desde o dia 1; usuários são membros | Compartilhamento familiar futuro sem migração |

## 3. Arquitetura

```
apps/web (Next.js) ──HTTP──► apps/api (Fastify) ──► PostgreSQL (RLS)
                                   │ enfileira              ▲
                                   ▼                        │
                             apps/worker (pg-boss) ─────────┘

packages/domain     regras puras (parsers, normalização, classificação, insights, planejamento), sem I/O
packages/db         schema Drizzle, migrations, políticas RLS, seeds
packages/contracts  schemas Zod compartilhados entre web, api e mobile futuro
packages/llm        LlmProvider
tools/classifier-eval  dataset sintético + métricas do classificador
```

Toda fonte de dados implementa `TransactionSource` e produz `RawTransaction`. CSV, OFX, lançamento manual e, no futuro, Open Finance (via agregador como Pluggy) passam pelo mesmo pipeline: normalizar → deduplicar → enriquecer → classificar → persistir.

## 4. Pipeline de importação

1. Upload (limite 5 MB, validação de conteúdo) cria `import_batch` com `sha256` do arquivo; arquivo repetido é rejeitado.
2. A API lê o arquivo na hora, sem worker (extratos têm centenas de linhas), e detecta o formato (OFX ou CSV com perfil por instituição; CSV desconhecido pede mapeamento de colunas).
3. Normalização da descrição.
4. Deduplicação: `external_id` (FITID do OFX) ou `fingerprint = sha256(account|date|amount|desc_norm|ordinal)`, com `UNIQUE(workspace_id, fingerprint)`.
5. Enriquecimento: parcelas, transferências, pagamento de fatura, estornos.
6. Classificação em lote.
7. Persistência atômica e contadores (total, novas, duplicadas, auto, prováveis, revisar).
8. Jobs `recurring.detect` e `insights.generate`.
9. Arquivo bruto descartado após o parse.

## 5. Classificação

Normalização: maiúsculas, remoção de acentos, extração de gateway (`PAG*`, `MP*`, `MERCADOPAGO*`, `PG *`, `IZ *`, `SUMUP *`, `EC *`, `PAYPAL *`, `EBANX*`), extração de parcela, remoção de cidade/UF/datas/números longos.

Camadas, que produzem candidatos com score combinados por um `combiner`:

1. Regras do usuário (condições sobre estabelecimento, texto, faixa de valor, conta) — 0.99
2. Histórico do usuário por estabelecimento/contraparte e faixa de valor, com suavização bayesiana
3. kNN por similaridade (`pg_trgm`) com transações confirmadas
4. Dicionário global de estabelecimentos — 0.90
5. Palavras-chave (POSTO, DROGARIA, SUPERMERCADO…) — 0.70–0.80
6. LLM só para descrições desconhecidas, em lote, com cache global por `desc_norm`; envia apenas a descrição normalizada — ≤ 0.80
7. Pergunta ao usuário

Limiares: `≥ 0.90` auto; `0.70–0.90` provável; `< 0.70` ou conflito revisar. Toda classificação guarda `source` e uma explicação legível.

Aprendizado: cada confirmação ou correção grava `classification_feedback` e atualiza `merchant_category_stats`. Correções consistentes geram regras sugeridas; correções podem ser propagadas para transações semelhantes não confirmadas. Transações confirmadas manualmente nunca são sobrescritas.

Métricas (harness em `tools/classifier-eval`, roda no CI): % auto-classificado, precisão por camada, calibração por faixa de confiança, chamadas de LLM por 1.000 transações.

## 6. Enriquecimento

- **Transferências:** valores opostos entre contas do mesmo workspace em ±2 dias; padrões de pagamento de fatura. Ficam fora de gasto e receita.
- **Parcelas:** regex (`PARC 04/12`, `04/12`, `4 DE 12`) validada por contexto; `installment_plans` projeta parcelas futuras e compromisso total.
- **Recorrências:** agrupamento por estabelecimento e valor (±15%), intervalo mediano define cadência; detecta aumento de preço e cobrança não ocorrida.

## 7. Insights

Geradores plugáveis e puros (`InsightGenerator.run(ctx) → InsightCandidate[]`) sobre agregados SQL. Cada insight tem problema, evidência numérica, impacto em centavos, sugestão, ação e `dedupeKey`. Filtros de valor mínimo, histórico mínimo e cooldown. Ranking por impacto × severidade × novidade.

Geradores do MVP: variação por categoria (mês anterior e mediana 3–6 meses), peso no gasto variável, frequência, pequenas compras, recorrentes/novas assinaturas/aumento de preço, concentração temporal, tarifas/juros/IOF, possível cobrança duplicada, ritmo de orçamento, taxa de poupança, comprometimento com parcelas, anomalias (z-score robusto com mediana/MAD).

LLM nunca calcula números. Na v2 pode redigir um resumo a partir de fatos já calculados, com validação dos valores citados.

## 8. Planejamento

- **Metas:** progresso, quanto falta, previsão de conclusão (com ou sem taxa), aporte necessário para uma data.
- **Orçamento:** sugestão pela mediana de 3–6 meses arredondada a R$ 50; projeção de ritmo separando gastos fixos de variáveis; alertas em 80% e 100%.

## 9. Segurança

- `workspace_id` em todas as tabelas de tenant, com Postgres RLS (`SET LOCAL app.workspace_id`) como defesa em profundidade; `workspace_id` vem sempre da sessão.
- Senhas com argon2id, 2FA TOTP, cookies `HttpOnly`/`Secure`/`SameSite=Lax`, rate limit no login.
- Zod em toda entrada; SQL sempre parametrizado.
- Logs estruturados (pino) com redaction de valores, descrições e tokens; `audit_logs` para ações sensíveis.
- Secrets fora do repositório; gitleaks e Dependabot no CI.
- **Open source:** extratos reais nunca entram no repositório. Fixtures são sintéticas; `fixtures/private/` fica no `.gitignore`.
- LGPD: exportação de dados e exclusão de conta com hard delete em cascata.

## 10. MVP

Inclui: contas e autenticação; contas e cartões; importação OFX/CSV (Inter e Mercado Pago) e lançamento manual; deduplicação; parcelas, transferências e pagamento de fatura; classificação camadas 1–5 (LLM atrás de feature flag); inbox de revisão agrupada por estabelecimento; aprendizado e regras sugeridas; categorias editáveis; dashboard; recorrências; cerca de 10 geradores de insight e anomalias; metas; orçamentos; exportação e exclusão de dados; seed de demonstração.

Fica fora: Open Finance, mobile, notificações, embeddings/ML, narrativa por LLM, previsão de saldo, calendário, score, investimentos, compartilhamento familiar, split de transação, tags.

## 11. Roadmap

- **F0 Fundação:** monorepo, Compose, Postgres + RLS, Better Auth, API e web esqueleto, CI.
- **F1 Ingestão:** contas e cartões, parsers OFX/CSV (Inter, Mercado Pago), deduplicação, lançamento manual, lista de transações.
- **F2 Classificação:** normalização, seeds, camadas 1–5, inbox de revisão, aprendizado, harness de avaliação.
- **F3 Enriquecimento:** transferências, fatura, parcelas, recorrências.
- **F4 Visão:** analytics, dashboard, orçamentos.
- **F5 Inteligência:** insights, anomalias, recomendações, metas.
- **F6 Polimento:** LLM fallback, demo, privacidade, deploy, README.
- **v2/v3:** Open Finance, notificações, narrativa LLM, embeddings, previsões, mobile (Expo), família, investimentos.
