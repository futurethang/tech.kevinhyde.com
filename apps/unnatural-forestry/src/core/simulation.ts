/**
 * Facilitator-facing controller around the pure core.
 *
 * Holds the current state, the per-team pending selections, the committed
 * choices and the round history. All rule decisions are delegated to
 * rounds.ts / state.ts; this class only sequences them and keeps the UI honest
 * about what has been committed.
 */

import { createBoard, type Board } from './board';
import { analyzeMap, type MapAnalysis } from './analysis';
import { createRng, type Rng } from './rng';
import { summarizeRun, type RunStats } from './stats';
import {
  chooseAllMoves,
  DEFAULT_STRATEGY_ID,
  getStrategy,
  type StrategyDefinition,
} from './strategy';
import {
  resolveRound,
  validateChoices,
  type ChoiceProblems,
  type ResolveOptions,
  type RoundSummary,
  type SimEvent,
} from './rounds';
import {
  activeTeams,
  createInitialState,
  exploredHexIds,
  findTeam,
  legalMoves,
  occupancy,
  type SimState,
  type TeamState,
} from './state';
import type { ResolvedScenario, TeamDefinition } from './types';

export class Simulation {
  readonly board: Board;
  private current: SimState;
  /** Tentative, not yet locked. */
  private selections = new Map<string, string>();
  /** Locked choices that the next resolution will use. */
  private committed = new Map<string, string>();
  private summaries: RoundSummary[] = [];
  private events: SimEvent[] = [];
  private cachedAnalysis: MapAnalysis | null = null;
  /**
   * Draws for scripted movement come from their own stream, so auto-filling a
   * round never perturbs the RNG that resolution carries in SimState. Re-rolling
   * advances it, which is what makes the button give a different answer each
   * press while a run replays identically from a reset.
   */
  private strategyRng: Rng;

  constructor(readonly resolved: ResolvedScenario) {
    this.board = createBoard(resolved.map, resolved.terrains);
    this.current = createInitialState(resolved);
    this.strategyRng = createRng(resolved.scenario.seed ^ 0x5f3a7c1d);
  }

  get state(): SimState {
    return this.current;
  }

  get round(): number {
    return this.current.round;
  }

  get history(): readonly RoundSummary[] {
    return this.summaries;
  }

  get log(): readonly SimEvent[] {
    return this.events;
  }

  /** Route analysis for the scenario's start positions. Computed once. */
  get analysis(): MapAnalysis {
    this.cachedAnalysis ??= analyzeMap(
      this.board,
      this.resolved.scenario.teams.map((t) => t.startHexId),
    );
    return this.cachedAnalysis;
  }

  teamDefinition(teamId: string): TeamDefinition {
    const def = this.resolved.scenario.teams.find((t) => t.id === teamId);
    if (!def) throw new Error(`unknown team "${teamId}"`);
    return def;
  }

  team(teamId: string): TeamState {
    return findTeam(this.current, teamId);
  }

  activeTeams(): readonly TeamState[] {
    return activeTeams(this.current);
  }

  legalMoves(teamId: string): readonly string[] {
    return legalMoves(this.board, this.resolved, this.team(teamId));
  }

  exploredHexIds(): Set<string> {
    return exploredHexIds(this.current);
  }

  occupancy(): Map<string, string[]> {
    return occupancy(this.current);
  }

  // --- selection / commitment ---------------------------------------------

  /** Tentatively aim a team at a hex. Throws if the destination is illegal. */
  select(teamId: string, hexId: string): void {
    const legal = this.legalMoves(teamId);
    if (!legal.includes(hexId)) {
      throw new Error(`"${hexId}" is not a legal destination for team "${teamId}"`);
    }
    this.selections.set(teamId, hexId);
  }

  /** Lock in a team's selection so the round can resolve. */
  commit(teamId: string): void {
    const selection = this.selections.get(teamId);
    if (selection === undefined) throw new Error(`team "${teamId}" has nothing selected`);
    this.committed.set(teamId, selection);
  }

