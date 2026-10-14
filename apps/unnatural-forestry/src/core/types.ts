/**
 * Static game configuration types.
 *
 * Everything here mirrors a JSON file under `src/data/`. These objects are
 * treated as immutable: simulation state (src/core/state.ts) references them
 * by id and never writes to them.
 */

import type { Axial } from './hex';

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

/**
 * What the printed map *appears* to promise about a hex. Deliberately separate
 * from hidden contents so a hex can lie: a "low risk" look with a hazard under
 * it is a legal and intended map authoring move.
 */
export interface TerrainSignals {
  /** Apparent danger as read off the map. */
  readonly risk: 'low' | 'medium' | 'high';
  /** Apparent payoff as read off the map. */
  readonly reward: 'none' | 'low' | 'medium' | 'high';
}

export interface TerrainType {
  readonly id: string;
  readonly label: string;
  /** Fill colour used by the prototype renderer and the eventual print file. */
  readonly color: string;
  /** False for lakes, cliffs, etc. Impassable hexes are never legal moves. */
  readonly passable: boolean;
  /** Short text a player could read from the map itself. */
  readonly visibleClue: string;
  readonly signals: TerrainSignals;
}

// ---------------------------------------------------------------------------
// Items and characters
// ---------------------------------------------------------------------------

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Grouping only; no mechanical effect is implemented in milestone 1. */
  readonly kind: 'tool' | 'charm' | 'document' | 'consumable';
}

export interface CharacterDefinition {
  readonly id: string;
  readonly name: string;
  readonly species: string;
  /** One short trait per character. Not yet applied by the rules engine. */
  readonly trait: { readonly id: string; readonly label: string; readonly description: string };
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

export interface HexDefinition extends Axial {
  /** Stable, opaque identifier. Printed on the physical map. */
  readonly id: string;
  readonly terrain: string;
  /** Optional author note; shown in the inspector, never shown to players. */
  readonly notes?: string;
}

export interface TrailheadDefinition {
  readonly id: string;
  readonly hexId: string;
  readonly name: string;
  /** A closed trailhead is drawn but cannot be escaped through. */
  readonly closed: boolean;
}

export interface StartPositionDefinition {
  readonly id: string;
  readonly hexId: string;
}

/** Facilitator-secret contents of a hex. Kept out of `hexes` on purpose. */
export interface HexContentDefinition {
  readonly hexId: string;
  readonly kind: 'hazard' | 'reward' | 'clue' | 'special';
  readonly label: string;
  /** Item granted on discovery, when `kind` is "reward". Unapplied in M1. */
  readonly itemId?: string;
  readonly note?: string;
}

export interface MapLayout {
  readonly shape: 'hex-disc';
  readonly radius: number;
  /** Hex circumradius in px, used by the renderer and by print export. */
  readonly hexSize: number;
}

export interface MapDefinition {
  readonly id: string;
  readonly name: string;
  readonly layout: MapLayout;
  readonly hexes: readonly HexDefinition[];
  readonly trailheads: readonly TrailheadDefinition[];
  readonly startPositions: readonly StartPositionDefinition[];
  readonly contents: readonly HexContentDefinition[];
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

/**
 * Tunable parameters. Every value here is a knob for playtesting, not a
 * settled rule. Defaults live in `DEFAULT_RULES`.
 */
export interface RuleParameters {
  /** Hexes a team may move per round. Established rule: 1. */
  readonly movesPerRound: number;
  /** May a team hold position instead of moving? TEMPORARY ASSUMPTION: yes. */
  readonly allowStayInPlace: boolean;
  /** May two teams trade hexes in one round? TEMPORARY ASSUMPTION: yes. */
  readonly allowSwaps: boolean;
  /** Reveal hidden contents on arrival. Milestone 1 logs only; no effects. */
  readonly revealHiddenContents: boolean;
  /** Record an encounter when 2+ teams share a hex after resolution. */
  readonly collisionTriggersEncounter: boolean;
  /** Soft cap used by analysis and the UI; resolution does not enforce it. */
  readonly maxRounds: number;
}

export interface TeamDefinition {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly startHexId: string;
  readonly characterId: string;
  readonly items: readonly string[];
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /**
   * "party" scenarios model a real configuration of the night and must satisfy
   * the party invariants (equidistant starts, exits reachable inside the round
   * budget). "rig" scenarios exist to exercise a mechanic and are exempt.
   */
  readonly purpose: 'party' | 'rig';
  readonly mapId: string;
  /** Seed for the deterministic PRNG used during resolution. */
  readonly seed: number;
  readonly rules: RuleParameters;
  readonly teams: readonly TeamDefinition[];
}

/**
 * A scenario plus every definition it refers to, already cross-checked.
 * This is what the simulation is built from.
 */
export interface ResolvedScenario {
  readonly scenario: ScenarioDefinition;
  readonly map: MapDefinition;
  readonly terrains: ReadonlyMap<string, TerrainType>;
  readonly items: ReadonlyMap<string, ItemDefinition>;
  readonly characters: ReadonlyMap<string, CharacterDefinition>;
}

export const DEFAULT_RULES: RuleParameters = Object.freeze({
  movesPerRound: 1,
  allowStayInPlace: true,
  allowSwaps: true,
  revealHiddenContents: false,
  collisionTriggersEncounter: true,
  maxRounds: 12,
});
