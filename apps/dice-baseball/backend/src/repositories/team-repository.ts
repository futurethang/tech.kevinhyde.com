import type { Team } from '../services/team-service.js';

export interface TeamRepository {
  listByUser(userId: string): Promise<Team[]>;
  getById(teamId: string): Promise<Team | null>;
  save(team: Team): Promise<void>;
  delete(teamId: string): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryTeamRepository implements TeamRepository {
  private readonly teamStore: Map<string, Team> = new Map();
  private readonly userTeamIndex: Map<string, Set<string>> = new Map();

  async listByUser(userId: string): Promise<Team[]> {
    const userTeamIds = this.userTeamIndex.get(userId) || new Set<string>();
    const teams: Team[] = [];

    for (const teamId of userTeamIds) {
      const team = this.teamStore.get(teamId);
      if (team) {
        teams.push(team);
      }
    }

    return teams;
  }

  async getById(teamId: string): Promise<Team | null> {
    return this.teamStore.get(teamId) || null;
  }

  async save(team: Team): Promise<void> {
    this.teamStore.set(team.id, team);
    if (!this.userTeamIndex.has(team.userId)) {
      this.userTeamIndex.set(team.userId, new Set<string>());
    }
    this.userTeamIndex.get(team.userId)!.add(team.id);
  }

  async delete(teamId: string): Promise<void> {
    const team = this.teamStore.get(teamId);
    if (!team) return;

    this.teamStore.delete(teamId);
    const userTeamIds = this.userTeamIndex.get(team.userId);
    if (userTeamIds) {
      userTeamIds.delete(teamId);
    }
  }

  async clear(): Promise<void> {
    this.teamStore.clear();
    this.userTeamIndex.clear();
  }
}

export const teamRepository: TeamRepository = new InMemoryTeamRepository();
