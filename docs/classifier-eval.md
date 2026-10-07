# Avaliação do classificador

> Gerado por `pnpm eval:classifier` em 2026-10-07. Dataset sintético de 301 lançamentos (`tools/classifier-eval/src/dataset.ts`); depois de cada classificação, a simulação confirma a categoria correta, como um usuário faria.

## Resumo

- Aplicados automaticamente: **77,4%**, com precisão de **98,7%**.
- Prováveis (aplicados e marcados): 17,3%, precisão de 96,2%.
- Só sugeridos ou sem sugestão: 5,3%.
- Acerto nas primeiras 100 contra as últimas 100: 90,0% → 98,0%.

## Por status

| Status | Lançamentos | Parte |
|---|---|---|
| Automático (≥ 0,90) | 233 | 77,4% |
| Provável (0,70–0,90) | 52 | 17,3% |
| Sugestão (< 0,70) | 8 | 2,7% |
| Sem sugestão | 8 | 2,7% |

## Precisão por fonte (automáticos e prováveis)

| Fonte | Lançamentos | Precisão |
|---|---|---|
| history | 245 | 99,2% |
| merchant | 24 | 95,8% |
| similar | 9 | 77,8% |
| keyword | 7 | 100,0% |

## Calibração

Confiança prometida contra acerto real.

| Confiança | Lançamentos | Acerto |
|---|---|---|
| 0,70–0,80 | 8 | 100,0% |
| 0,80–0,90 | 44 | 95,5% |
| 0,90–0,95 | 38 | 92,1% |
| 0,95–1,00 | 195 | 100,0% |
