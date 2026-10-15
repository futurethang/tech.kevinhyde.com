/**
 * The Dark Forest ruleset — static configuration types.
 *
 * Every type here mirrors a JSON file under `src/data/forest/`. The branching
 * of a round is code (see resolve.ts) because it is genuinely conditional
 * logic; everything that is a *number* — how much an item is worth in a fight,
 * how wide the skill spread is, how many locations are in a band — is data,
 * because those are the knobs that decide whether the game works.
 */

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
  /** What this part of the map looks like. Direction for the illustration. */
  readonly terrainStyle: string;
  /** Base colour for the layout drawing; the artwork can depart from it. */
  readonly colour: string;
  /** 1-4. Flavour, not a haunted house. */
  readonly spookiness: number;
}

export interface LocationDefinition {
  readonly id: string;
  readonly name: string;
  /** The trivia theme of a matchup fought here, and what the place looks like. */
  readonly topic: string;
  /** You can see a long way from here: survive and the Director tells you something. */
  readonly vantage: boolean;
  /** Treasure visible on the printed map. It is the bait that makes crowds. */
  readonly loot: readonly string[];
}

export interface BandDefinition {
  readonly id: string;
  readonly name: string;
  /** Light and mood for this ring of the map. It gets later as you go in. */
  readonly timeOfDay: string;
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
   * Before the showdown, every team left draws one card: half the pile helps,
   * half of it bites. A curveball, not a new rule.
   */
  readonly chaosDrawAtTheTrailhead: boolean;
  /** The share of that pile that is good news. */
  readonly chanceTheChaosDrawIsGood: number;

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
  readonly topics: ReadonlyMap<string, TopicDefinition>;
  readonly items: ReadonlyMap<string, ItemDefinition>;
  readonly maps: ReadonlyMap<string, MapDefinition>;
  readonly rules: RuleParameters;
  readonly scenarios: ReadonlyMap<string, ScenarioDefinition>;
}
