import { type SelectHTMLAttributes, useId } from 'react';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  error?: string;
};

export function Select({ label, name, error, className = '', children, ...props }: SelectProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        name={name}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className="h-11 w-full rounded-[6px] border border-scale bg-raised px-3 text-[15px] text-ink aria-invalid:border-mark"
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-[13px] text-mark">
          {error}
        </p>
      )}
    </div>
  );
}
