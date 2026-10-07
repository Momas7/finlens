import type { Candidate, Source } from './layers';

const SOURCE_LABEL: Record<Source, string> = {
  rule: 'regra',
  history: 'seu histórico',
  similar: 'lançamentos parecidos',
  merchant: 'dicionário de estabelecimentos',
  keyword: 'palavra-chave',
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function explain(decisive: Candidate, others: Source[]): string {
  const d = decisive.detail;
  let text: string;
  switch (decisive.source) {
    case 'rule':
      text = `Regra: descrição contém "${d.pattern}".`;
      break;
    case 'history': {
      const n = d.count ?? 0;
      text = `Você classificou ${d.merchantName} como ${d.categoryName} ${n} ${plural(n, 'vez', 'vezes')}.`;
      break;
    }
    case 'similar': {
      const k = d.neighbors ?? 0;
      text = `Parecido com ${k} ${plural(k, 'lançamento seu', 'lançamentos seus')} em ${d.categoryName}.`;
      break;
    }
    case 'merchant':
      text = `${d.merchantName} costuma ser ${d.categoryName}.`;
      break;
    case 'keyword':
      text = `A descrição contém ${d.keyword}.`;
      break;
  }
  const confirmations = [...new Set(others)].filter((s) => s !== decisive.source);
  return confirmations.length > 0
    ? `${text} Confirmado por ${confirmations.map((s) => SOURCE_LABEL[s]).join(' e ')}.`
    : text;
}