  /** Select and lock in one step — what the facilitator usually wants. */
  selectAndCommit(teamId: string, hexId: string): void {
    this.select(teamId, hexId);
    this.commit(teamId);
  }

  /** Cancel a team's selection and commitment for this round. */
  cancel(teamId: string): void {
    this.selections.delete(teamId);
    this.committed.delete(teamId);
  }

  cancelAll(): void {
    this.selections.clear();
    this.committed.clear();
  }

  selectionFor(teamId: string): string | undefined {
    return this.selections.get(teamId);
  }

  isCommitted(teamId: string): boolean {
    return this.committed.has(teamId);
  }

  committedCount(): number {
    return this.committed.size;
  }

  problems(): ChoiceProblems {
    return validateChoices(this.board, this.resolved, this.current, this.committed);
  }

  /** True when every active team has committed. */
  canResolve(): boolean {
    const p = this.problems();
    return p.missing.length === 0 && p.illegal.length === 0 && p.ineligible.length === 0;
  }

  // --- rounds --------------------------------------------------------------

  /**
   * Resolves the round from the committed choices. Pass
   * `{ allowMissingChoices: true }` to override the all-committed gate in
   * debug mode; uncommitted teams then hold position.
   */
  resolve(options: ResolveOptions = {}): RoundSummary {
    const { state, summary } = resolveRound(
      this.board,
      this.resolved,
      this.current,
      new Map(this.committed),
      options,
    );
    this.current = state;
    this.summaries.push(summary);
    this.events.push(...summary.events);
    this.cancelAll();
    return summary;
  }

  reset(): void {
    this.current = createInitialState(this.resolved);
    this.summaries = [];
    this.events = [];
    this.strategyRng = createRng(this.resolved.scenario.seed ^ 0x5f3a7c1d);
    this.cancelAll();
  }

  // --- scripted play -------------------------------------------------------

  /**
   * Replaces every active team's choice with one drawn from `strategyId`, and
   * commits them. Returns the teams left without a choice because they have no
   * legal move at all — normally none.
   */
  autoFillChoices(strategyId: string = DEFAULT_STRATEGY_ID): string[] {
    const strategy: StrategyDefinition = getStrategy(strategyId);
    this.cancelAll();
    const picks = chooseAllMoves(
      this.board,
      this.resolved,
      this.current,
      this.analysis.exitDistance,
      this.strategyRng,
      strategy.weights,
    );
    for (const [teamId, hexId] of picks) this.selectAndCommit(teamId, hexId);
    return this.activeTeams()
      .filter((team) => !picks.has(team.id))
      .map((team) => team.id);
  }

  /** Auto-fills and resolves one round. */
  autoPlayRound(strategyId: string = DEFAULT_STRATEGY_ID): RoundSummary {
    const stuck = this.autoFillChoices(strategyId);
    return this.resolve(stuck.length > 0 ? { allowMissingChoices: true } : {});
  }

  /**
   * Plays rounds until no team is active or the round cap is hit. The cap
   * defaults to the scenario's advisory `maxRounds`, since a wandering strategy
   * may never reach an exit.
   */
  autoPlayToEnd(
    strategyId: string = DEFAULT_STRATEGY_ID,
    maxRounds: number = this.resolved.scenario.rules.maxRounds,
  ): RoundSummary[] {
    const played: RoundSummary[] = [];
    while (this.activeTeams().length > 0 && played.length < maxRounds) {
      played.push(this.autoPlayRound(strategyId));
    }
    return played;
  }

  /** Measured outcomes of the run so far. */
  stats(): RunStats {
    return summarizeRun(this.board, this.current, this.summaries);
  }

  /** JSON-serialisable dump of everything mutable, for the inspector. */
  snapshot(): unknown {
    return {
      scenarioId: this.resolved.scenario.id,
      mapId: this.resolved.map.id,
      seed: this.resolved.scenario.seed,
      rules: this.resolved.scenario.rules,
      state: this.current,
      pending: {
        selections: Object.fromEntries(this.selections),
        committed: Object.fromEntries(this.committed),
      },
      strategyRngState: this.strategyRng.state,
      stats: this.stats(),
      history: this.summaries,
    };
  }
}
