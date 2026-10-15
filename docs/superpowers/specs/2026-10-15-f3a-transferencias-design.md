# F3a: Transferências e pagamento de fatura

> Status: aprovado em 2026-10-15. F3b (recorrências) e F3c (parcelas) são fases à parte.

## Objetivo

Reconhecer quando dois lançamentos são as duas pontas da mesma movimentação de dinheiro (transferência entre contas ou pagamento de fatura), ligá-los e tirá-los de gasto e receita. Os óbvios se ligam sozinhos; os duvidosos viram sugestão na Revisão.

## Ligação

- `transactions.transfer_pair_id uuid` (nulo por padrão). As duas pontas de um par guardam o mesmo id; o par tem sempre exatamente dois lançamentos.
- Ligar define `category_id` = "Movimentação › Transferência entre contas" (`movement.transfer`) ou "Movimentação › Pagamento de fatura" (`movement.card_payment`), `classification_status = 'confirmed'`, fonte `user`, confiança 1, sem sugestão. Movimentação já fica fora de entradas e saídas (F4).
- Desligar zera o par nos dois lados e reclassifica os dois em modo automático.

## Regras do domínio (`packages/domain/src/transfers`)

`findTransferPairs({ candidates, accounts, dismissed }): { auto: TransferPair[]; suggested: TransferPair[] }`.

- **Elegíveis:** lançamentos sem par e não confirmados.
- **Par possível:** um de valor negativo e outro positivo, de valores absolutos iguais, em contas diferentes, com até 2 dias de diferença. Quando uma das contas é cartão de crédito, o lado do cartão tem de ser o positivo (o pagamento entra como crédito); dois cartões não formam par.
- **Tipo:** `card_payment` se uma das contas é cartão; senão `transfer`.
- **Menção:** a descrição normalizada de pelo menos uma ponta contém PIX, TED, DOC, TRANSF ou TRANSFERENCIA (transferência), ou FATURA ou PAGAMENTO FATURA (fatura), ou o nome normalizado da outra conta.
- **Liga sozinho (`auto`):** diferença de até 1 dia, há menção e o par é único (cada ponta tem exatamente uma contraparte possível).
- **Sugere (`suggested`):** os demais pares possíveis.
- Pares cuja chave (`idMenor:idMaior`) esteja em `dismissed` são ignorados.
- Cada par traz `a` (a saída), `b` (a entrada), `kind` e `reason` ("Valores iguais e opostos em 12/10, com PIX no texto." ou "Valores iguais e opostos em 12/10 e 14/10.").

## API

- **Criar ou editar um lançamento:** depois de gravar, roda a detecção com os lançamentos sem par, não confirmados, num intervalo de 2 dias e de mesmo valor absoluto, e liga os pares `auto` que incluem o lançamento. Lançamento criado com categoria escolhida fica confirmado e, portanto, nunca liga sozinho. Editar valor ou conta de um lançamento já ligado desfaz o par (as categorias ficam). Excluir um lançamento ligado limpa o par da outra ponta.
- `GET /v1/transfers/suggestions` devolve até 20 `{ id, kind, reason, a, b }` (os `suggested` e também os `auto` ainda sem ligação), sobre os lançamentos dos últimos 12 dias. `a` e `b` trazem `id`, `accountName`, `postedDate`, `amountCents` e `description`. O `id` são os 16 primeiros caracteres hexadecimais do sha1 da chave do par.
- `POST /v1/transfers/link { a, b }` liga o par (204). 404 para lançamento de outro workspace; 409 se for a mesma conta, se os valores não se anulam, se algum já tem par ou se a categoria de movimentação estiver indisponível.
- `POST /v1/transfers/dismiss { id }` grava a recusa e devolve 204 (id desconhecido também devolve 204).
- `POST /v1/transactions/:id/unlink` desfaz o par (204); 404 se não existir; 409 se não tiver par.
- `Transaction` ganha `transfer: { pairId, withAccount, kind } | null`.
- `Review.counts` ganha `transfers` (pares a confirmar).

## Dados

- Migração: `transactions.transfer_pair_id` e índice parcial em `(workspace_id, transfer_pair_id)` onde não é nulo.
- Tabela `transfer_dismissals` (`id`, `workspace_id`, `pair_key`, `created_at`, única por `(workspace_id, pair_key)`), com RLS ENABLE + FORCE em migração própria.

## Telas

- **Revisão:** seção "Transferências a confirmar" acima de "Precisam de você". Cada par mostra as duas pontas (data, conta, valor), o motivo e os botões "É transferência" e "Não é". O contador "Revisão" na navegação soma esses pares.
- **Lista de transações:** o par mostra o selo "Transferência com {conta}" (ou "Pagamento de fatura com {conta}").
- **Edição do lançamento:** "Desfazer transferência" quando há par.

## Demo

As transferências para a Reserva passam a nascer em modo automático com "PIX TRANSF" no texto, para a ligação automática acontecer de verdade.

## Testes

- **Unitários:** pares automáticos, em sugestão, ambíguos, de fatura, ignorados (confirmados, ligados, dispensados) e a razão em texto.
- **Integração:** ligação automática ao criar a segunda ponta (e os totais da Início não mudam); sugestões, link, dismiss e unlink; 404, 409 e isolamento entre usuários; RLS de `transfer_dismissals`.
- **E2E:** transferência vira selo nas duas pontas; sugestão aparece na Revisão com o contador, "É transferência" liga e "Não é" some; "Desfazer transferência"; axe na Revisão com pares, nos temas claro e escuro.

## Fora de escopo

Casar fatura pela soma, transferências entre moedas ou com tarifa embutida, recorrências (F3b) e parcelas (F3c).
