/**
 * Home Page - Dashboard with quick actions
 * v5 Topps design: navy palette, gold accents, gloss surfaces
 */

import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, Button } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { useAuthStore } from '../stores/authStore';

export function Home() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <Header
        title="Dice Baseball"
        rightAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
          >
            Logout
          </Button>
        }
      />

      <PageContainer>
        {/* Logo and Welcome */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">&#x26BE;</div>
          <h2
            className="text-2xl font-bold text-[var(--color-topps-gold)] ink-bleed-heavy"
            style={{ fontFamily: 'var(--font-script)' }}
          >
            Dice Baseball
          </h2>
          <p className="text-[var(--color-topps-gold)] font-display text-lg">STATS EDITION</p>
        </div>

        {/* User Stats */}
        {user && (
          <Card className="mb-6">
            <CardContent>
              <p className="text-[var(--color-text-muted)]">Welcome back,</p>
              <p className="text-xl font-semibold text-[var(--color-text-primary)]">{user.displayName}!</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Record: {user.wins}-{user.losses}
                {user.wins + user.losses > 0 && (
                  <span className="text-[var(--color-stadium-green)] ml-1">
                    ({((user.wins / (user.wins + user.losses)) * 100).toFixed(0)}%)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <Link to="/play" className="block" data-testid="nav-play-link">
            <Card variant="interactive">
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl">&#x1F3AE;</span>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-lg font-display">PLAY</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Start or join a game</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/teams" className="block">
            <Card variant="interactive">
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl">&#x1F465;</span>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-lg font-display">MY TEAMS</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Build and manage rosters</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/players" className="block">
            <Card variant="interactive">
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl">&#x1F50D;</span>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-lg font-display">PLAYER DATABASE</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Browse MLB players & stats</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-[var(--color-text-dim)]">
          <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
            <button className="flex items-center gap-2 hover:text-[var(--color-text-secondary)] transition-colors">
              <span>&#x2699;&#xFE0F;</span> Settings
            </button>
            <button className="flex items-center gap-2 hover:text-[var(--color-text-secondary)] transition-colors">
              <span>&#x1F4CA;</span> Full History
            </button>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
