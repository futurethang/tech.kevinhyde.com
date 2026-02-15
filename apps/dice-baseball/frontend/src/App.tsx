/**
 * App - Main application with routing
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { Toaster, toast } from 'react-hot-toast';
import { Home } from './pages/Home';
import { Teams } from './pages/Teams';
import { Players } from './pages/Players';
import { Play } from './pages/Play';
import { Game } from './pages/Game';
import { Auth } from './pages/Auth';
import { NotFound } from './pages/NotFound';
import { ErrorBoundary } from './components/common';
import { useAuthStore } from './stores/authStore';
import './index.css';

// Create React Query client with global error handler
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      // Skip toast for 401s — already handled by fetchWithAuth
      if (error && typeof error === 'object' && 'error' in error && (error as { error: string }).error === 'unauthorized') {
        return;
      }
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    },
  }),
});

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      {/* Hidden SVG filters for texture system */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="paper-noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves={4}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
      </svg>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { background: '#16213e', color: '#e8e0d4', borderRadius: 0 },
          success: { duration: 3000, style: { borderLeft: '4px solid #4caf50' } },
          error: { duration: 4000, style: { borderLeft: '4px solid #c62828' } },
        }}
      />
      <BrowserRouter basename="/apps/dice-baseball">
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/teams" element={
            <ProtectedRoute>
              <Teams />
            </ProtectedRoute>
          } />
          <Route path="/teams/:teamId" element={
            <ProtectedRoute>
              <Teams />
            </ProtectedRoute>
          } />
          <Route path="/players" element={
            <ProtectedRoute>
              <Players />
            </ProtectedRoute>
          } />
          <Route path="/play" element={
            <ProtectedRoute>
              <Play />
            </ProtectedRoute>
          } />
          <Route path="/game/:gameId" element={
            <ProtectedRoute>
              <Game />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
      {/* Global paper grain overlay */}
      <div
        className="fixed inset-0 z-[9999] pointer-events-none"
        style={{
          opacity: 0.08,
          mixBlendMode: 'screen',
          filter: 'url(#paper-noise)',
          background: '#a09080',
        }}
      />
    </ErrorBoundary>
  );
}

export default App;
