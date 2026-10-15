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
  /** A helper makes your own question easier; a hindrance makes theirs harder. */
  readonly kind: 'helper' | 'hindrance';
  /** What it does in the quiz, in plain words. Printed on the token. */
  readonly effect: string;
  readonly symbol: string;
}

export interface TopicDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly symbol: string;
}

export interface LocationDefinition {
  readonly id: string;
  readonly name: string;
  readonly terrain: string;
  /** The trivia theme of a matchup fought here. Printed on the map. */
  readonly topic: string;
  /** Treasure visible on the printed map. It is the bait that makes crowds. */
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
 * How a matchup is decided. The real thing is a trivia duel; this is a stand-in
 * that lets us ask whether the items decide everything or whether knowing the
 * answers still matters.
 *
 *   score = how good they are at trivia + what their items are worth + luck
 */
export interface MatchupModel {
  /** How much team-to-team trivia ability varies. Bigger = skill matters more. */
  readonly triviaSkillRange: number;
  /**
   * How much of a team's ability is tied to the specific theme rather than
   * being good at trivia generally. 0 = themes are decoration; 1 = all that
   * matters is whether you picked a subject you know.
   */
  readonly howMuchDependsOnTheTheme: number;
  /** What one item is worth. Bigger = the items decide it. */
  readonly helpPerItem: number;
  /** How much the luck of the question matters. Bigger = anyone can win. */
  readonly luckRange: number;
  /** Extra luck in the showdown at the Trailhead — the dice, the chaos. */
  readonly extraChaosAtTheTrailhead: number;
}

export interface RuleParameters {
  readonly matchup: MatchupModel;

  /** Items every team draws, at random, before the game starts. */
  readonly itemsDrawnAtStart: number;
  /** Treasure drawn by the team that wins a matchup. */
  readonly treasureForWinningAMatchup: number;
  /** Whether the winner also keeps everything the loser was carrying. */
  readonly winnerAlsoTakesTheLosersItems: boolean;

  /** Traps laid by each team as it goes out. */
  readonly trapsSetByEachLoser: number;
  /** Items a trap strips from each team that walks into it. */
  readonly itemsLostToATrap: number;
  /** The round from which traps are in play (1-based). */
  readonly trapsStartFromRound: number;

  /** Whether a team alone somewhere picks up what is lying there. */
  readonly aTeamAloneTakesWhatIsLyingThere: boolean;
  /** Whether the winner of a matchup picks up what is lying there. */
  readonly theWinnerTakesWhatIsLyingThere: boolean;

  /**
   * When true there is no hunting or hiding: any two teams in the same place
   * have a matchup. When false, terrain and posture decide whether they meet.
   */
  readonly everyMeetingIsAMatchup: boolean;
  /** Only read when `everyMeetingIsAMatchup` is false. */
  readonly hidingInDeepCoverAlwaysWorks: boolean;
  /** Only read when `everyMeetingIsAMatchup` is false. */
  readonly itemsLostByHuntingAndFindingNobody: number;

  /** How many teams we want to reach the Trailhead. Used to report problems. */
  readonly targetTeamsAtTheTrailhead: { readonly min: number; readonly max: number };
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
  readonly topics: ReadonlyMap<string, TopicDefinition>;
  readonly items: ReadonlyMap<string, ItemDefinition>;
  readonly maps: ReadonlyMap<string, MapDefinition>;
  readonly rules: RuleParameters;
  readonly scenarios: ReadonlyMap<string, ScenarioDefinition>;
}
