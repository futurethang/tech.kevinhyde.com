/**
 * Facilitator control panel.
 *
 * Owns only UI state (which team is being handled, which hex is open in the
 * inspector, which debug overlays are on). Every rule question goes to the
 * Simulation; this file never decides what is legal or what a round does.
 */

import type { MapScene } from '../render/MapScene';
import { Simulation } from '../core/simulation';
import { listScenarios, loadScenario } from '../data/registry';
import { buildViewModel, initials, type ViewOptions } from './viewModel';
import type { RoundSummary } from '../core/rounds';

interface UiState {
  scenarioId: string;
  activeTeamId: string | null;
  inspectedHexId: string | null;
  showExitDistance: boolean;
  showSecrets: boolean;
  allowMissingChoices: boolean;
  error: string | null;
  showSnapshot: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'badge',
  at_trailhead: 'badge info',
  escaped: 'badge ok',
  eliminated: 'badge warn',
};

export class SimulatorApp {
  private sim: Simulation;
  private ui: UiState;

  constructor(
    private readonly panel: HTMLElement,
    private readonly scene: MapScene,
    scenarioId: string,
  ) {
    this.sim = new Simulation(loadScenario(scenarioId));
    this.ui = {
      scenarioId,
      activeTeamId: this.sim.activeTeams()[0]?.id ?? null,
      inspectedHexId: null,
      showExitDistance: false,
      showSecrets: false,
      allowMissingChoices: false,
      error: null,
      showSnapshot: false,
    };
    this.scene.setCallbacks({ onHexClick: (hexId) => this.handleHexClick(hexId) });
    this.panel.addEventListener('click', (event) => this.handlePanelClick(event));
    this.panel.addEventListener('change', (event) => this.handlePanelChange(event));
    this.render();
  }

  // --- interaction ---------------------------------------------------------

  private handleHexClick(hexId: string): void {
    this.ui.inspectedHexId = hexId;
    this.ui.error = null;
    const teamId = this.ui.activeTeamId;
    if (teamId !== null && this.sim.legalMoves(teamId).includes(hexId)) {
      try {
        this.sim.select(teamId, hexId);
      } catch (error) {
        this.ui.error = String(error);
      }
    }
    this.render();
  }

  private handlePanelClick(event: Event): void {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
    if (!target) return;
    const { action, teamId, hexId } = target.dataset;
    this.ui.error = null;
    try {
      switch (action) {
        case 'select-team':
          this.ui.activeTeamId = teamId ?? null;
          break;
        case 'commit':
          if (teamId) this.sim.commit(teamId);
          this.ui.activeTeamId = this.nextUncommittedTeamId(teamId);
          break;
        case 'cancel':
          if (teamId) this.sim.cancel(teamId);
          break;
        case 'cancel-all':
          this.sim.cancelAll();
          break;
        case 'resolve':
          this.resolve();
          break;
        case 'reset':
          this.sim.reset();
          this.ui.activeTeamId = this.sim.activeTeams()[0]?.id ?? null;
          break;
        case 'recenter':
          this.scene.centerCamera();
          break;
        case 'inspect-hex':
          this.ui.inspectedHexId = hexId ?? null;
          break;
        case 'toggle-snapshot':
          this.ui.showSnapshot = !this.ui.showSnapshot;
          break;
        default:
          break;
      }
    } catch (error) {
      this.ui.error = error instanceof Error ? error.message : String(error);
    }
    this.render();
  }

