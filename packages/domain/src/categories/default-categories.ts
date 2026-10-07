export type CategoryKind = 'expense' | 'income' | 'movement';

export type DefaultCategory = {
  key: string;
  name: string;
  kind: CategoryKind;
  parentKey?: string;
};

type Group = { key: string; name: string; kind: CategoryKind; children: [string, string][] };

// Taxonomia padrão (docs/architecture.md §10). As chaves ligam ao dicionário global de
// estabelecimentos da F2 e não mudam quando o usuário renomeia a categoria.
const GROUPS: Group[] = [
  {
    key: 'food',
    name: 'Alimentação',
    kind: 'expense',
    children: [
      ['groceries', 'Mercado'],
      ['restaurants', 'Restaurante'],
      ['delivery', 'Delivery'],
      ['snacks', 'Lanches e café'],
      ['bakery', 'Padaria'],
    ],
  },
  {
    key: 'transport',
    name: 'Transporte',
    kind: 'expense',
    children: [
      ['fuel', 'Combustível'],
      ['ride_hailing', 'App de transporte'],
      ['public', 'Transporte público'],
      ['parking_tolls', 'Estacionamento e pedágio'],
      ['maintenance', 'Manutenção'],
      ['insurance_taxes', 'Seguro e IPVA'],
    ],
  },
  {
    key: 'housing',
    name: 'Moradia',
    kind: 'expense',
    children: [
      ['rent', 'Aluguel e financiamento'],
      ['condo', 'Condomínio'],
      ['electricity', 'Energia'],
      ['water', 'Água'],
      ['gas', 'Gás'],
      ['internet_phone', 'Internet e telefone'],
      ['maintenance', 'Manutenção da casa'],
    ],
  },
  {
    key: 'health',
    name: 'Saúde',
    kind: 'expense',
    children: [
      ['gym', 'Academia'],
      ['pharmacy', 'Farmácia'],
      ['appointments', 'Consultas e exames'],
      ['insurance', 'Plano de saúde'],
    ],
  },
  {
    key: 'leisure',
    name: 'Lazer',
    kind: 'expense',
    children: [
      ['games', 'Jogos'],
      ['events', 'Cinema e eventos'],
      ['travel', 'Viagens'],
      ['bars', 'Bares'],
      ['hobbies', 'Hobbies'],
    ],
  },
  {
    key: 'subscriptions',
    name: 'Assinaturas',
    kind: 'expense',
    children: [
      ['streaming', 'Streaming de vídeo'],
      ['music', 'Música'],
      ['software', 'Software e nuvem'],
      ['other', 'Outras assinaturas'],
    ],
  },
  {
    key: 'shopping',
    name: 'Compras',
    kind: 'expense',
    children: [
      ['electronics', 'Eletrônicos'],
      ['clothing', 'Roupas'],
      ['home', 'Casa e decoração'],
      ['gifts', 'Presentes'],
      ['other', 'Outras compras'],
    ],
  },
  {
    key: 'education',
    name: 'Educação',
    kind: 'expense',
    children: [
      ['courses', 'Cursos'],
      ['books', 'Livros'],
      ['tuition', 'Mensalidade'],
    ],
  },
  {
    key: 'personal',
    name: 'Pessoal',
    kind: 'expense',
    children: [
      ['care', 'Cuidados pessoais'],
      ['services', 'Serviços'],
    ],
  },
  { key: 'pets', name: 'Pets', kind: 'expense', children: [] },
  {
    key: 'financial',
    name: 'Financeiro',
    kind: 'expense',
    children: [
      ['fees', 'Tarifas'],
      ['interest', 'Juros'],
      ['iof', 'IOF'],
      ['taxes', 'Impostos'],
      ['insurance', 'Seguros'],
    ],
  },
  {
    key: 'income',
    name: 'Receitas',
    kind: 'income',
    children: [
      ['salary', 'Salário'],
      ['freelance', 'Freelance'],
      ['yield', 'Rendimentos'],
      ['refunds', 'Reembolsos'],
      ['other', 'Outras receitas'],
    ],
  },
  {
    key: 'movement',
    name: 'Movimentação',
    kind: 'movement',
    children: [
      ['transfer', 'Transferência entre contas'],
      ['card_payment', 'Pagamento de fatura'],
      ['investment', 'Aplicação e resgate'],
    ],
  },
];

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = GROUPS.flatMap((group) => [
  { key: group.key, name: group.name, kind: group.kind },
  ...group.children.map(([child, name]) => ({
    key: `${group.key}.${child}`,
    name,
    kind: group.kind,
    parentKey: group.key,
  })),
]);
