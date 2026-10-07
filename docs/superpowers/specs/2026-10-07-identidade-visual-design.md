# Identidade visual do Finlens — "Fita métrica"

> Status: aprovado em 2026-10-07.

## Objetivo

Dar ao Finlens uma identidade própria de **instrumento de precisão**, aplicada às telas existentes (login, cadastro, área logada) e a uma landing pública que serve de vitrine para quem chega pelo LinkedIn. A base precisa sustentar o dashboard da F4 sem retrabalho.

Sucesso:

- Um visitante entende em poucos segundos o que o produto faz, vendo a classificação acontecer.
- Claro e escuro têm o mesmo cuidado; o tema segue o sistema e pode ser trocado.
- Nenhuma violação séria de acessibilidade (axe) em nenhuma página.
- Os fluxos de autenticação existentes continuam funcionando.

## Conceito

Materiais de instrumentos de medição: alumínio, grafite, trena. A **régua graduada** é o elemento-assinatura e o principal dispositivo de dados do produto. O amarelo de trena marca apenas medida (o ponto atual, o trecho medido), nunca é cor de botão ou decoração.

## Tokens

### Cor

| Token | Papel | Claro | Escuro |
|---|---|---|---|
| `page` | fundo | `#ECEFF1` | `#1A1F24` |
| `raised` | superfícies | `#F8F9FA` | `#22282E` |
| `ink` | texto principal, botão primário | `#15191D` | `#E6EAED` |
| `ink-soft` | texto de apoio | `#56616B` | `#9AA4AC` |
| `scale` | traços, bordas | `#B7C0C7` | `#3A434B` |
| `tape` | medida | `#F2C230` | `#F2C230` |
| `on-tape` | texto sobre `tape` | `#2B2205` | `#2B2205` |
| `mark` | acima do limite, erro | `#C93A2B` | `#F0705F` |
| `gain` | entrada de dinheiro | `#2E7D6B` | `#5FC2A8` |

Regras: vermelho/verde nunca são o único sinal (sempre com +/− ou texto). Botão primário usa `ink`.

### Tipografia

Uma família: **Archivo** (Google Fonts, variável, `wdth` 62–125, `wght` 100–900, suporta `tnum`).

- Números de destaque: `font-stretch: 80%`, peso 600, `font-variant-numeric: tabular-nums`.
- Interface e texto: largura 100%, pesos 400/500.
- Escala: 13 / 15 / 18 / 24 / 32 / 48 px. Linha de texto ≤ 72 caracteres.
- Sem rótulos em caixa alta e sem fonte monoespaçada para dados.

### Forma e movimento

- Raio: 6px em controles, 10px em painéis. Bordas de 1px em `scale`. Sem sombras.
- Foco: anel de 2px em `ink`, offset 2px.
- Movimento único: a régua mede da esquerda para a direita (400ms, ease-out) ao aparecer. Desligado com `prefers-reduced-motion`.

## Componentes (`apps/web/src/components/ui/`)

- **`Scale`** — régua graduada. Props: `value`, `max`, `limit?`, `ticks?` (padrão 10), `label`, `valueText`. Trecho até `min(value, limit ?? max)` em `tape`; o que passa do limite em `mark`. Marcador vertical no valor atual. `role="meter"` com `aria-valuemin/max/now` e `aria-valuetext`. Geometria calculada por `scaleGeometry()` (função pura).
- **`Figure`** — valor de destaque condensado e tabular com legenda.
- **`Button`** — `primary` | `secondary` | `ghost`; também renderiza como link.
- **`Field`** — rótulo, input, ajuda e erro; erro ligado via `aria-describedby` e `aria-invalid`.
- **`Panel`** — superfície `raised` com borda.
- **`Logo`** — palavra "finlens" em minúsculas com uma régua de 5 traços; o mesmo símbolo é o favicon (`app/icon.svg`).
- **`ThemeToggle`** — sistema / claro / escuro, persistido em `localStorage` (`finlens-theme`), aplicado como `data-theme` no `<html>` por script inline antes da pintura.

## Rotas e telas

| Rota | Sem sessão | Com sessão |
|---|---|---|
| `/` | landing | redireciona para `/painel` |
| `/login`, `/signup` | formulário | redireciona para `/painel` |
| `/painel` | redireciona para `/login` | área logada |

Login e cadastro bem-sucedidos levam a `/painel`. `/auth/clear-session` continua levando a `/login`.

- **Landing** — título "Importe o extrato. O Finlens mede para onde vai seu dinheiro."; demonstração com transações de exemplo (IFOOD*REST, UBER *TRIP, NETFLIX.COM, POSTO IPIRANGA, PAG*ACADEMIA, AMAZON BR) exibidas com estabelecimento, categoria e régua de confiança; três blocos (Classifica sozinho, Aprende com você, Mostra o problema e o impacto) com exemplos concretos; CTAs "Criar conta" e "Entrar"; rodapé com link para o GitHub e "Open source e self-hosted". Dados de exemplo fixos, sem chamada à API.
- **Login e cadastro** — formulário à esquerda; à direita (≥ 1024px) painel com uma régua de orçamento de exemplo e um insight de amostra. Textos e mensagens de erro atuais mantidos.
- **Área logada** — barra superior com `Logo`, mês corrente (texto), `ThemeToggle`, nome do workspace e "Sair". Conteúdo: "Olá, {nome}" e estado vazio "Importe seu primeiro extrato" com botão desabilitado e explicação "Disponível na próxima fase".

## Testes

- Unitários (Vitest) para `scaleGeometry` e `resolveTheme`.
- E2E (Playwright): fluxos atuais com rotas novas; landing visível sem sessão; `/` com sessão vai para `/painel`; tema persiste após recarregar.
- Acessibilidade: `@axe-core/playwright` em `/`, `/login`, `/signup` e `/painel`, nos dois temas, sem violações `serious` ou `critical`.
- Revisão visual por capturas de tela (claro/escuro, desktop/celular) antes da entrega.

## Fora de escopo

Dashboard com dados reais, seletor de mês funcional, importação, ilustrações.
