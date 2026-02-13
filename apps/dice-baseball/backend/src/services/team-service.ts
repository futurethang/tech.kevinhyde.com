/**
 * Team Service
 *
 * Handles team CRUD operations and roster management.
 * Uses in-memory storage for development, will connect to Supabase in production.
 */

import { v4 as uuidv4 } from 'uuid';
import type { RosterSlot } from './roster-validation.js';
import { teamRepository } from '../repositories/team-repository.js';

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

/**
 * Get all teams for a user
 */
export async function getTeams(userId: string): Promise<Team[]> {
  const teams = await teamRepository.listByUser(userId);
  
  // Sort by creation date, newest first
  return teams.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get a single team by ID
 */
export async function getTeamById(teamId: string): Promise<Team | null> {
  return teamRepository.getById(teamId);
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
  
  await teamRepository.save(team);
  
  return team;
}

/**
 * Update a team
 */
export async function updateTeam(
  teamId: string,
  updates: Partial<Pick<Team, 'name' | 'isActive'>>
): Promise<Team> {
  const team = await teamRepository.getById(teamId);
  if (!team) {
    throw new Error('Team not found');
  }
  
  // Apply updates
  if (updates.name !== undefined) team.name = updates.name;
  if (updates.isActive !== undefined) team.isActive = updates.isActive;
  team.updatedAt = new Date().toISOString();
  
  await teamRepository.save(team);
  
  return team;
}

/**
 * Delete a team
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const team = await teamRepository.getById(teamId);
  if (!team) {
    throw new Error('Team not found');
  }

  await teamRepository.delete(teamId);
}

/**
 * Update team roster
 */
export async function updateRoster(teamId: string, roster: RosterSlot[], validateComplete: boolean = true): Promise<Team> {
  const team = await teamRepository.getById(teamId);
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
  } else if (!validateComplete) {
    // For drafts, we allow incomplete rosters
    team.isActive = false;
  }
  
  await teamRepository.save(team);
  
  return team;
}

/**
 * Update batting order
 */
export async function updateBattingOrder(
  teamId: string,
  order: string[]
): Promise<BattingOrderResult> {
  const team = await teamRepository.getById(teamId);
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
  await teamRepository.save(team);
  
  return {
    message: 'Batting order updated successfully',
    battingOrder,
  };
}

export async function clearAllTeams(): Promise<void> {
  await teamRepository.clear();
}
