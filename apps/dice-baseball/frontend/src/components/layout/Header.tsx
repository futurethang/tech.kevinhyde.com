/**
 * Header Component - Top navigation bar
 * v5 Topps design: solid elevated bg, Pacifico title, red accent stripe
 */

import { Link, useLocation } from 'react-router-dom';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function Header({ title, showBack = false, rightAction }: HeaderProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <>
      <header className="sticky top-0 z-50 bg-[var(--color-surface-elevated)]">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Left section */}
          <div className="flex items-center gap-3">
            {showBack && !isHome && (
              <Link
                to="/"
                className="p-2 -ml-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
            )}
            <h1
              className="text-lg font-bold text-[var(--color-topps-gold)] ink-bleed"
              style={{ fontFamily: 'var(--font-script)' }}
            >
              {title}
            </h1>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2">
            {rightAction}
          </div>
        </div>
      </header>
      {/* Red accent stripe */}
      <div className="h-1 bg-[var(--color-card-red)]" />
    </>
  );
}

/**
 * Page Container - Wraps page content with consistent padding
 */
interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className = '' }: PageContainerProps) {
  return (
    <main className={`flex-1 overflow-auto ${className}`}>
      <div className="max-w-xl mx-auto px-4 py-6">
        {children}
      </div>
    </main>
  );
}
