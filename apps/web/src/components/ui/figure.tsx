type FigureProps = {
  value: string;
  caption: string;
  size?: 'md' | 'lg';
  className?: string;
};

/** Valor de destaque condensado e tabular, com legenda. */
export function Figure({ value, caption, size = 'md', className = '' }: FigureProps) {
  return (
    <div className={className}>
      <p className={`figure ${size === 'lg' ? 'text-[48px]' : 'text-[32px]'}`}>{value}</p>
      <p className="mt-1 text-[13px] text-ink-soft">{caption}</p>
    </div>
  );
}
