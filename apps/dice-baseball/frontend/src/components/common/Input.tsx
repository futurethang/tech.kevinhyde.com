/**
 * Input Component - Text inputs and select dropdowns
 * v5 Topps design: zero radius, dark navy surface, gold focus ring
 */

import { type InputHTMLAttributes, type SelectHTMLAttributes, forwardRef, useId } from 'react';

// ============================================
// TEXT INPUT
// ============================================

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    const generatedId = useId();
    const inputId = props.id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-3 min-h-[48px]
            bg-[var(--color-surface-card)] border
            text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-[var(--color-topps-gold)] focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-[var(--color-card-red)]' : 'border-[var(--color-text-dim)] hover:border-[var(--color-text-muted)]'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-[var(--color-card-red)]">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================
// SELECT DROPDOWN
// ============================================

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    const generatedId = useId();
    const selectId = props.id || generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full px-4 py-3 min-h-[48px]
            bg-[var(--color-surface-card)] border
            text-[var(--color-text-primary)]
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-[var(--color-topps-gold)] focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            appearance-none cursor-pointer
            ${error ? 'border-[var(--color-card-red)]' : 'border-[var(--color-text-dim)] hover:border-[var(--color-text-muted)]'}
            ${className}
          `}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%238a8070' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.75rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.25rem 1.25rem',
            paddingRight: '2.5rem',
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1.5 text-sm text-[var(--color-card-red)]">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================
// SEARCH INPUT
// ============================================

interface SearchInputProps extends Omit<InputProps, 'type'> {
  onClear?: () => void;
}

export function SearchInput({ onClear, value, className = '', ...props }: SearchInputProps) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg
          className="h-5 w-5 text-[var(--color-text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <input
        type="search"
        value={value}
        className={`
          w-full pl-10 pr-10 py-3 min-h-[48px]
          bg-[var(--color-surface-card)] border border-[var(--color-text-dim)]
          text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
          transition-colors duration-200
          hover:border-[var(--color-text-muted)]
          focus:outline-none focus:ring-2 focus:ring-[var(--color-topps-gold)] focus:border-transparent
          ${className}
        `}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
