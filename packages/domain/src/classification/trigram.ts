/** Trigramas como o pg_trgm: por palavra alfanumérica, minúscula, com "  " antes e " " depois. */
function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (const word of text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

/** Mesma medida de `similarity()` do pg_trgm: |A ∩ B| / |A ∪ B|. */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / (ta.size + tb.size - common);
}
