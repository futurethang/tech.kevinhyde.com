/**
 * App - Main application with routing
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home } from './pages/Home';
import { Teams } from './pages/Teams';
import { Players } from './pages/Players';
import { Play } from './pages/Play';
import { Game } from './pages/Game';
import './index.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:teamId" element={<Teams />} />
          <Route path="/players" element={<Players />} />
          <Route path="/play" element={<Play />} />
          <Route path="/game/:gameId" element={<Game />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
