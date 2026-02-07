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
  hasUnsavedChanges: boolean;

  // Actions
  setTeams: (teams: Team[]) => void;
  addTeam: (team: Team) => void;
  updateTeam: (teamId: string, updates: Partial<Team>) => void;
  deleteTeam: (teamId: string) => void;
  duplicateTeam: (teamId: string, newName: string) => Team | null;
  reorderTeams: (teamIds: string[]) => void;
  setActiveTeam: (teamId: string) => void;
  setCurrentEditingTeam: (team: Team | null) => void;
  setLoading: (loading: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  saveDraft: (team: Team) => void;

  // Computed
  getActiveTeam: () => Team | undefined;
  getTeamById: (teamId: string) => Team | undefined;
}

export const useTeamStore = create<TeamStoreState>((set, get) => ({
  teams: [],
  activeTeamId: null,
  currentEditingTeam: null,
  isLoading: false,
  hasUnsavedChanges: false,

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
      currentEditingTeam: state.currentEditingTeam?.id === teamId ? null : state.currentEditingTeam,
    })),

  duplicateTeam: (teamId, newName) => {
    const { teams } = get();
    const originalTeam = teams.find(t => t.id === teamId);
    if (!originalTeam) return null;

    const newTeam: Team = {
      ...originalTeam,
      id: `temp-${Date.now()}`, // Temporary ID until saved
      name: newName,
      isActive: false,
      rosterComplete: false, // Reset completion status
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      teams: [...state.teams, newTeam],
    }));

    return newTeam;
  },

  reorderTeams: (teamIds) =>
    set((state) => {
      const orderedTeams = teamIds
        .map(id => state.teams.find(t => t.id === id))
        .filter((team): team is Team => team !== undefined);
      
      // Add any teams not in the reorder list to the end
      const remainingTeams = state.teams.filter(t => !teamIds.includes(t.id));
      
      return {
        teams: [...orderedTeams, ...remainingTeams]
      };
    }),

  setActiveTeam: (teamId) => set({ activeTeamId: teamId }),

  setCurrentEditingTeam: (team) => set({ currentEditingTeam: team }),

  setLoading: (loading) => set({ isLoading: loading }),

  setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

  saveDraft: (team) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === team.id ? { ...t, ...team } : t
      ),
      currentEditingTeam: state.currentEditingTeam?.id === team.id ? team : state.currentEditingTeam,
      hasUnsavedChanges: false,
    })),

  getActiveTeam: () => {
    const { teams, activeTeamId } = get();
    return teams.find((t) => t.id === activeTeamId);
  },

  getTeamById: (teamId) => {
    const { teams } = get();
    return teams.find((t) => t.id === teamId);
  },
}));
