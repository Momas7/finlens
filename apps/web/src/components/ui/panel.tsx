import type { HTMLAttributes } from 'react';

type PanelProps = HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'aside' };

export function Panel({ as: Tag = 'div', className = '', ...props }: PanelProps) {
  return <Tag className={`rounded-[10px] border border-scale bg-raised ${className}`} {...props} />;
}
