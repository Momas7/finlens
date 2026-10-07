# F2b — Caixa de revisão, propagação de correções e regras sugeridas

> Status: aprovado em 2026-10-08. LLM fica fora (decisão: reavaliar depois da importação real).

## Objetivo

Reduzir o trabalho manual de classificação: revisar de uma vez os lançamentos com dúvida, levar uma correção para os lançamentos parecidos e transformar padrões confirmados em regras.

Sucesso:

- `/painel/revisao` mostra os lançamentos com dúvida agrupados e confirma um grupo inteiro com um clique.
- Depois de corrigir um lançamento, o sistema oferece aplicar a mesma categoria aos parecidos ainda não confirmados.
- Depois de 3 confirmações consistentes, o sistema propõe uma regra; aceitar cria a regra, dispensar não volta a propor.
- Lançamento confirmado nunca é alterado por nenhuma dessas ações sem a pessoa escolher.

## Conceitos

- **Chave de agrupamento:** `merchant_key` quando existe; senão `description_normalized`. Sempre combinada com o sinal do valor (`out` para saídas, `in` para entradas).
- **Pendente:** lançamento com `classification_status` em `suggested` ou `none` (precisa de você) ou `likely` (provável).
- **Faixas de valor:** as da F2a — `xs` < R$ 50, `sm` < R$ 200, `md` < R$ 1.000, `lg` ≥ R$ 1.000.

## Caixa de revisão

`GET /v1/review` devolve `{ needsYou: ReviewGroup[], likely: ReviewGroup[], counts: { needsYou, likely } }`, calculado na hora.

`ReviewGroup`: `{ key, sign, label, count, totalCents, suggestedCategoryId, confidence, transactionIds, latestDate }`, onde:

- `label` é o nome do estabelecimento (do dicionário) ou a descrição normalizada mais frequente do grupo;
- `suggestedCategoryId` é a categoria sugerida mais comum no grupo (para `likely`, a categoria aplicada mais comum); `null` se não houver;
- `confidence` é a maior confiança entre os lançamentos com essa sugestão;
- `transactionIds` são até 200 ids, os mais recentes primeiro.

Ordem: mais lançamentos primeiro, depois maior `|totalCents|`. No máximo 100 grupos por lista.

Tela `/painel/revisao` (item "Revisão" na navegação com o número de "precisam de você"):

- Seção "Regras sugeridas" (quando houver).
- Seção "Precisam de você": cada grupo com rótulo, quantidade, total, sugestão com régua e percentual, seletor de categoria pré-preenchido, botão "Confirmar N" e link "Ver lançamentos" (lista filtrada pela busca).
- Seção "Prováveis", no mesmo formato.
- Estado vazio: "Tudo revisado. Novos lançamentos com dúvida aparecem aqui."

Confirmar um grupo usa a confirmação em lote; depois disso, a tela oferece a propagação para o primeiro lançamento do grupo.

## Confirmação em lote

`POST /v1/transactions/confirm` `{ ids: uuid[1..200], categoryId: uuid }`:

- todos os ids precisam existir no workspace; algum ausente → 404 e nada muda;
- a categoria precisa estar ativa e combinar com o sinal de cada lançamento (despesa para saída, receita para entrada, movimentação para ambos); conflito → 409 e nada muda;
- cada lançamento vira `confirmed`, `source = user`, confiança 1, sem sugestão; um `classification_feedback` por lançamento com a previsão do motor naquele momento;
- lançamentos já confirmados na mesma categoria são ignorados (sem feedback repetido); confirmados em outra categoria também são alterados, porque a pessoa escolheu explicitamente.

Resposta: `{ confirmed: number }`.

## Propagação

`GET /v1/transactions/:id/similar?categoryId=` devolve até 50 lançamentos, os mais recentes primeiro, que:

- não estão `confirmed`;
- têm o mesmo sinal que o lançamento de referência;
- não estão já na `categoryId`;
- têm a mesma chave **ou** similaridade trigram ≥ 0,60 com a descrição normalizada de referência;
- excluem o próprio lançamento.

Cada item: `{ transaction, currentCategoryLabel, preselected }`. `preselected` é falso quando o histórico confirmado da chave mostra categorias diferentes por faixa e o item está em faixa diferente da referência ("valor diferente do que você corrigiu"); verdadeiro nos demais casos.

Tela `/painel/transacoes/[id]/semelhantes?categoria=<uuid>`: lista com checkboxes (pré-seleção conforme `preselected`), "Aplicar aos selecionados" (confirmação em lote) e "Agora não". Sem semelhantes, redireciona para a lista. O formulário de edição leva para essa tela quando a pessoa salva uma categoria escolhida diferente da anterior; a revisão leva para ela depois de confirmar um grupo.

## Regras sugeridas

Domínio puro (`packages/domain/src/classification/suggest-rules.ts`):

- `commonWordPrefix(texts)`: maior sequência de palavras iniciais em comum.
- `suggestRule(confirmations, existingRules)`: para uma chave com confirmações `{ normalized, categoryId, bucket, amountCents }`:
  1. exige ≥ 3 confirmações;
  2. padrão: entre as descrições, pega a primeira palavra mais frequente, filtra as que começam por ela e calcula o prefixo comum; padrão com menos de 3 caracteres → sem sugestão;
  3. se todas as confirmações têm a mesma categoria → regra sem faixa;
  4. senão, procura a maior sequência contínua de faixas (`xs`→`lg`) em que todas as confirmações têm a mesma categoria e somam ≥ 3; existindo, regra com `minAmountCents` = início da primeira faixa e `maxAmountCents` = fim da última (nulo para `lg`);
  5. sem sugestão se uma regra existente com a mesma categoria já casa o padrão.

`GET /v1/rule-suggestions` devolve até 10 `{ id, pattern, categoryId, categoryLabel, minAmountCents, maxAmountCents, basedOn }`, sem as dispensadas; `id` é estável (`hash(chave|sinal|categoria|faixa)`).

`POST /v1/rule-suggestions/dismiss` `{ id }` grava em `rule_suggestion_dismissals` (`workspace_id`, `suggestion_id`, `created_at`; RLS no padrão do ADR 0002; único por workspace e id).

Na tela: "Sempre classificar **AMAZON** acima de R$ 200,00 como **Compras › Casa e decoração**? Baseado em 4 confirmações suas." com "Criar regra" (usa `POST /v1/classification-rules`) e "Dispensar".

## Testes

- Unitários: `commonWordPrefix`, `suggestRule` (consistente, por faixa, sem prefixo, regra existente, menos de 3).
- Integração: agrupamento (chave, sinal, ordem, contadores, `likely` separado); confirmação em lote (feedback, ignora confirmados iguais, 404 com id de outro usuário sem alterar nada, 409 por tipo de categoria); semelhantes (chave, trigram ≥ 0,60, sinal, confirmados fora, pré-seleção por faixa); sugestões e dispensa; RLS da tabela nova.
- E2E: confirmar grupo e ver o contador baixar; corrigir e aplicar a parecidos; regra sugerida após 3 confirmações e criar; dispensar; axe em `/painel/revisao` e na tela de semelhantes.

## Fora de escopo

LLM, edição em massa na lista, desfazer confirmação em lote.
