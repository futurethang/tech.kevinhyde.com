/**
 * useGameDerivedState - Derives current batter, pitcher, and role from store state
 */

import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import type { MLBPlayer } from '../types';

export function useGameDerivedState() {
  const currentGame = useGameStore((s) => s.currentGame);
  const gameState = useGameStore((s) => s.gameState);
  const playLog = useGameStore((s) => s.playLog);
  const user = useAuthStore((s) => s.user);

  const isVisitor = !!(user && currentGame && user.id === currentGame.visitorUserId);

  function getCurrentBatter(): MLBPlayer | null {
    if (!currentGame || !gameState || !user) return null;

    const battingTeam = gameState.isTopOfInning ? currentGame.visitorTeam : currentGame.homeTeam;
    if (!battingTeam?.roster) return null;

    const lineupSpot = (gameState.currentBatterIndex % 9) + 1;
    const currentBatterSlot = battingTeam.roster.find(
      (slot) =>
        slot.position !== 'SP' &&
        (slot.battingOrder === lineupSpot || slot.battingOrder === lineupSpot - 1)
    );
    const fallbackBatterSlot = battingTeam.roster.find((slot) => slot.position !== 'SP');

    const resolved = toDisplayPlayer(
      currentBatterSlot || fallbackBatterSlot,
      currentBatterSlot?.position || fallbackBatterSlot?.position || 'DH'
    );
    if (resolved) return resolved;

    const latest = playLog[playLog.length - 1];
    return playerFromPlayLog(latest?.batterName, 'DH', latest?.batterStats);
  }

  function getCurrentPitcher(): MLBPlayer | null {
    if (!currentGame || !gameState || !user) return null;

    const pitchingTeam = gameState.isTopOfInning ? currentGame.homeTeam : currentGame.visitorTeam;
    if (!pitchingTeam?.roster) return null;

    const pitcherSlot = pitchingTeam.roster.find((slot) => slot.position === 'SP');
    const fallbackPitcherSlot = pitchingTeam.roster[0];

    const resolved = toDisplayPlayer(pitcherSlot || fallbackPitcherSlot, 'SP');
    if (resolved) return resolved;

    const latest = playLog[playLog.length - 1];
    return playerFromPlayLog(latest?.pitcherName, 'SP', undefined, latest?.pitcherStats);
  }

  return {
    currentBatter: getCurrentBatter(),
    currentPitcher: getCurrentPitcher(),
    isVisitor,
  };
}

function toDisplayPlayer(slot: unknown, fallbackPosition: string): MLBPlayer | null {
  if (!slot || typeof slot !== 'object') return null;

  const typedSlot = slot as {
    mlbPlayerId?: number;
    player?: MLBPlayer;
    playerData?: {
      name?: string;
      battingStats?: {
        avg?: number; obp?: number; slg?: number; ops?: number;
        bb?: number; so?: number; ab?: number;
      };
      pitchingStats?: {
        era?: number; whip?: number; kPer9?: number; bbPer9?: number; hrPer9?: number;
      };
    };
  };

  if (typedSlot.player) return typedSlot.player;

  const playerData = typedSlot.playerData;
  const name = playerData?.name;
  if (!name) return null;

  const [firstName = '', ...rest] = name.split(' ');
  const lastName = rest.join(' ');

  return {
    mlbId: typedSlot.mlbPlayerId || 0,
    fullName: name,
    firstName,
    lastName: lastName || firstName,
    primaryPosition: fallbackPosition,
    currentTeam: null,
    currentTeamId: null,
    isActive: true,
    lastUpdated: new Date().toISOString(),
    battingStats: playerData?.battingStats
      ? {
          gamesPlayed: 0, atBats: playerData.battingStats.ab ?? 0, runs: 0, hits: 0,
          doubles: 0, triples: 0, homeRuns: 0, rbi: 0,
          walks: playerData.battingStats.bb ?? 0, strikeouts: playerData.battingStats.so ?? 0,
          stolenBases: 0, avg: playerData.battingStats.avg ?? 0,
          obp: playerData.battingStats.obp ?? 0, slg: playerData.battingStats.slg ?? 0,
          ops: playerData.battingStats.ops ?? 0,
        }
      : null,
    pitchingStats: playerData?.pitchingStats
      ? {
          gamesPlayed: 0, gamesStarted: 0, wins: 0, losses: 0,
          era: playerData.pitchingStats.era ?? 0, inningsPitched: 0,
          hits: 0, runs: 0, earnedRuns: 0, homeRuns: 0, walks: 0, strikeouts: 0,
          whip: playerData.pitchingStats.whip ?? 0,
          kPer9: playerData.pitchingStats.kPer9 ?? 0,
          bbPer9: playerData.pitchingStats.bbPer9 ?? 0,
          hrPer9: playerData.pitchingStats.hrPer9 ?? 0,
        }
      : null,
  };
}

function playerFromPlayLog(
  name: string | undefined,
  position: string,
  batting?: { avg: number; ops: number },
  pitching?: { era: number; whip: number; kPer9: number }
): MLBPlayer | null {
  if (!name) return null;

  const [firstName = '', ...rest] = name.split(' ');
  const lastName = rest.join(' ');

  return {
    mlbId: 0,
    fullName: name,
    firstName,
    lastName: lastName || firstName,
    primaryPosition: position,
    currentTeam: null,
    currentTeamId: null,
    isActive: true,
    lastUpdated: new Date().toISOString(),
    battingStats: batting
      ? {
          gamesPlayed: 0, atBats: 0, runs: 0, hits: 0, doubles: 0, triples: 0,
          homeRuns: 0, rbi: 0, walks: 0, strikeouts: 0, stolenBases: 0,
          avg: batting.avg, obp: 0, slg: 0, ops: batting.ops,
        }
      : null,
    pitchingStats: pitching
      ? {
          gamesPlayed: 0, gamesStarted: 0, wins: 0, losses: 0,
          era: pitching.era, inningsPitched: 0, hits: 0, runs: 0, earnedRuns: 0,
          homeRuns: 0, walks: 0, strikeouts: 0, whip: pitching.whip,
          kPer9: pitching.kPer9, bbPer9: 0, hrPer9: 0,
        }
      : null,
  };
}
