# LLM opcional

> Status: aprovado em 2026-10-20. Desligado por padrão; só roda quando a pessoa clica.

## Objetivo

Ajudar com descrições que nenhuma camada do classificador reconhece, com um modelo local, sem custo e sem enviar dados identificáveis. O LLM sugere; a pessoa confirma.

## Configuração

- `LLM_BASE_URL` (ex.: `http://localhost:11434/v1`), `LLM_MODEL` (ex.: `qwen2.5:3b`), `LLM_API_KEY` (opcional). Qualquer servidor compatível com `/chat/completions` do OpenAI (Ollama, llama.cpp, LM Studio).
- Sem `LLM_BASE_URL` o recurso está desligado: `GET /v1/llm/status` devolve `{ enabled: false }`, a rota de sugestão devolve 404 e o botão não aparece.

## Privacidade

- Sai apenas: a descrição normalizada (sem números longos, cidade, UF, datas nem contraparte de PIX), o sinal (saída ou entrada) e os nomes das categorias do tipo certo.
- Nunca saem valor, data, conta, nomes de pessoas nem ids.
- O README avisa que, com um servidor remoto, o texto sai da máquina.

## Domínio (`packages/domain/src/llm/`)

- `buildLlmPrompt(normalized, sign, categoryNames): { system, user }`: instrui a responder só JSON `{"category":"<nome exato>","confidence":0..1}` ou `{"category":null}`.
- `parseLlmAnswer(text, categoryNames): { category: string; confidence: number } | null`: aceita JSON puro ou dentro de texto; descarta categoria fora da lista, JSON quebrado e confiança fora de 0–1; a confiança é limitada a 0,80.
- `LLM_MAX_CONFIDENCE = 0.8`.

## API

- `GET /v1/llm/status` → `{ enabled }`.
- `POST /v1/llm/suggest { transactionId }`:
  - 404 se o recurso estiver desligado ou o lançamento não existir no workspace;
  - o servidor lê a descrição normalizada do lançamento e o sinal (nada de texto livre vindo do cliente) e monta o prompt com as categorias ativas do tipo certo (despesa para saída, receita para entrada; movimentação nunca);
  - chama o servidor do LLM com limite de 15 s e `temperature` 0;
  - responde `{ categoryId, label, confidence, explanation }` ou `{ categoryId: null }` quando a resposta for inválida, demorar ou falhar (sem erro para o usuário);
  - cache em memória por descrição normalizada e sinal, por 24 h;
  - limite de 20 chamadas por minuto por IP (mesmo mecanismo das rotas de autenticação);
  - a sugestão não grava nada.

## Tela (Revisão)

- Em "Precisam de você", o grupo sem sugestão ganha "Sugerir com IA" (só com o recurso ligado).
- Ao clicar, o seletor é preenchido com a categoria sugerida e aparece "Sugestão da IA local (confiança 70%). Revise antes de confirmar." Sem sugestão: "A IA local não encontrou uma categoria."
- Nada é gravado até "Confirmar", que segue o fluxo normal.

## Testes

- **Unitários:** prompt (sem valor nem dado pessoal), parser (válido, dentro de texto, categoria inexistente, confiança fora da faixa, lixo) e o teto de 0,80.
- **Integração:** servidor HTTP falso faz de LLM: sugestão válida, categoria fora da lista, resposta quebrada, timeout, desligado (404), cache, e o prompt recebido não tem valor nem data.
- **E2E:** com o servidor falso, o botão aparece, preenche o seletor e a pessoa confirma; axe na Revisão com o botão.

## Fora de escopo

Classificar sozinho ao salvar, jobs em lote, fine-tuning, embeddings, provedores pagos.
