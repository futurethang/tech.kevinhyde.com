/**
 * Button Component - Primary, secondary, danger, ghost, and roll variants
 * v5 Topps design: zero radius, hard offset shadows, token colors
 */

import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'roll';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-[transform,box-shadow] duration-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-surface-page)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0';

  const variantStyles = {
    primary:
      'bg-[var(--color-stadium-green)] text-white border border-black shadow-[3px_3px_0_var(--color-stadium-green-shadow)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_var(--color-stadium-green-shadow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[0px_0px_0_var(--color-stadium-green-shadow)] focus:ring-[var(--color-topps-gold)] font-display uppercase tracking-wider',
    secondary:
      'bg-transparent border-2 border-[var(--color-topps-gold)] text-[var(--color-topps-gold)] shadow-[3px_3px_0_var(--color-topps-gold-shadow)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_var(--color-topps-gold-shadow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[0px_0px_0_var(--color-topps-gold-shadow)] focus:ring-[var(--color-topps-gold)] font-display uppercase tracking-wider',
    danger:
      'bg-[var(--color-card-red)] text-white border border-black shadow-[3px_3px_0_var(--color-card-red-shadow)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0_var(--color-card-red-shadow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[0px_0px_0_var(--color-card-red-shadow)] focus:ring-[var(--color-topps-gold)] font-display uppercase tracking-wider',
    ghost:
      'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] focus:ring-[var(--color-topps-gold)]',
    roll:
      'bg-[var(--color-topps-gold)] text-[var(--color-surface-page)] border border-black shadow-[5px_5px_0_var(--color-topps-gold-shadow)] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[6px_6px_0_var(--color-topps-gold-shadow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[0px_0px_0_var(--color-topps-gold-shadow)] focus:ring-[var(--color-topps-gold)] gloss-pulse ink-bleed-heavy',
  };

  const sizeStyles = {
    sm: 'px-3 py-2 text-sm min-h-[40px]',
    md: 'px-4 py-3 text-base min-h-[48px]',
    lg: 'px-6 py-4 text-lg min-h-[56px]',
  };

  const fontOverride = variant === 'roll'
    ? 'font-[var(--font-script)]'
    : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${fontOverride} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  );
}
