export type ScaleGeometry = {
  /** Trecho medido até o limite (ou até o máximo, sem limite). */
  filledPct: number;
  /** Trecho que passou do limite, cortado no fim da régua. */
  overPct: number;
  /** Posição do marcador do valor atual. */
  markerPct: number;
  /** Posição do traço de limite; null quando não há limite. */
  limitPct: number | null;
  /** Posições dos traços da escala, de 0 a 100. */
  tickPcts: number[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPct = (n: number) => Math.min(100, Math.max(0, n));

/** Calcula, em percentuais da largura, onde desenhar cada parte da régua. */
export function scaleGeometry(input: {
  value: number;
  max: number;
  limit?: number;
  ticks?: number;
}): ScaleGeometry {
  const ticks = Math.max(1, Math.floor(input.ticks ?? 10));
  const tickPcts = Array.from({ length: ticks + 1 }, (_, i) => round2((i / ticks) * 100));
  const { value, max, limit } = input;

  if (!(max > 0) || !Number.isFinite(value)) {
    return { filledPct: 0, overPct: 0, markerPct: 0, limitPct: null, tickPcts };
  }

  const pct = (n: number) => round2(clampPct((n / max) * 100));
  const safeValue = Math.max(0, value);
  const hasLimit = limit !== undefined && Number.isFinite(limit) && limit >= 0;
  const limitPct = hasLimit ? pct(limit) : null;
  const filledPct = pct(Math.min(safeValue, hasLimit ? limit : max));
  const overPct =
    hasLimit && limitPct !== null && safeValue > limit
      ? round2(Math.min(pct(safeValue) - limitPct, 100 - limitPct))
      : 0;

  return { filledPct, overPct, markerPct: pct(safeValue), limitPct, tickPcts };
}
