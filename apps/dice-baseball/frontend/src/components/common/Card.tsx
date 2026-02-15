/**
 * Card Component - Color-block frame system
 * v5 Topps design: zero radius, grid gap borders, token colors
 */

import { type ReactNode, type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'highlighted';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Card({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...props
}: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const interactiveClasses = variant === 'interactive'
    ? 'hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors duration-200 gloss-surface'
    : '';

  const highlightedClasses = variant === 'highlighted'
    ? 'gloss-surface aged-edge'
    : '';

  return (
    <div
      className={`bg-black grid gap-[1px] ${className}`}
      {...props}
    >
      <div
        className={`bg-[var(--color-surface-card)] ${paddingStyles[padding]} ${interactiveClasses} ${highlightedClasses}`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Card Header - Title section
 */
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-lg font-display font-semibold text-[var(--color-text-primary)] ink-bleed">{title}</h3>
        {subtitle && (
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * Card Content - Main content area
 */
interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

/**
 * Card Footer - Action buttons area
 */
interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`mt-4 pt-4 border-t border-[var(--color-text-dim)] ${className}`}>
      {children}
    </div>
  );
}
