/** Marca: "finlens" com uma régua de cinco traços; o do meio, mais alto, é a medida. */
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <rect x="2" y="9" width="2" height="9" fill="currentColor" />
      <rect x="6" y="12" width="2" height="6" fill="currentColor" />
      <rect x="9" y="2" width="2.5" height="16" fill="var(--tape)" />
      <rect x="13" y="12" width="2" height="6" fill="currentColor" />
      <rect x="16" y="9" width="2" height="9" fill="currentColor" />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink" role="img" aria-label="Finlens">
      <LogoMark size={size === 'sm' ? 16 : 20} />
      <span
        aria-hidden="true"
        className={`font-semibold tracking-tight ${size === 'sm' ? 'text-[16px]' : 'text-[20px]'}`}
        style={{ fontStretch: '85%' }}
      >
        finlens
      </span>
    </span>
  );
}
