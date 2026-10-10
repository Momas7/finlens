# F6a: Vitrine

> Status: aprovado em 2026-10-10. Ficam para depois: exportar e excluir dados (F6b) e o LLM. Não haverá demo pública online.

## Objetivo

Quem chega pelo LinkedIn entende o Finlens em 30 segundos pelo README e consegue rodar uma demo completa com um comando, sem configurar nada.

Sucesso:

- `docker compose --profile demo up --build` (ou `podman compose ...`) sobe banco, migrações, API, web e a conta demo. Em http://localhost:3000, o login com a conta demo mostra todas as telas com conteúdo.
- O README abre com um GIF e capturas geradas por script.
- O CI garante que o perfil demo continua funcionando.

## Seed de demonstração (`tools/demo-seed`, `@finlens/demo-seed`)

- **Conta:** `demo@finlens.local` com a senha `demo-finlens-123`, apenas para uso local.
- **Gerador puro (`generateDemo(today)`):**
  - devolve um plano com contas, lançamentos, orçamentos e metas;
  - é determinístico (PRNG com semente fixa) e usa datas relativas ao mês de `today` mais os 5 anteriores;
  - nunca gera data posterior a `today`.
- **Contas:**
  - Inter (corrente, saldo inicial de R$ 2.500,00);
  - Mercado Pago (cartão, fechamento no dia 5 e vencimento no dia 12);
  - Reserva (poupança, saldo inicial de R$ 3.000,00).
  - A data do saldo inicial é o dia 1 do mês mais antigo.
- **Todo mês:**
  - salário, aluguel, condomínio, luz, internet, streaming e academia;
  - transferência de R$ 500,00 do Inter para a Reserva: uma saída e uma entrada em "Movimentação › Transferência entre contas";
  - lançamentos variáveis de mercado, delivery, aplicativo de transporte, farmácia, posto, padaria e compras no cartão.
- **Plantados:**
  - **Duplicata:** NETFLIX de R$ 55,90 em dois dias seguidos do mês corrente.
  - **Fora do padrão:** POSTO SHELL entre R$ 150 e R$ 190 nos meses anteriores e R$ 480 no mês corrente.
  - **Tarifas:** tarifa de R$ 32,00 e IOF de R$ 4,12 no mês corrente.
  - **Revisão:** três "LOJA DO BAIRRO ZETA" sem categoria, em modo automático.
  - **Regra sugerida:** "PADARIA SAO JOAO" confirmada três vezes em meses anteriores.
- **Confirmação:** meses anteriores levam a categoria explícita (ficam confirmados e alimentam o histórico). No mês corrente, os lançamentos ficam em `auto`, com exceção dos plantados que pedem categoria.
- **Orçamentos:**
  - Alimentação com o limite em cerca de 85% do gasto do mês, arredondado para cima a R$ 50;
  - Lazer de R$ 150 com R$ 220 gastos no mês corrente.
- **Meta:** "Reserva de emergência", alvo de R$ 15.000, data em dezembro do ano seguinte, rendimento de 10,5% ao ano, na conta Reserva.
- **Executor (`runDemoSeed(client, plan)`):**
  - fala com a API por um `client(method, path, body?)` que guarda o cookie da sessão;
  - resolve rótulos de categoria ("Raiz › Filha") em ids pelo `GET /v1/categories` e falha se algum não existir;
  - é idempotente: se o login da conta demo funciona, não faz nada e devolve `{ created: false }`.
- **CLI (`pnpm demo:seed`):** usa `DEMO_API_URL` (padrão `http://localhost:3333`) e envia o cabeçalho `Origin` igual a `WEB_ORIGIN`.

## Docker

- **Uma imagem (`Dockerfile` na raiz):**
  - Node 24 slim, `pnpm install --frozen-lockfile` e `next build` da web;
  - roda com usuário sem root;
  - a mesma imagem serve à API, à web, ao migrate e ao seed, com um comando diferente em cada serviço.
- `.dockerignore`: `node_modules`, `.next`, `.turbo`, `fixtures/private`, `.env*`, `test-results` e `.superpowers`.
- **`compose.yaml`:**
  - o `db` ganha `restart: unless-stopped`;
  - o perfil `demo` acrescenta:
    - `migrate`, que roda uma vez;
    - `api`, com healthcheck em `/health`;
    - `web`, na porta 3000;
    - `seed`, que roda uma vez depois que a API fica saudável.
  - As variáveis ficam no próprio compose, com valores "apenas local". O README avisa para não usá-los fora da máquina.
- **CI:** um job `demo` que sobe o perfil, espera o seed terminar com código 0 e checa `GET /login` com 200.

## Mídia (`pnpm docs:media`)

- Um script Playwright separado da suíte e2e (`apps/web/media/`) que roda contra um app com a conta demo (`MEDIA_BASE_URL`, padrão `http://localhost:3000`).
- Gera em `docs/media/`:
  - PNGs da Início, Revisão, Orçamentos, Metas e Insights, nos temas claro e escuro, em 1440×900, mais a Início em 390×844;
  - um vídeo do percurso "Início → Revisão → confirmar um grupo → Início", convertido em `finlens.gif` pelo ffmpeg (paleta otimizada, 12 fps, 960 px de largura, até 5 MB).

## README

Seções, nesta ordem:

1. Título, frase, GIF e selos de CI e licença.
2. "Experimente em 1 comando".
3. O que ele faz: classificação que aprende, revisão, painel do mês, orçamentos, insights e metas, cada um com uma captura.
4. Qualidade em números: precisão do classificador, contagem de testes da última execução local, acessibilidade com axe e RLS.
5. Arquitetura e decisões.
6. Rodar para desenvolver, com a nota sobre `podman-restart.service`.
7. Roadmap.
8. Segurança e licença.

## Testes

- **Unitário (gerador):**
  - determinismo;
  - nenhuma data futura;
  - todos os rótulos existem em `DEFAULT_CATEGORIES`;
  - os plantados estão presentes;
  - as transferências estão balanceadas.
- **Integração (API de teste):** `runDemoSeed` com um cliente sobre `app.inject` cria a conta e, em seguida:
  - `/v1/review` tem "precisam de você";
  - `/v1/insights` traz `duplicate`, `anomaly` e `fees`;
  - `/v1/budgets` traz Lazer em `over`;
  - `/v1/goals` tem a meta;
  - `/v1/rule-suggestions` tem PADARIA SAO JOAO;
  - uma segunda execução devolve `{ created: false }`.
- **CI:** o job `demo`.

## Fora de escopo

Demo pública, exportar e excluir dados, LLM e README em inglês.
