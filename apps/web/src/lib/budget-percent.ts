/** Percentual do limite, arredondado para baixo: 99,6% não pode aparecer como 100%. */
export function budgetPercent(share: number | null): number {
  return Math.floor((share ?? 0) * 100);
}
