/**
 * The Dark Forest ruleset — static configuration types.
 *
 * Every type here mirrors a JSON file under `src/data/forest/`. The branching
 * of a round is code (see resolve.ts) because it is genuinely conditional
 * logic; everything that is a *number* — how much an item is worth in a fight,
 * how wide the skill spread is, how many locations are in a band — is data,
 * because those are the knobs that decide whether the game works.
 */

/** What happens when two or more teams arrive at the same location. */
export type FightRule =
  /** Open ground: you cannot hide. Any two teams here fight. */
  | 'always'
  /** Mixed cover: a fight only happens if at least one team hunted. */
  | 'if-hunted'
  /** Deep cover: hiding always works. No fight is possible here. */
  | 'never';

export interface TerrainType {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly fightRule: FightRule;
  /** Surviving a round here earns one whispered fact (a trap location). */
  readonly grantsIntel: boolean;
  /** Relative richness; the map author places actual loot per location. */
  readonly lootTier: number;
  /** Map symbol, for the eventual printed board. */
  readonly symbol: string;
}

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  /** What it does in the quiz, in plain words. Flavour for the token. */
  readonly effect: string;
  readonly symbol: string;
}

export interface LocationDefinition {
  readonly id: string;
  readonly name: string;
  readonly terrain: string;
  /** Items visible on the printed map. Visible loot is the bait that crowds. */
  readonly loot: readonly string[];
}

export interface BandDefinition {
  readonly id: string;
  readonly name: string;
  readonly locations: readonly LocationDefinition[];
}

export interface MapDefinition {
  readonly id: string;
  readonly name: string;
  /** Ordered outward-to-inward. The last band is the trailhead. */
  readonly bands: readonly BandDefinition[];
}

/**
 * How a fight is decided. The real thing is a trivia quiz; this is a stand-in
 * that lets us ask whether items decide everything or whether knowing the
 * answers still matters.
 *
 *   score = skill + itemEdge x items + uniform(0, luck)
 */
export interface FightModel {
  /** Width of the per-team trivia-ability draw. Bigger = team skill matters more. */
  readonly skillSpread: number;
  /** Score added per item carried. Bigger = power-ups decide fights. */
  readonly itemEdge: number;
  /** Width of the per-question luck draw. Bigger = anyone can win. */
  readonly luck: number;
}

export interface RuleParameters {
  readonly fight: FightModel;
  /** Items a team starts with. */
  readonly startingItems: number;
  /** Items a hunter drops when it finds nobody to fight. */
  readonly hunterNoPreyPenalty: number;
  /** Items a trap strips from each team that walks into it. */
  readonly trapPenalty: number;
  /** Traps each eliminated team may place, per round. */
  readonly trapsPerDeadTeam: number;
  /** From which round (1-based) the dead may start placing traps. */
  readonly trapsFromRound: number;
  /**
   * When true, deep cover ("never") is an absolute sanctuary: no fight can
   * happen there, so a team that wants to avoid all contact can do so with
   * certainty. When false, deep cover is merely quiet ground and behaves like
   * mixed cover — a fight happens if anybody there came hunting.
   */
  readonly deepCoverIsSanctuary: boolean;
  /** Whether a lone team on a location picks up its visible loot. */
  readonly soloTakesLoot: boolean;
  /** Whether the winner of a fight takes the losers' items. */
  readonly winnerTakesItems: boolean;
  /** Whether the winner of a fight also takes the location's loot. */
  readonly winnerTakesLoot: boolean;
  /** Target band of finalists, used only to report dead ends. */
  readonly targetFinalists: { readonly min: number; readonly max: number };
}

export interface TeamSetup {
  readonly archetype: string;
  readonly count: number;
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly mapId: string;
  readonly seed: number;
  /** Mix of behaviours. Total count is the number of teams. */
  readonly teams: readonly TeamSetup[];
  /** Overrides merged over the base rules. */
  readonly rules?: Partial<RuleParameters>;
}

export interface Ruleset {
  readonly terrains: ReadonlyMap<string, TerrainType>;
  readonly items: ReadonlyMap<string, ItemDefinition>;
  readonly maps: ReadonlyMap<string, MapDefinition>;
  readonly rules: RuleParameters;
  readonly scenarios: ReadonlyMap<string, ScenarioDefinition>;
}
