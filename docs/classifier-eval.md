# Avaliação do classificador

> Gerado por `pnpm eval:classifier` em 2026-10-07. Dataset sintético de 301 lançamentos (`tools/classifier-eval/src/dataset.ts`); depois de cada classificação, a simulação confirma a categoria correta, como um usuário faria.

## Resumo

- Aplicados automaticamente: **85,4%**, com precisão de **99,6%**.
- Prováveis (aplicados e marcados): 5,6%, precisão de 94,1%.
- Só sugeridos ou sem sugestão: 9,0%.
- Acerto nas primeiras 100 contra as últimas 100: 90,0% → 99,0%.

## Por status

| Status | Lançamentos | Parte |
|---|---|---|
| Automático (≥ 0,90) | 257 | 85,4% |
| Provável (0,70–0,90) | 17 | 5,6% |
| Sugestão (< 0,70) | 19 | 6,3% |
| Sem sugestão | 8 | 2,7% |

## Precisão por fonte (automáticos e prováveis)

| Fonte | Lançamentos | Precisão |
|---|---|---|
| history | 178 | 99,4% |
| merchant | 76 | 98,7% |
| keyword | 15 | 100,0% |
| similar | 5 | 100,0% |

## Calibração

Confiança prometida contra acerto real.

| Confiança | Lançamentos | Acerto |
|---|---|---|
| 0,70–0,80 | 4 | 100,0% |
| 0,80–0,90 | 13 | 92,3% |
| 0,90–0,95 | 23 | 95,7% |
| 0,95–1,00 | 234 | 100,0% |
