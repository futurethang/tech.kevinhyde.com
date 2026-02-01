#!/usr/bin/env npx ts-node
/**
 * Dice Baseball Game Simulation
 * Demonstrates the game engine by simulating a full 9-inning game
 *
 * Run with: npx ts-node src/scripts/simulate-game.ts
 */

import {
  resolveAtBat,
  advanceRunners,
  handleInningLogic,
  generateDescription,
  BatterStats,
  PitcherStats,
  GameState,
  OutcomeType,
} from '../services/game-engine';

// ============================================
// MOCK TEAM DATA
// ============================================

interface Player {
  name: string;
  position: string;
  batting: BatterStats;
}

interface Pitcher {
  name: string;
  pitching: PitcherStats;
}

interface Team {
  name: string;
  lineup: Player[];
  pitcher: Pitcher;
}

// Home Team: "The Sluggers" - Power-hitting team
const homeTeam: Team = {
  name: 'The Sluggers',
  pitcher: {
    name: 'Jake Flames',
    pitching: { era: 3.45, whip: 1.15, kPer9: 9.2, bbPer9: 2.8, hrPer9: 1.1 },
  },
  lineup: [
    { name: 'Speed Johnson', position: 'CF', batting: { avg: 0.285, obp: 0.350, slg: 0.420, ops: 0.770, bb: 55, so: 95, ab: 520 } },
    { name: 'Contact Smith', position: '2B', batting: { avg: 0.305, obp: 0.365, slg: 0.440, ops: 0.805, bb: 60, so: 70, ab: 510 } },
    { name: 'Power Davis', position: '1B', batting: { avg: 0.275, obp: 0.380, slg: 0.580, ops: 0.960, bb: 85, so: 145, ab: 480 } },
    { name: 'Crusher Williams', position: 'RF', batting: { avg: 0.260, obp: 0.355, slg: 0.550, ops: 0.905, bb: 70, so: 160, ab: 490 } },
    { name: 'Steady Brown', position: '3B', batting: { avg: 0.280, obp: 0.340, slg: 0.450, ops: 0.790, bb: 45, so: 90, ab: 500 } },
    { name: 'Clutch Garcia', position: 'LF', batting: { avg: 0.270, obp: 0.330, slg: 0.430, ops: 0.760, bb: 40, so: 100, ab: 495 } },
    { name: 'Glove Martinez', position: 'SS', batting: { avg: 0.255, obp: 0.310, slg: 0.380, ops: 0.690, bb: 35, so: 85, ab: 505 } },
    { name: 'Wall Thompson', position: 'C', batting: { avg: 0.245, obp: 0.320, slg: 0.400, ops: 0.720, bb: 45, so: 110, ab: 450 } },
    { name: 'Utility Lee', position: 'DH', batting: { avg: 0.265, obp: 0.335, slg: 0.420, ops: 0.755, bb: 50, so: 95, ab: 475 } },
  ],
};

// Visitor Team: "The Aces" - Pitching-focused team with contact hitters
const visitorTeam: Team = {
  name: 'The Aces',
  pitcher: {
    name: 'Max Viper',
    pitching: { era: 2.85, whip: 0.98, kPer9: 11.5, bbPer9: 2.2, hrPer9: 0.8 },
  },
  lineup: [
    { name: 'Quick Anderson', position: 'CF', batting: { avg: 0.295, obp: 0.360, slg: 0.410, ops: 0.770, bb: 50, so: 75, ab: 530 } },
    { name: 'Slick Wilson', position: 'SS', batting: { avg: 0.290, obp: 0.345, slg: 0.395, ops: 0.740, bb: 45, so: 65, ab: 515 } },
    { name: 'Patient Taylor', position: '1B', batting: { avg: 0.275, obp: 0.390, slg: 0.480, ops: 0.870, bb: 95, so: 100, ab: 470 } },
    { name: 'Smooth Jackson', position: 'RF', batting: { avg: 0.285, obp: 0.350, slg: 0.460, ops: 0.810, bb: 55, so: 90, ab: 495 } },
    { name: 'Sharp White', position: '3B', batting: { avg: 0.270, obp: 0.335, slg: 0.425, ops: 0.760, bb: 50, so: 85, ab: 500 } },
    { name: 'Solid Harris', position: 'LF', batting: { avg: 0.260, obp: 0.320, slg: 0.400, ops: 0.720, bb: 40, so: 95, ab: 505 } },
    { name: 'Reliable Clark', position: '2B', batting: { avg: 0.265, obp: 0.325, slg: 0.385, ops: 0.710, bb: 42, so: 80, ab: 510 } },
    { name: 'Tough Lewis', position: 'C', batting: { avg: 0.240, obp: 0.310, slg: 0.370, ops: 0.680, bb: 40, so: 105, ab: 460 } },
    { name: 'Hustle Walker', position: 'DH', batting: { avg: 0.255, obp: 0.330, slg: 0.410, ops: 0.740, bb: 48, so: 90, ab: 480 } },
  ],
};

