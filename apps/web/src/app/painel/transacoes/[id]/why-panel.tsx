import type { Transaction } from '@finlens/contracts';
import { Panel } from '@/components/ui/panel';
import { Scale } from '@/components/ui/scale';
import { RuleButton } from './rule-button';

const SOURCE: Record<NonNullable<Transaction['classificationSource']>, string> = {
  rule: 'Sua regra',
  history: 'Seu histórico',
  similar: 'Lançamentos parecidos',
  merchant: 'Dicionário de estabelecimentos',
  keyword: 'Palavra-chave na descrição',
  user: 'Você',
};

/** Explica de onde veio a categoria e oferece transformar a decisão em regra. */
export function WhyPanel({
  transaction,
  categoryLabel,
}: {
  transaction: Transaction;
  categoryLabel: string | null;
}) {
  const confirmed = transaction.classificationStatus === 'confirmed';
  const target = transaction.categoryId ?? transaction.suggestedCategoryId;
  if (!target || !categoryLabel) return null;
  const percent = Math.round((transaction.classificationConfidence ?? 0) * 100);
  return (
    <Panel as="section" aria-labelledby="why-title" className="max-w-xl p-5">
      <h2 id="why-title" className="font-semibold">
        Por que esta categoria?
      </h2>
      <p className="mt-1 text-[15px]">{categoryLabel}</p>
      {confirmed ? (
        <p className="mt-2 text-[13px] text-ink-soft">Você escolheu esta categoria.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <Scale
              className="max-w-[14rem]"
              value={percent}
              max={100}
              ticks={10}
              label="Confiança da classificação"
              valueText={`${percent}%`}
            />
            <span className="figure text-[15px]">{percent}%</span>
          </div>
          {transaction.classificationExplanation && (
            <p className="text-[13px]">{transaction.classificationExplanation}</p>
          )}
          {transaction.classificationSource && (
            <p className="text-[13px] text-ink-soft">
              Fonte: {SOURCE[transaction.classificationSource]}
            </p>
          )}
        </div>
      )}
      <div className="mt-4">
        <RuleButton transactionId={transaction.id} />
      </div>
    </Panel>
  );
}