  private handlePanelChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement | null;
    if (!target?.dataset.field) return;
    this.ui.error = null;
    const field = target.dataset.field;
    if (field === 'scenario') {
      this.loadScenario((target as HTMLSelectElement).value);
      return;
    }
    const checked = (target as HTMLInputElement).checked;
    if (field === 'showExitDistance') this.ui.showExitDistance = checked;
    if (field === 'showSecrets') this.ui.showSecrets = checked;
    if (field === 'allowMissingChoices') this.ui.allowMissingChoices = checked;
    this.render();
  }

  private loadScenario(scenarioId: string): void {
    try {
      this.sim = new Simulation(loadScenario(scenarioId));
      this.ui = {
        ...this.ui,
        scenarioId,
        activeTeamId: this.sim.activeTeams()[0]?.id ?? null,
        inspectedHexId: null,
        error: null,
      };
    } catch (error) {
      this.ui.error = error instanceof Error ? error.message : String(error);
    }
    this.render();
  }

  private resolve(): void {
    this.sim.resolve(
      this.ui.allowMissingChoices ? { allowMissingChoices: true } : {},
    );
    this.ui.activeTeamId = this.sim.activeTeams()[0]?.id ?? null;
  }

  private nextUncommittedTeamId(afterTeamId?: string): string | null {
    const active = this.sim.activeTeams();
    const startIndex = afterTeamId ? active.findIndex((t) => t.id === afterTeamId) + 1 : 0;
    for (let i = 0; i < active.length; i++) {
      const team = active[(startIndex + i) % active.length]!;
      if (!this.sim.isCommitted(team.id)) return team.id;
    }
    return null;
  }

  // --- rendering -----------------------------------------------------------

  private viewOptions(): ViewOptions {
    return {
      activeTeamId: this.ui.activeTeamId,
      inspectedHexId: this.ui.inspectedHexId,
      showExitDistance: this.ui.showExitDistance,
      showSecrets: this.ui.showSecrets,
      showExploration: true,
    };
  }

  render(): void {
    this.scene.render(buildViewModel(this.sim, this.viewOptions()));
    this.panel.innerHTML = [
      this.renderHeader(),
      this.ui.error ? `<div class="error">${escapeHtml(this.ui.error)}</div>` : '',
      this.renderRoundControls(),
      this.renderTeams(),
      this.renderInspector(),
      this.renderLastRound(),
      this.renderLog(),
      this.renderAnalysis(),
      this.renderSnapshot(),
    ].join('');
  }

  private renderHeader(): string {
    const options = listScenarios()
      .map(
        (s) =>
          `<option value="${s.id}"${s.id === this.ui.scenarioId ? ' selected' : ''}>${escapeHtml(
            s.name,
          )} (${s.teamCount} teams)</option>`,
      )
      .join('');
    const scenario = this.sim.resolved.scenario;
    return `
      <h1>Dept. of Unnatural Forestry</h1>
      <p class="sub">Round simulator — milestone 1</p>
      <select data-field="scenario">${options}</select>
      <p class="sub">${escapeHtml(scenario.description)}</p>
      <p class="sub">map <b>${escapeHtml(this.sim.resolved.map.name)}</b> · seed ${scenario.seed}
        · ${this.sim.board.hexIds.length} hexes · ${this.sim.board.openTrailheadHexIds.length} open trailheads</p>
    `;
  }

  private renderRoundControls(): string {
    const problems = this.sim.problems();
    const active = this.sim.activeTeams().length;
    const committed = this.sim.committedCount();
    const canResolve = this.sim.canResolve() || this.ui.allowMissingChoices;
    const atTrailhead = this.sim.state.teams.filter((t) => t.status === 'at_trailhead').length;
    return `
      <h2>Round ${this.sim.round}</h2>
      <p>
        <span class="badge ${committed === active && active > 0 ? 'ok' : ''}">${committed}/${active} committed</span>
        ${atTrailhead > 0 ? `<span class="badge info">${atTrailhead} at a trailhead</span>` : ''}
      </p>
      <div class="row">
        <button class="primary" data-action="resolve" ${canResolve && active > 0 ? '' : 'disabled'}>
          Resolve round ${this.sim.round}
        </button>
        <button data-action="cancel-all" ${committed + 0 > 0 ? '' : 'disabled'}>Clear choices</button>
        <button class="danger" data-action="reset">Reset scenario</button>
        <button data-action="recenter">Recentre map</button>
      </div>
      <div class="row" style="margin-top:6px">
        <label class="check"><input type="checkbox" data-field="showExitDistance"
          ${this.ui.showExitDistance ? 'checked' : ''}> distance-to-exit overlay</label>
        <label class="check"><input type="checkbox" data-field="showSecrets"
          ${this.ui.showSecrets ? 'checked' : ''}> show hidden contents</label>
        <label class="check"><input type="checkbox" data-field="allowMissingChoices"
          ${this.ui.allowMissingChoices ? 'checked' : ''}> debug: resolve without all choices</label>
      </div>
      ${
        problems.missing.length > 0 && !this.ui.allowMissingChoices
          ? `<p class="sub">waiting on: ${problems.missing.map(escapeHtml).join(', ')}</p>`
          : ''
      }
    `;
  }

  private renderTeams(): string {
    const rows = this.sim.state.teams
      .map((team) => {
        const def = this.sim.teamDefinition(team.id);
        const character = this.sim.resolved.characters.get(def.characterId)!;
        const isActive = this.ui.activeTeamId === team.id;
        const committed = this.sim.isCommitted(team.id);
        const selection = this.sim.selectionFor(team.id);
        const canMove = team.status === 'active';
        // Only the team being handled sees its own pending destination.
        const pendingText = !canMove
          ? '<span class="badge info">awaiting escape test</span>'
          : committed
            ? `<span class="badge ok">locked in${isActive && selection ? ` → ${escapeHtml(selection)}` : ''}</span>`
            : isActive && selection
              ? `<span class="badge">aiming at ${escapeHtml(selection)}</span>`
              : '<span class="badge warn">no choice</span>';
        const buttons = canMove
          ? `<div class="row tight" style="margin-top:4px">
               ${
                 selection && !committed
                   ? `<button data-action="commit" data-team-id="${team.id}">Lock in</button>`
                   : ''
               }
               ${
                 committed || selection
                   ? `<button data-action="cancel" data-team-id="${team.id}">Cancel</button>`
                   : ''
               }
             </div>`
          : '';
        return `
          <div class="team ${isActive ? 'active' : ''} ${canMove ? '' : 'done'}"
               data-action="select-team" data-team-id="${team.id}">
            <div class="spread">
              <span class="team-name"><span class="swatch" style="background:${def.color}"></span>${escapeHtml(
                initials(def.name),
              )} · ${escapeHtml(def.name)}</span>
              <span class="${STATUS_BADGE[team.status] ?? 'badge'}">${team.status.replace('_', ' ')}</span>
            </div>
            <div class="team-meta">
              ${escapeHtml(character.name)} · on <b>${escapeHtml(team.hexId)}</b>
              · ${team.visited.length - 1} moves · ${team.encounterCount} encounters
              ${team.items.length ? `· carrying ${team.items.map(escapeHtml).join(', ')}` : ''}
            </div>
            <div style="margin-top:3px">${pendingText}</div>
            ${buttons}
          </div>`;
      })
      .join('');
    return `<h2>Teams</h2>
      <p class="sub">Click a team, then click a highlighted hex on the map, then lock it in.</p>
      ${rows}`;
  }

  private renderInspector(): string {
    const hexId = this.ui.inspectedHexId;
    if (hexId === null) return '<h2>Hex inspector</h2><p class="sub">Click a hex on the map.</p>';
    const hex = this.sim.board.hex(hexId);
    const terrain = this.sim.resolved.terrains.get(hex.terrain)!;
    const distance = this.sim.analysis.exitDistance.dist.get(hexId);
    const trailhead = this.sim.board.trailheadAt(hexId);
    const occupants = this.sim.occupancy().get(hexId) ?? [];
    const contents = this.sim.board.contentsAt(hexId);
    const revealed = this.sim.state.revealedHexIds.includes(hexId);
    const showContents = this.ui.showSecrets || revealed;
    return `
      <h2>Hex ${escapeHtml(hexId)}</h2>
      <table>
        <tr><th>coords</th><td>q ${hex.q}, r ${hex.r}</td></tr>
        <tr><th>terrain</th><td>${escapeHtml(terrain.label)}${terrain.passable ? '' : ' (impassable)'}</td></tr>
        <tr><th>visible clue</th><td>${escapeHtml(terrain.visibleClue)}</td></tr>
        <tr><th>signals</th><td>risk ${terrain.signals.risk} · reward ${terrain.signals.reward}</td></tr>
        <tr><th>neighbours</th><td>${this.sim.board.neighbors(hexId).map(escapeHtml).join(', ') || '—'}</td></tr>
        <tr><th>passable</th><td>${this.sim.board.passableNeighbors(hexId).map(escapeHtml).join(', ') || '—'}</td></tr>
        <tr><th>exit distance</th><td>${distance === undefined ? 'unreachable' : `${distance} move(s)`}</td></tr>
        <tr><th>trailhead</th><td>${
          trailhead ? `${escapeHtml(trailhead.name)} (${trailhead.closed ? 'closed' : 'open'})` : '—'
        }</td></tr>
        <tr><th>occupants</th><td>${occupants.map(escapeHtml).join(', ') || '—'}</td></tr>
        <tr><th>contents</th><td>${
          contents.length === 0
            ? '—'
            : showContents
              ? contents
                  .map((c) => `${c.kind}: ${escapeHtml(c.label)}${c.note ? ` — ${escapeHtml(c.note)}` : ''}`)
                  .join('<br>')
              : `${contents.length} hidden (enable “show hidden contents”)`
        }</td></tr>
      </table>`;
  }

  private renderLastRound(): string {
    const last = this.sim.history.at(-1);
    if (!last) return '';
    return `
      <h2>Round ${last.round} summary</h2>
      ${summaryTable(last)}
      ${
        last.encounters.length === 0
          ? '<p class="sub">no encounters</p>'
          : `<p class="sub">encounters: ${last.encounters
              .map((e) => `${e.kind} on ${escapeHtml(e.hexId)} (${e.teamIds.map(escapeHtml).join(' + ')})`)
              .join('; ')}</p>`
      }`;
  }

  private renderLog(): string {
    if (this.sim.log.length === 0) return '';
    let lastRound = -1;
    const lines = this.sim.log
      .map((event) => {
        const rule = event.round !== lastRound;
        lastRound = event.round;
        return `<div class="t-${event.type}${rule ? ' round-rule' : ''}">R${event.round} ${escapeHtml(
          event.message,
        )}</div>`;
      })
      .join('');
    return `<h2>Event log (${this.sim.log.length})</h2><div class="log">${lines}</div>`;
  }

  private renderAnalysis(): string {
    const a = this.sim.analysis;
    const rows = a.starts
      .map((start) => {
        const teamId =
          this.sim.resolved.scenario.teams.find((t) => t.startHexId === start.hexId)?.id ?? '—';
        return `<tr>
          <td><a href="#" data-action="inspect-hex" data-hex-id="${start.hexId}">${escapeHtml(
            start.hexId,
          )}</a></td>
          <td>${escapeHtml(teamId)}</td>
          <td>${start.nearestExitDistance ?? '—'}</td>
          <td>${start.optimalFirstSteps.length}/${start.detourFirstSteps.length}</td>
          <td>${start.shortestRouteCount}</td>
          <td>${start.reachableTrailheadCount}</td>
        </tr>`;
      })
      .join('');
    const spread = a.startDistance;
    return `
      <h2>Route analysis</h2>
      <p class="sub">${a.passableHexCount}/${a.hexCount} hexes passable ·
        ${spread ? `nearest exit min ${spread.min}, max ${spread.max}, mean ${spread.mean.toFixed(2)}` : 'no reachable exits'}</p>
      <table>
        <tr><th>start</th><th>team</th><th>exit</th><th>opt/detour</th><th>routes</th><th>exits</th></tr>
        ${rows}
      </table>
      ${
        a.strandedHexIds.length
          ? `<p class="sub">stranded hexes: ${a.strandedHexIds.map(escapeHtml).join(', ')}</p>`
          : ''
      }
      ${
        a.unreachableTrailheadIds.length
          ? `<p class="sub">unreachable trailheads: ${a.unreachableTrailheadIds.map(escapeHtml).join(', ')}</p>`
          : ''
      }`;
  }

  private renderSnapshot(): string {
    return `
      <h2>State</h2>
      <button data-action="toggle-snapshot">${this.ui.showSnapshot ? 'Hide' : 'Show'} raw state JSON</button>
      ${
        this.ui.showSnapshot
          ? `<pre>${escapeHtml(JSON.stringify(this.sim.snapshot(), null, 2))}</pre>`
          : ''
      }`;
  }
}

function summaryTable(summary: RoundSummary): string {
  const rows = summary.moves
    .map(
      (m) => `<tr>
        <td>${escapeHtml(m.teamId)}</td>
        <td>${escapeHtml(m.fromHexId)} → ${escapeHtml(m.toHexId)}</td>
        <td>${m.outcome}</td>
        <td>${m.reachedTrailheadId ? escapeHtml(m.reachedTrailheadId) : ''}</td>
        <td>${m.encounteredTeamIds.map(escapeHtml).join(', ')}</td>
      </tr>`,
    )
    .join('');
  return `<table>
    <tr><th>team</th><th>move</th><th>outcome</th><th>trailhead</th><th>met</th></tr>
    ${rows}
  </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