// ============================================
// GAME SIMULATION
// ============================================

function rollDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

function formatBases(bases: [boolean, boolean, boolean]): string {
  const symbols = bases.map((b, i) => (b ? ['1B', '2B', '3B'][i] : '__'));
  return `[${symbols.join(' ')}]`;
}

function formatScore(state: GameState, homeTeam: Team, visitorTeam: Team): string {
  return `${visitorTeam.name} ${state.scores[0]} - ${homeTeam.name} ${state.scores[1]}`;
}

function simulateGame(home: Team, visitor: Team, verbose = true): GameState {
  const state: GameState = {
    inning: 1,
    isTopOfInning: true,
    outs: 0,
    scores: [0, 0],
    bases: [false, false, false],
    currentBatterIndex: 0,
  };

  const batterIndices = [0, 0]; // [visitor, home]
  let playNumber = 0;

  const log = (msg: string) => {
    if (verbose) console.log(msg);
  };

  log('\n' + '='.repeat(60));
  log(`  DICE BASEBALL: ${visitor.name} @ ${home.name}`);
  log('='.repeat(60) + '\n');

  while (!state.isGameOver) {
    const battingTeamIdx = state.isTopOfInning ? 0 : 1;
    const battingTeam = state.isTopOfInning ? visitor : home;
    const pitchingTeam = state.isTopOfInning ? home : visitor;

    // Get current batter
    const batterIdx = batterIndices[battingTeamIdx] % 9;
    const batter = battingTeam.lineup[batterIdx];
    const pitcher = pitchingTeam.pitcher;

    // Roll dice and resolve at-bat
    const diceRoll = rollDice();
    const outcome = resolveAtBat(batter.batting, pitcher.pitching, diceRoll);

    // Advance runners
    const { newBases, runsScored } = advanceRunners(
      { bases: state.bases, outs: state.outs },
      outcome
    );

    // Update state
    state.bases = newBases;
    if (['strikeout', 'groundOut', 'flyOut'].includes(outcome)) {
      state.outs++;
    }
    state.scores[battingTeamIdx] += runsScored;

    // Generate description
    const description = generateDescription(outcome, batter.name, pitcher.name, runsScored);

    // Log the play
    playNumber++;
    const inningLabel = state.isTopOfInning ? 'Top' : 'Bot';
    log(`[${inningLabel} ${state.inning}] ${description}`);
    log(`   Dice: ${diceRoll[0]}+${diceRoll[1]}=${diceRoll[0] + diceRoll[1]} | Outs: ${state.outs} | Bases: ${formatBases(state.bases)} | Score: ${formatScore(state, home, visitor)}`);

    // Advance batter in lineup
    batterIndices[battingTeamIdx]++;

    // Handle inning logic
    handleInningLogic(state);

    // Check for inning change message
    if (state.outs === 0 && !state.isGameOver) {
      log('\n--- ' + (state.isTopOfInning ? `Top of ${state.inning}` : `Bottom of ${state.inning}`) + ' ---\n');
    }

    // Safety check for runaway games
    if (playNumber > 500) {
      log('\n[Game stopped - too many plays]');
      break;
    }
  }

  log('\n' + '='.repeat(60));
  log('  FINAL SCORE');
  log('='.repeat(60));
  log(`\n  ${visitor.name}: ${state.scores[0]}`);
  log(`  ${home.name}: ${state.scores[1]}\n`);

  const winner = state.scores[0] > state.scores[1] ? visitor.name : home.name;
  log(`  Winner: ${winner}!`);
  log(`  Game ended in ${state.inning} innings with ${playNumber} at-bats.\n`);

  return state;
}

// ============================================
// RUN SIMULATION
// ============================================

console.log('\nStarting Dice Baseball Simulation...\n');

// Run a single game with full play-by-play
const finalState = simulateGame(homeTeam, visitorTeam, true);

// Run multiple simulations to show statistical balance
console.log('\n' + '='.repeat(60));
console.log('  RUNNING 100 GAME SIMULATION');
console.log('='.repeat(60) + '\n');

let homeWins = 0;
let visitorWins = 0;
let totalRuns = [0, 0];

for (let i = 0; i < 100; i++) {
  const result = simulateGame(homeTeam, visitorTeam, false);
  if (result.scores[1] > result.scores[0]) {
    homeWins++;
  } else {
    visitorWins++;
  }
  totalRuns[0] += result.scores[0];
  totalRuns[1] += result.scores[1];
}

console.log(`  ${visitorTeam.name} wins: ${visitorWins}`);
console.log(`  ${homeTeam.name} wins: ${homeWins}`);
console.log(`  Avg runs per game: ${(totalRuns[0] / 100).toFixed(1)} - ${(totalRuns[1] / 100).toFixed(1)}`);
console.log(`\n  Note: The Aces have the better pitcher (2.85 ERA vs 3.45)`);
console.log(`  The Sluggers have more power hitting (higher team SLG)\n`);
