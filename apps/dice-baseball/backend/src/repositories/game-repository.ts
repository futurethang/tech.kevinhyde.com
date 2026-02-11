import type { Game, MoveInput } from '../services/game-service.js';

export interface StoredMove {
  moveNumber: number;
  userId: string;
  data: MoveInput & {
    outcome?: string;
    runsScored?: number;
    outsRecorded?: number;
    batterIndex?: number;
  };
}

export interface GameRepository {
  hasJoinCode(joinCode: string): Promise<boolean>;
  save(game: Game): Promise<void>;
  getById(gameId: string): Promise<Game | null>;
  getByJoinCode(joinCode: string): Promise<Game | null>;
  listActiveByUser(userId: string): Promise<Game[]>;
  appendMove(gameId: string, move: StoredMove): Promise<void>;
  getMoveCount(gameId: string): Promise<number>;
  removeJoinCode(joinCode: string): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryGameRepository implements GameRepository {
  private readonly games: Map<string, Game> = new Map();
  private readonly gamesByJoinCode: Map<string, string> = new Map();
  private readonly gameMoves: Map<string, StoredMove[]> = new Map();

  async hasJoinCode(joinCode: string): Promise<boolean> {
    return this.gamesByJoinCode.has(joinCode.toUpperCase());
  }

  async save(game: Game): Promise<void> {
    this.games.set(game.id, game);
    this.gamesByJoinCode.set(game.joinCode.toUpperCase(), game.id);
    if (!this.gameMoves.has(game.id)) {
      this.gameMoves.set(game.id, []);
    }
  }

  async getById(gameId: string): Promise<Game | null> {
    return this.games.get(gameId) || null;
  }

  async getByJoinCode(joinCode: string): Promise<Game | null> {
    const gameId = this.gamesByJoinCode.get(joinCode.toUpperCase());
    if (!gameId) return null;
    return this.games.get(gameId) || null;
  }

  async listActiveByUser(userId: string): Promise<Game[]> {
    const userGames: Game[] = [];

    this.games.forEach((game) => {
      if (
        (game.homeUserId === userId || game.visitorUserId === userId) &&
        (game.status === 'active' || game.status === 'waiting')
      ) {
        userGames.push(game);
      }
    });

    return userGames;
  }

  async appendMove(gameId: string, move: StoredMove): Promise<void> {
    const moves = this.gameMoves.get(gameId) || [];
    moves.push(move);
    this.gameMoves.set(gameId, moves);
  }

  async getMoveCount(gameId: string): Promise<number> {
    return (this.gameMoves.get(gameId) || []).length;
  }

  async removeJoinCode(joinCode: string): Promise<void> {
    this.gamesByJoinCode.delete(joinCode.toUpperCase());
  }

  async clear(): Promise<void> {
    this.games.clear();
    this.gamesByJoinCode.clear();
    this.gameMoves.clear();
  }
}

export const gameRepository: GameRepository = new InMemoryGameRepository();
