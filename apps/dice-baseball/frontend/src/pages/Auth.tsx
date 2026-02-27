/**
 * Auth Page - Login and Registration
 * v5 Topps design: navy palette, gold accents
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Input, Button } from '../components/common';
import { Header, PageContainer } from '../components/layout/Header';
import { useAuthStore } from '../stores/authStore';
import { register, login } from '../services/api';

export function Auth() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  });

  function getErrorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
      return err.message;
    }
    return fallback;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = mode === 'login'
        ? await login(formData.email, formData.password)
        : await register(formData.email, formData.username, formData.password);

      setUser(response.user, response.token);
      navigate('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  // Development quick login
  const handleQuickLogin = async () => {
    setError(null);
    setLoading(true);

    try {
      const timestamp = Date.now();
      const testEmail = `test${timestamp}@example.com`;
      const testUsername = `Player${timestamp.toString().slice(-5)}`;

      const response = await register(testEmail, testUsername, 'password123');
      setUser(response.user, response.token);
      navigate('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Quick login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <Header title="Dice Baseball" />

      <PageContainer>
        <div className="max-w-md mx-auto w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">&#x26BE;</div>
            <h2
              className="text-2xl font-bold ink-bleed-heavy"
              style={{
                fontFamily: 'var(--font-script)',
                color: 'var(--color-topps-gold)',
              }}
            >
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
          </div>

          <Card>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="player@example.com"
                    required
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                      Username
                    </label>
                    <Input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="BabeRuth27"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-[var(--color-card-red)]/10 border border-[var(--color-card-red)]/50 text-[var(--color-card-red)] p-3 text-sm">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError(null);
                  }}
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : "Already have an account? Sign in"}
                </button>
              </div>

              {/* Development Quick Login */}
              {import.meta.env.DEV && (
                <div className="mt-6 pt-6 border-t border-[var(--color-text-dim)]">
                  <button
                    type="button"
                    onClick={handleQuickLogin}
                    data-testid="auth-quick-login"
                    className="w-full py-2 px-4 bg-[var(--color-stadium-green)]/20 text-[var(--color-stadium-green)] border border-[var(--color-stadium-green)]/50 hover:bg-[var(--color-stadium-green)]/30 transition-colors text-sm font-medium"
                    disabled={loading}
                  >
                    Quick Dev Login (Creates Test Account)
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
