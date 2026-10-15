/**
 * Team behaviour archetypes.
 *
 * These stand in for how guests might actually play. They are a testing
 * instrument, not a prediction — a real table will bluff, hold grudges and
 * follow whoever shouts loudest.
 *
 * Each archetype only sees what a real team sees: the map, every location's
 * terrain and visible loot, how many teams are still alive, and its own
 * inventory. It cannot see where anybody else is or is going.
 */

import type { Rng } from '../core/rng';
import type { Posture, TeamState, TrapState } from './resolve';
import type { BandDefinition, LocationDefinition, TerrainType } from './types';

export interface ChoiceContext {
  readonly band: BandDefinition;
  readonly terrains: ReadonlyMap<string, TerrainType>;
  readonly teamsAlive: number;
  readonly rng: Rng;
}

export interface Archetype {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  choose(team: TeamState, context: ChoiceContext): { locationId: string; posture: Posture };
}

function lootCount(location: LocationDefinition): number {
  return location.loot.length;
}

/**
 * Picks by preference, but not religiously: real teams mostly go for the best
 * option and sometimes talk themselves into the second or third. Without this
 * softening every team of an archetype makes an identical choice, which makes
 * the simulation degenerate rather than informative.
 */
const PREFERENCE_WEIGHTS = [0.55, 0.3, 0.15];

function pickBest(
  locations: readonly LocationDefinition[],
  score: (l: LocationDefinition) => number,
  rng: Rng,
): LocationDefinition {
  const ordered = [...locations]
    .sort((a, b) => a.id.localeCompare(b.id))
    .sort((a, b) => score(b) - score(a));
  const considered = ordered.slice(0, Math.min(PREFERENCE_WEIGHTS.length, ordered.length));
  const total = PREFERENCE_WEIGHTS.slice(0, considered.length).reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < considered.length; i++) {
    roll -= PREFERENCE_WEIGHTS[i]!;
    if (roll <= 0) return considered[i]!;
  }
  return considered[considered.length - 1]!;
}

const GREEDY: Archetype = {
  id: 'greedy',
  label: 'Greedy',
  description: 'Goes where the power-ups are and comes in loud. Assumes it will win the quiz.',
  choose(_team, { band, rng }) {
    return { locationId: pickBest(band.locations, lootCount, rng).id, posture: 'hunt' };
  },
};

const CAUTIOUS: Archetype = {
  id: 'cautious',
  label: 'Cautious',
  description: 'Heads for deep cover and hides. Survives early, arrives empty-handed.',
  choose(_team, { band, terrains, rng }) {
    const score = (l: LocationDefinition) => {
      const rule = terrains.get(l.terrain)!.fightRule;
      return rule === 'never' ? 2 : rule === 'if-hunted' ? 1 : 0;
    };
    return { locationId: pickBest(band.locations, score, rng).id, posture: 'hide' };
  },
};

const CONTRARIAN: Archetype = {
  id: 'contrarian',
  label: 'Contrarian',
  description: 'Reasons that everyone else chases the loot, so goes where the loot is not.',
  choose(_team, { band, rng }) {
    return { locationId: pickBest(band.locations, (l) => -lootCount(l), rng).id, posture: 'hide' };
  },
};

const ADAPTIVE: Archetype = {
  id: 'adaptive',
  label: 'Adaptive',
  description: 'Hunts the open ground when it is carrying power-ups, hides in cover when it is not.',
  choose(team, context) {
    const strong = team.items.length >= 2;
    if (!strong) return CAUTIOUS.choose(team, context);
    const { band, terrains, rng } = context;
    const score = (l: LocationDefinition) =>
      (terrains.get(l.terrain)!.fightRule === 'always' ? 10 : 0) +
      lootCount(l) +
      (team.skillByTopic[l.topic] ?? team.skill);
    return { locationId: pickBest(band.locations, score, rng).id, posture: 'hunt' };
  },
};

const SPECIALIST: Archetype = {
  id: 'specialist',
  label: 'Specialist',
  description: 'Goes wherever the trivia theme is one it reckons it knows, and ignores the treasure.',
  choose(team, { band, rng }) {
    const score = (l: LocationDefinition) => team.skillByTopic[l.topic] ?? team.skill;
    return { locationId: pickBest(band.locations, score, rng).id, posture: 'hunt' };
  },
};

const RANDOM: Archetype = {
  id: 'random',
  label: 'Random',
  description: 'Nobody is playing strategically. The true floor.',
  choose(_team, { band, rng }) {
    const ordered = [...band.locations].sort((a, b) => a.id.localeCompare(b.id));
    return {
      locationId: ordered[rng.int(ordered.length)]!.id,
      posture: rng.next() < 0.5 ? 'hunt' : 'hide',
    };
  },
};

export const ARCHETYPES: readonly Archetype[] = Object.freeze([
  GREEDY,
  CAUTIOUS,
  CONTRARIAN,
  ADAPTIVE,
  SPECIALIST,
  RANDOM,
]);

export const ARCHETYPE_IDS: ReadonlySet<string> = new Set(ARCHETYPES.map((a) => a.id));

export function getArchetype(id: string): Archetype {
  const found = ARCHETYPES.find((a) => a.id === id);
  if (!found) throw new Error(`unknown archetype "${id}"`);
  return found;
}

/**
 * Where the dead lay their traps. They aim at the richest ground, because that
 * is where the arrogant go — which is what makes the dead a tax on the leaders
 * rather than noise.
 */
export function placeTraps(
  band: BandDefinition,
  deadTeamIds: readonly string[],
  trapsPerTeam: number,
  rng: Rng,
): TrapState[] {
  const traps: TrapState[] = [];
  for (const placedBy of [...deadTeamIds].sort()) {
    for (let i = 0; i < trapsPerTeam; i++) {
      traps.push({ locationId: pickBest(band.locations, lootCount, rng).id, placedBy });
    }
  }
  return traps;
}
