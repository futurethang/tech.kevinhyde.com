/**
 * Auth Store - Zustand state management for authentication
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        // Clear related stores to avoid stale data
        import('../stores/teamStore').then(({ useTeamStore }) => {
          useTeamStore.getState().setTeams([]);
        }).catch(() => {});
        import('../stores/gameStore').then(({ useGameStore }) => {
          useGameStore.getState().resetGame();
        }).catch(() => {});
      },

      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'dice-baseball-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
