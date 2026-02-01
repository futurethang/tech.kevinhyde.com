/**
 * Team Store - Zustand state management for teams
 */

import { create } from 'zustand';
import type { Team } from '../types';

interface TeamStoreState {
  teams: Team[];
  activeTeamId: string | null;
  currentEditingTeam: Team | null;
  isLoading: boolean;

  // Actions
  setTeams: (teams: Team[]) => void;
  addTeam: (team: Team) => void;
  updateTeam: (teamId: string, updates: Partial<Team>) => void;
  deleteTeam: (teamId: string) => void;
  setActiveTeam: (teamId: string) => void;
  setCurrentEditingTeam: (team: Team | null) => void;
  setLoading: (loading: boolean) => void;

  // Computed
  getActiveTeam: () => Team | undefined;
}

export const useTeamStore = create<TeamStoreState>((set, get) => ({
  teams: [],
  activeTeamId: null,
  currentEditingTeam: null,
  isLoading: false,

  setTeams: (teams) => set({ teams }),

  addTeam: (team) =>
    set((state) => ({
      teams: [...state.teams, team],
    })),

  updateTeam: (teamId, updates) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === teamId ? { ...t, ...updates } : t
      ),
      currentEditingTeam:
        state.currentEditingTeam?.id === teamId
          ? { ...state.currentEditingTeam, ...updates }
          : state.currentEditingTeam,
    })),

  deleteTeam: (teamId) =>
    set((state) => ({
      teams: state.teams.filter((t) => t.id !== teamId),
      activeTeamId: state.activeTeamId === teamId ? null : state.activeTeamId,
    })),

  setActiveTeam: (teamId) => set({ activeTeamId: teamId }),

  setCurrentEditingTeam: (team) => set({ currentEditingTeam: team }),

  setLoading: (loading) => set({ isLoading: loading }),

  getActiveTeam: () => {
    const { teams, activeTeamId } = get();
    return teams.find((t) => t.id === activeTeamId);
  },
}));
