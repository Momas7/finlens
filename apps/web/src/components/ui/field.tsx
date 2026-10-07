import { type InputHTMLAttributes, useId } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
};

/** Rótulo, input, ajuda e erro como uma unidade acessível. */
export function Field({ label, name, hint, error, className = '', ...props }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className="h-11 w-full rounded-[6px] border border-scale bg-raised px-3 text-[15px] text-ink outline-none placeholder:text-ink-soft focus-visible:border-ink aria-invalid:border-mark"
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-[13px] text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[13px] text-mark">
          {error}
        </p>
      )}
    </div>
  );
}
