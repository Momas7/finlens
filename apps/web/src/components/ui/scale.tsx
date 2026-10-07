import { scaleGeometry } from '@/lib/scale-geometry';

type ScaleProps = {
  value: number;
  max: number;
  limit?: number;
  ticks?: number;
  /** Nome acessível da medida (ex.: "Orçamento de alimentação"). */
  label: string;
  /** Leitura acessível do valor (ex.: "R$ 612 de R$ 750"). */
  valueText: string;
  className?: string;
};

/** Régua graduada: elemento-assinatura do Finlens para qualquer medida em relação a um limite. */
export function Scale({ value, max, limit, ticks, label, valueText, className = '' }: ScaleProps) {
  const g = scaleGeometry({ value, max, limit, ticks });
  return (
    // biome-ignore lint/a11y/useSemanticElements: <meter> nativo não aceita a régua desenhada; role=meter mantém a semântica
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={g.axisMax || max}
      aria-valuenow={Number.isFinite(value) ? Math.min(Math.max(value, 0), g.axisMax || max) : 0}
      aria-valuetext={valueText}
      className={`relative h-4 w-full ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-3 border-b border-scale" aria-hidden="true" />
      <div
        className="scale-measure absolute top-0 left-0 h-3"
        style={{ width: `${g.filledPct + g.overPct}%` }}
        aria-hidden="true"
      >
        <span
          className="absolute inset-y-0 left-0 bg-tape"
          style={{ width: `${(g.filledPct / Math.max(g.filledPct + g.overPct, 0.01)) * 100}%` }}
        />
        {g.overPct > 0 && (
          <span
            className="absolute inset-y-0 right-0 bg-mark"
            style={{ width: `${(g.overPct / (g.filledPct + g.overPct)) * 100}%` }}
          />
        )}
      </div>
      <div className="absolute inset-x-0 top-0 h-3" aria-hidden="true">
        {g.tickPcts.map((pct, i) => (
          <span
            key={pct}
            className={`absolute bottom-0 w-px bg-scale ${i % 5 === 0 ? 'h-3' : 'h-1.5'}`}
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>
      {g.filledPct > 0 && (
        // Traços repetidos sobre o trecho medido, em cor que contrasta com a fita.
        <div
          className="scale-measure absolute top-0 left-0 h-3 overflow-hidden"
          style={{ width: `${g.filledPct}%` }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{ width: `${(100 / g.filledPct) * 100}%` }}
          >
            {g.tickPcts.map((pct, i) => (
              <span
                key={pct}
                className={`absolute bottom-0 w-px bg-tape-tick ${i % 5 === 0 ? 'h-3' : 'h-1.5'}`}
                style={{ left: `${pct}%` }}
              />
            ))}
          </div>
        </div>
      )}
      {g.limitPct !== null && (
        <span
          className="absolute -top-1 h-5 w-0.5 bg-ink"
          style={{ left: `${g.limitPct}%` }}
          aria-hidden="true"
        />
      )}
      <span
        className="absolute -top-0.5 h-4 w-0.5 -translate-x-1/2 bg-ink"
        style={{ left: `clamp(1px, ${g.markerPct}%, calc(100% - 1px))` }}
        aria-hidden="true"
      />
    </div>
  );
}
