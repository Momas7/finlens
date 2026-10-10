/** PRNG determinístico (mulberry32): a demo sai igual em toda execução. */
export function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** Inteiro em [min, max]. */
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  return { next, int };
}
