# F6b: Exportar e excluir os próprios dados

> Status: aprovado em 2026-10-10.

## Objetivo

A pessoa leva todos os seus dados quando quiser e pode apagar a conta de forma definitiva.

## Página "Sua conta" (`/painel/conta`)

- Link "Sua conta" no cabeçalho, ao lado de "Sair".
- **Seção "Exportar seus dados":**
  - "Baixar tudo (JSON)" chama `GET /v1/me/export`;
  - "Baixar lançamentos (CSV)" chama `GET /v1/me/export.csv`.
- **Seção "Excluir conta":**
  - o texto avisa que a exclusão é permanente e sugere exportar antes;
  - campos "Senha atual" e "Digite EXCLUIR para confirmar";
  - botão "Excluir conta definitivamente", com confirmação do navegador.
- **Depois de excluir:** os cookies de sessão são limpos e a pessoa vai para `/`, onde aparece "Sua conta foi excluída.".

## Exportação

- **`GET /v1/me/export`** devolve `application/json` com `Content-Disposition: attachment; filename="finlens-AAAA-MM-DD.json"`. O conteúdo é:

  ```
  { format: 'finlens-export/1', exportedAt, user: { name, email }, workspace: { name },
    accounts, categories, transactions, classificationRules, ruleSuggestionDismissals,
    classificationFeedback, budgets, goals, insightStates }
  ```

  - Cada coleção traz as linhas da tabela correspondente, sem `workspace_id`.
  - Valores em centavos vão como string.
  - Nunca entram senha, hash, sessões, tokens nem as tabelas `account` e `verification` do auth.
- **`GET /v1/me/export.csv`** devolve `text/csv; charset=utf-8` com o nome `finlens-lancamentos-AAAA-MM-DD.csv`.
  - O arquivo começa com BOM.
  - Cabeçalho: `data;conta;descrição;valor;categoria;situação`.
  - **data:** `AAAA-MM-DD`.
  - **valor:** com sinal e vírgula decimal, sem separador de milhar (`-1234,56`).
  - **categoria:** "Raiz › Filha", ou vazio quando não houver.
  - **situação:** confirmada, automática, provável, sugestão ou sem categoria.
  - Campos com `;`, aspas ou quebra de linha vão entre aspas, com as aspas internas duplicadas.
  - Campos de texto que começam com `=`, `+`, `-`, `@`, tab ou CR recebem `'` na frente, para não virarem fórmula na planilha (as descrições de extrato vêm de terceiros).
  - Ordem: data e depois id.
- Tudo é lido sob RLS, na sessão da pessoa.

## Exclusão

**`POST /v1/me/delete { password, confirm }`:**

- `confirm` diferente de `"EXCLUIR"`: 400, com o campo `confirm`.
- Senha conferida contra o hash argon2 da conta `credential` da pessoa. Se estiver errada ou não houver conta `credential`: 400, com o campo `password` e a mensagem "Senha incorreta.".
- Com tudo certo, apaga a linha de `user`. A cascata leva sessões, contas do auth, o workspace pessoal e, a partir dele, todas as tabelas financeiras. Responde 204.
- Usa o limite de tentativas das rotas de autenticação.
- O log registra só `userId` e o evento.

## Testes

- **Unitários:** o formatador de CSV (escape, BOM, valor e situação).
- **Integração:**
  - o JSON completo traz os dados da pessoa e nada de outro usuário, sem campos de auth;
  - o CSV traz cabeçalho, BOM, `-45,90` e o escape;
  - exclusão com senha errada e com confirmação errada não apaga nada;
  - exclusão válida: nenhuma linha do workspace sobra em nenhuma tabela (conferido pelo role owner), o outro usuário fica intacto, o login falha e a sessão antiga recebe 401.
- **E2E:**
  - baixar os dois arquivos;
  - excluir a conta, ver a mensagem em `/` e o login falhar;
  - axe em `/painel/conta`, nos temas claro e escuro.

## Fora de escopo

Importar o JSON, período de carência e workspaces compartilhados.
