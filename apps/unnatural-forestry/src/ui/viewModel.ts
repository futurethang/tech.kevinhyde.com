/**
 * Builds the renderer's view model from the simulation plus the facilitator's
 * current UI state. Pure and Phaser-free: the renderer draws exactly what it
 * is given and asks the simulation nothing.
 *
 * This is also where information hiding lives. A committed destination is only
 * included for the team currently being handled, so the board does not leak
 * other teams' pending moves.
 */

import type { MapAnalysis } from '../core/analysis';
import type { Simulation } from '../core/simulation';
import type { TeamStatus } from '../core/state';

export type HexHighlight = 'none' | 'legal' | 'selected' | 'inspected';

export interface HexView {
  readonly id: string;
  readonly q: number;
  readonly r: number;
  readonly label: string;
  readonly fill: string;
  readonly impassable: boolean;
  readonly explored: boolean;
  readonly trailhead: { readonly id: string; readonly closed: boolean } | null;
  readonly highlight: HexHighlight;
  /** Small corner text: distance-to-exit overlay, when enabled. */
  readonly overlayText: string | null;
  /** True when this hex holds contents the table has already seen. */
  readonly revealedContent: boolean;
  /** True when this hex holds contents and secrets are being shown. */
  readonly secretContent: boolean;
}

export interface TokenView {
  readonly teamId: string;
  readonly label: string;
  readonly color: string;
  readonly hexId: string;
  readonly status: TeamStatus;
  readonly dx: number;
  readonly dy: number;
  /** Drawn only for the team being handled right now. */
  readonly pendingHexId: string | null;
}

export interface MapViewModel {
  readonly hexSize: number;
  readonly hexes: readonly HexView[];
  readonly tokens: readonly TokenView[];
}

export interface ViewOptions {
  /** The team whose legal moves and pending destination are on screen. */
  readonly activeTeamId: string | null;
  /** The hex open in the inspector. */
  readonly inspectedHexId: string | null;
  /** Show distance-to-nearest-exit numbers on every hex. */
  readonly showExitDistance: boolean;
  /** Show hidden contents markers (facilitator / debug only). */
  readonly showSecrets: boolean;
  /** Dim hexes no team has visited. */
  readonly showExploration: boolean;
  /**
   * Facilitator/debug override: draw every team's pending destination, not just
   * the one being handled. Off during real play — it is exactly the information
   * the normal selection interface is meant to hide.
   */
  readonly revealAllPending: boolean;
}

export function buildViewModel(
  sim: Simulation,
  options: ViewOptions,
  analysis: MapAnalysis = sim.analysis,
): MapViewModel {
  const explored = sim.exploredHexIds();
  const revealed = new Set(sim.state.revealedHexIds);
  const activeTeam = options.activeTeamId;
  const legal = activeTeam !== null ? new Set(sim.legalMoves(activeTeam)) : new Set<string>();

  // Which pending destinations may be drawn at all.
  const pendingByTeam = new Map<string, string>();
  if (options.revealAllPending) {
    for (const team of sim.state.teams) {
      const choice = sim.selectionFor(team.id);
      if (choice !== undefined) pendingByTeam.set(team.id, choice);
    }
  } else if (activeTeam !== null) {
    const choice = sim.selectionFor(activeTeam);
    if (choice !== undefined) pendingByTeam.set(activeTeam, choice);
  }
  const pendingHexes = new Set(pendingByTeam.values());

  const hexes = sim.board.map.hexes.map<HexView>((hex) => {
    const terrain = sim.resolved.terrains.get(hex.terrain)!;
    const trailhead = sim.board.trailheadAt(hex.id);
    const highlight: HexHighlight =
      pendingHexes.has(hex.id)
        ? 'selected'
        : options.inspectedHexId === hex.id
          ? 'inspected'
          : legal.has(hex.id)
            ? 'legal'
            : 'none';
    const distance = analysis.exitDistance.dist.get(hex.id);
    return {
      id: hex.id,
      q: hex.q,
      r: hex.r,
      label: hex.id,
      fill: terrain.color,
      impassable: !terrain.passable,
      explored: explored.has(hex.id),
      trailhead: trailhead ? { id: trailhead.id, closed: trailhead.closed } : null,
      highlight,
      overlayText: options.showExitDistance ? (distance === undefined ? '-' : String(distance)) : null,
      revealedContent: revealed.has(hex.id) && sim.board.contentsAt(hex.id).length > 0,
      secretContent: options.showSecrets && sim.board.contentsAt(hex.id).length > 0,
    };
  });

  const occupancy = sim.occupancy();
  const tokens: TokenView[] = [];
  for (const [hexId, teamIds] of occupancy) {
    const sorted = [...teamIds].sort();
    sorted.forEach((teamId, index) => {
      const def = sim.teamDefinition(teamId);
      const team = sim.team(teamId);
      const { dx, dy } = stackOffset(index, sorted.length);
      tokens.push({
        teamId,
        label: initials(def.name),
        color: def.color,
        hexId,
        status: team.status,
        dx,
        dy,
        pendingHexId: pendingByTeam.get(teamId) ?? null,
      });
    });
  }
  return { hexSize: sim.board.map.layout.hexSize, hexes, tokens };
}

/** Unit-circle offsets for stacking co-located tokens; scaled by the renderer. */
export function stackOffset(index: number, count: number): { dx: number; dy: number } {
  if (count <= 1) return { dx: 0, dy: 0 };
  const angle = (2 * Math.PI * index) / count - Math.PI / 2;
  return { dx: Math.cos(angle), dy: Math.sin(angle) };
}

/** Up to three letters from a team name, for the token face. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
