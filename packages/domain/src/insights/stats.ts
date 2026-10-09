const compare = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);

/** Mediana; com quantidade par, média dos dois do meio arredondada para baixo. */
export function median(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  const sorted = [...values].sort(compare);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as bigint)
    : ((sorted[mid - 1] as bigint) + (sorted[mid] as bigint)) / 2n;
}

/** z-score robusto (mediana e MAD × 1,4826); null quando o MAD é zero. */
export function robustZ(x: bigint, history: bigint[]): number | null {
  const med = median(history);
  const mad = median(history.map((v) => (v > med ? v - med : med - v)));
  if (mad === 0n) return null;
  return Number(x - med) / (1.4826 * Number(mad));
}
