import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-foreground text-background hover:opacity-90',
  ghost: 'border border-border bg-transparent hover:bg-muted',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
