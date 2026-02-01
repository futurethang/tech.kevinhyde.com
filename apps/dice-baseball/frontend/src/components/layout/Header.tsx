/**
 * Header Component - Top navigation bar
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
    <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left section */}
        <div className="flex items-center gap-3">
          {showBack && !isHome && (
            <Link
              to="/"
              className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
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
          <h1 className="text-lg font-display font-bold text-white">{title}</h1>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {rightAction}
          <span className="text-xl">⚾</span>
        </div>
      </div>
    </header>
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
      <div className="max-w-lg mx-auto px-4 py-6">
        {children}
      </div>
    </main>
  );
}
