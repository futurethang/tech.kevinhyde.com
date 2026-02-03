/**
 * Team Service
 *
 * Handles team CRUD operations and roster management.
 * Uses in-memory storage for development, will connect to Supabase in production.
 */

import { v4 as uuidv4 } from 'uuid';
import type { RosterSlot } from './roster-validation.js';

export interface Team {
  id: string;
  name: string;
  userId: string;
  isActive: boolean;
  rosterComplete: boolean;
  createdAt: string;
  updatedAt?: string;
  roster?: RosterSlot[];
}

export interface BattingOrderResult {
  message: string;
  battingOrder: Array<{ order: number; position: string; playerName?: string }>;
}

// In-memory storage for teams (development mode)
const teamStore: Map<string, Team> = new Map();
const userTeamIndex: Map<string, Set<string>> = new Map(); // userId -> Set of teamIds

/**
 * Get all teams for a user
 */
export async function getTeams(userId: string): Promise<Team[]> {
  const userTeamIds = userTeamIndex.get(userId) || new Set();
  const teams: Team[] = [];
  
  for (const teamId of userTeamIds) {
    const team = teamStore.get(teamId);
    if (team) {
      teams.push(team);
    }
  }
  
  // Sort by creation date, newest first
  return teams.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get a single team by ID
 */
export async function getTeamById(teamId: string): Promise<Team | null> {
  return teamStore.get(teamId) || null;
}

/**
 * Create a new team
 */
export async function createTeam(userId: string, name: string): Promise<Team> {
  const team: Team = {
    id: uuidv4(),
    name,
    userId,
    isActive: false,
    rosterComplete: false,
    createdAt: new Date().toISOString(),
    roster: [],
  };
  
  // Store the team
  teamStore.set(team.id, team);
  
  // Update user index
  if (!userTeamIndex.has(userId)) {
    userTeamIndex.set(userId, new Set());
  }
  userTeamIndex.get(userId)!.add(team.id);
  
  return team;
}

/**
 * Update a team
 */
export async function updateTeam(
  teamId: string,
  updates: Partial<Pick<Team, 'name' | 'isActive'>>
): Promise<Team> {
  const team = teamStore.get(teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Apply updates
  if (updates.name !== undefined) team.name = updates.name;
  if (updates.isActive !== undefined) team.isActive = updates.isActive;
  team.updatedAt = new Date().toISOString();
  
  // Save back to store
  teamStore.set(teamId, team);
  
  return team;
}

/**
 * Delete a team
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const team = teamStore.get(teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Remove from team store
  teamStore.delete(teamId);
  
  // Remove from user index
  const userTeamIds = userTeamIndex.get(team.userId);
  if (userTeamIds) {
    userTeamIds.delete(teamId);
  }
}

/**
 * Update team roster
 */
export async function updateRoster(teamId: string, roster: RosterSlot[]): Promise<Team> {
  const team = teamStore.get(teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Update roster and check if complete
  team.roster = roster;
  team.rosterComplete = roster.length === 10; // 9 position players + 1 pitcher
  team.updatedAt = new Date().toISOString();
  
  // Check if team can be active (has complete roster)
  if (team.rosterComplete) {
    team.isActive = true;
  }
  
  // Save back to store
  teamStore.set(teamId, team);
  
  return team;
}

/**
 * Update batting order
 */
export async function updateBattingOrder(
  teamId: string,
  order: string[]
): Promise<BattingOrderResult> {
  const team = teamStore.get(teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  
  if (!team.roster || team.roster.length === 0) {
    throw new Error('Team has no roster');
  }
  
  // Update batting order for each player in the roster
  const battingOrder: Array<{ order: number; position: string; playerName?: string }> = [];
  
  order.forEach((position, index) => {
    const rosterSlot = team.roster?.find(r => r.position === position);
    if (rosterSlot) {
      rosterSlot.battingOrder = index + 1;
      battingOrder.push({
        order: index + 1,
        position,
        playerName: `Player at ${position}`, // Would need to look up player name from MLB data
      });
    }
  });
  
  team.updatedAt = new Date().toISOString();
  teamStore.set(teamId, team);
  
  return {
    message: 'Batting order updated successfully',
    battingOrder,
  };
}
