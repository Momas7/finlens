# F1b: Importação de extratos

> Status: aprovado em 2026-10-20. Só existe amostra real da fatura do cartão Inter (CSV). Presets do Mercado Pago e do extrato da conta Inter ficam para quando houver arquivo.

## Objetivo

Trazer lançamentos de um arquivo do banco para uma conta, com prévia antes de gravar, sem duplicar o que já existe e passando pela classificação normal.

## Fluxo (`/painel/importar`)

1. **Arquivo:** a pessoa escolhe a conta (ativa) e o arquivo (CSV ou OFX, até 5 MB).
2. **Prévia:** nada é gravado. Mostra "N lançamentos: X novos, Y já importados, Z já existem (lançados à mão), P pagamentos de fatura" e a lista das linhas novas; as repetidas ficam numa lista à parte.
3. **Importar X:** grava, e leva para a Revisão com a mensagem "X lançamentos importados."
- **CSV desconhecido:** a prévia pede o mapeamento: coluna de data, descrição e valor, formato da data (`dd/mm/aaaa`, `aaaa-mm-dd` ou `mm/dd/aaaa`), separador decimal (vírgula ou ponto) e se o gasto vem negativo ou positivo. O mapeamento vale só para aquele arquivo.
- **Arquivo já importado** (mesmo hash): erro "Este arquivo já foi importado.".

## Formatos (domínio puro, `packages/domain/src/import/`)

- **Texto:** a web decodifica o arquivo como UTF-8 e, se for inválido, como Windows-1252 (OFX antigo). BOM é removido. O servidor recebe texto.
- **Preset fatura Inter:** cabeçalho exato `Data, Lançamento, Categoria, Tipo, Valor`.
  - Data `dd/mm/aaaa`; valor `R$ 1.267,64` ou `-R$ 217,50`.
  - Valor positivo é gasto (saída); negativo é pagamento/estorno (entrada no cartão).
  - A coluna "Categoria" do banco é ignorada.
  - `Tipo` = `Parcela n/N` acrescenta ` PARC nn/NN` à descrição, para a detecção de parcelas existente funcionar.
- **OFX:** blocos `STMTTRN` com `DTPOSTED`, `TRNAMT` (ponto ou vírgula), `FITID`, `NAME`/`MEMO`. A descrição é `MEMO`, ou `NAME` quando não houver `MEMO`, ou os dois quando diferentes. O sinal do OFX é mantido.
- **CSV genérico:** delimitador detectado (`;`, `,` ou tab), aspas RFC 4180, mapeamento da pessoa.
- Linhas inválidas (data ou valor ilegíveis, valor zero) são ignoradas e contadas como "linhas ignoradas" na prévia.
- `parseImport(text, mapping?)` devolve `{ kind: 'rows', format, rows }`, `{ kind: 'needs_mapping', headers, sample }` ou `{ kind: 'error', message }`. Cada linha: `{ postedDate, description, amountCents (bigint, saída negativa), externalId }`.

## Dados

- **`import_batches`:** `id`, `workspace_id`, `account_id` (FK composta), `file_sha256`, `filename`, `format` (`ofx` | `csv`), `status` (`preview` | `committed`), `rows` (jsonb com as linhas lidas e a chave de cada uma), `created_at`, `committed_at`. Único `(workspace_id, file_sha256)` quando `status = 'committed'`. Prévias com mais de 24 h são apagadas a cada nova prévia. O arquivo bruto nunca é guardado.
- **`transactions.import_key`** (texto, nulo para lançamento manual) com `UNIQUE (workspace_id, import_key)` parcial; `source` ganha `import`.
- **Chave:** `sha256(conta | FITID)` no OFX; senão `sha256(conta | data | valor | descrição normalizada | ordem)`, onde ordem é a posição entre linhas idênticas do mesmo arquivo.
- **Já existe:** uma linha nova cuja conta, data e valor batem com um lançamento manual conta como "já existe" e não é importada (cada lançamento manual cobre uma linha).
- RLS `ENABLE` e `FORCE` na tabela nova.

## API

- `POST /v1/imports/preview { accountId, filename, content, mapping? }` (limite de corpo 5 MB; conta arquivada ou de outro workspace: 404/409 como nos lançamentos). Devolve `{ needsMapping: { headers, sample } }` ou `{ batchId, format, summary, rows }`, onde cada linha vem com `status` `new` | `imported` | `existing`.
- `POST /v1/imports/:id/commit` → `{ imported, skippedImported, skippedExisting }`. 404 se o lote não for do workspace, 409 se já importado. Em uma transação:
  - recalcula o status das linhas (a base pode ter mudado desde a prévia);
  - cada linha nova entra pelo mesmo caminho do lançamento manual: normalização, classificação em lote (`auto`), mês da fatura, ligação de transferência;
  - o lote vira `committed`.
- Processamento síncrono; sem worker.

## Tela

- Link "Importar" no cabeçalho de Lançamentos.
- Prévia com tabela acessível (data, descrição, valor), resumo em texto e botão "Importar X" desabilitado quando X = 0.
- Mapeamento como formulário com rótulos; erros de campo no padrão do app.

## Testes

- **Unitários:** dinheiro BR, CSV (aspas, BOM, delimitadores), preset Inter com arquivo sintético (parcelas, pagamento negativo, linha inválida), OFX (FITID, vírgula decimal, NAME/MEMO), mapeamento genérico, `needs_mapping`.
- **Integração:** prévia sem gravar nada; commit; arquivo repetido (409); reimportar com período sobreposto traz só as novas; duas linhas idênticas no mesmo dia; manual contra importado; lote de outro workspace (404); conta arquivada; classificação aplicada; pagamento da fatura ligado quando há par.
- **E2E:** fluxo completo com a fatura sintética e axe nos passos de prévia e mapeamento.
- Os arquivos reais em `fixtures/private/` nunca são commitados nem usados pelo CI.

## Fora de escopo

Worker/pg-boss, Open Finance, PDF, desfazer importação (excluir lançamento a lançamento continua valendo), mapeamento salvo, presets Mercado Pago e extrato Inter.
