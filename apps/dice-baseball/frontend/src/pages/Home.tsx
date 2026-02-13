/**
 * Home Page - Dashboard with quick actions
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
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Header 
        title="DICE BASEBALL" 
        rightAction={
          <Button 
            variant="secondary" 
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
          <div className="text-6xl mb-4">⚾</div>
          <h2 className="text-2xl font-display font-bold text-white">
            DICE BASEBALL
          </h2>
          <p className="text-green-500 font-display text-lg">STATS EDITION</p>
        </div>

        {/* User Stats */}
        {user && (
          <Card className="mb-6">
            <CardContent>
              <p className="text-gray-400">Welcome back,</p>
              <p className="text-xl font-semibold text-white">{user.displayName}!</p>
              <p className="text-sm text-gray-400 mt-1">
                Record: {user.wins}-{user.losses}
                {user.wins + user.losses > 0 && (
                  <span className="text-green-500 ml-1">
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
            <Card variant="interactive" className="hover:border-green-500/50">
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl">🎮</span>
                <div>
                  <p className="font-semibold text-white text-lg">PLAY</p>
                  <p className="text-sm text-gray-400">Start or join a game</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/teams" className="block">
            <Card variant="interactive" className="hover:border-green-500/50">
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl">👥</span>
                <div>
                  <p className="font-semibold text-white text-lg">MY TEAMS</p>
                  <p className="text-sm text-gray-400">Build and manage rosters</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/players" className="block">
            <Card variant="interactive" className="hover:border-green-500/50">
              <CardContent className="flex items-center gap-4">
                <span className="text-3xl">🔍</span>
                <div>
                  <p className="font-semibold text-white text-lg">PLAYER DATABASE</p>
                  <p className="text-sm text-gray-400">Browse MLB players & stats</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-800">
          <div className="flex justify-between text-sm text-gray-500">
            <button className="flex items-center gap-2 hover:text-gray-300 transition-colors">
              <span>⚙️</span> Settings
            </button>
            <button className="flex items-center gap-2 hover:text-gray-300 transition-colors">
              <span>📊</span> Full History
            </button>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
