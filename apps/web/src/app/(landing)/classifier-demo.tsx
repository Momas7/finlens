import type { CSSProperties } from 'react';
import { Panel } from '@/components/ui/panel';
import { Scale } from '@/components/ui/scale';

type DemoRow = {
  raw: string;
  merchant: string;
  category: string;
  confidence: number;
};

// Dados fixos de exemplo: a landing não chama a API.
const ROWS: DemoRow[] = [
  { raw: 'IFOOD*REST', merchant: 'iFood', category: 'Alimentação › Delivery', confidence: 96 },
  {
    raw: 'UBER *TRIP',
    merchant: 'Uber',
    category: 'Transporte › App de transporte',
    confidence: 98,
  },
  { raw: 'NETFLIX.COM', merchant: 'Netflix', category: 'Assinaturas › Streaming', confidence: 99 },
  {
    raw: 'POSTO IPIRANGA',
    merchant: 'Posto Ipiranga',
    category: 'Transporte › Combustível',
    confidence: 91,
  },
  { raw: 'PAG*ACADEMIA', merchant: 'Academia', category: 'Saúde › Academia', confidence: 74 },
  { raw: 'AMAZON BR', merchant: 'Amazon', category: 'Compras › Outros', confidence: 58 },
];

const NEEDS_REVIEW_BELOW = 70;

export function ClassifierDemo() {
  const automatic = ROWS.filter((r) => r.confidence >= NEEDS_REVIEW_BELOW).length;
  return (
    <Panel as="section" aria-labelledby="demo-title" className="overflow-hidden">
      <div className="flex items-baseline justify-between gap-4 border-b border-scale px-5 py-4">
        <h2 id="demo-title" className="font-medium">
          Extrato importado
        </h2>
        <p className="text-right text-[13px] text-ink-soft">Confiança</p>
      </div>
      <ul>
        {ROWS.map((row, i) => {
          const review = row.confidence < NEEDS_REVIEW_BELOW;
          return (
            <li
              key={row.raw}
              className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-5 gap-y-1 border-b border-scale px-5 py-3.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_9rem]"
              style={{ '--measure-delay': `${i * 120}ms` } as CSSProperties}
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] text-ink-soft">{row.raw}</p>
                <p className="font-medium">
                  {row.merchant}
                  <span className="block font-normal text-ink-soft sm:inline">
                    <span className="hidden sm:inline"> em </span>
                    {row.category}
                  </span>
                </p>
                {review && <p className="text-[13px] text-ink">Pede sua confirmação</p>}
              </div>
              <div>
                <p className="figure text-right text-[18px]">{row.confidence}%</p>
                <Scale
                  className="mt-1"
                  value={row.confidence}
                  max={100}
                  ticks={10}
                  label={`${row.raw}: confiança da classificação`}
                  valueText={`${row.confidence}%${review ? ', pede confirmação' : ''}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-scale bg-page/60 px-5 py-3 text-[13px] text-ink-soft">
        {automatic} classificadas sozinhas, {ROWS.length - automatic} pede sua confirmação.
      </p>
    </Panel>
  );
}
