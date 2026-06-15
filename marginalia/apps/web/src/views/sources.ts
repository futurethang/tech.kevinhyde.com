// SCAFFOLD UI — disposable, redesign later. Do not couple business logic here.
// Sources health + "Refresh now" (ingest/run) + "Sync config" (sources/sync).
import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api, type SourceDto } from '../api.ts';

@customElement('marginalia-sources')
export class SourcesView extends LitElement {
  static styles = css`
    .row { display: flex; gap: 0.5rem; margin-bottom: 0.8rem; flex-wrap: wrap; }
    button {
      font: inherit;
      border: 1px solid #334;
      background: transparent;
      color: inherit;
      border-radius: 7px;
      padding: 0.4rem 0.7rem;
      cursor: pointer;
    }
    .primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
    .src { border-bottom: 1px solid #1c1c24; padding: 0.6rem 0; }
    .name { font-weight: 600; }
    .meta { color: #9aa; font-size: 0.82rem; margin-top: 0.2rem; }
    .ok { color: #4ade80; }
    .bad { color: #f87171; }
    .off { color: #fbbf24; }
    .note { color: #9aa; font-size: 0.85rem; }
  `;

  @state() private sources: SourceDto[] = [];
  @state() private status = '';
  @state() private busy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.sources = await api.listSources();
    } catch (err) {
      this.status = err instanceof Error ? err.message : 'failed to load';
    }
  }

  private async refresh(): Promise<void> {
    this.busy = true;
    this.status = 'Polling feeds…';
    try {
      const r = await api.runIngest();
      this.status = `Ingest: ${r.fetched} fetched, ${r.created} new, ${r.errors} error(s)`;
      await this.load();
    } catch {
      this.status = 'ingest failed';
    } finally {
      this.busy = false;
    }
  }

  private async sync(): Promise<void> {
    this.busy = true;
    try {
      const r = await api.syncSources();
      this.status = `Synced config: ${r.upserted} upserted, ${r.deactivated} deactivated`;
      await this.load();
    } catch {
      this.status = 'sync failed';
    } finally {
      this.busy = false;
    }
  }

  render() {
    return html`
      <div class="row">
        <button class="primary" ?disabled=${this.busy} @click=${() => this.refresh()}>Refresh now</button>
        <button ?disabled=${this.busy} @click=${() => this.sync()}>Sync config</button>
      </div>
      ${this.status ? html`<div class="note">${this.status}</div>` : null}
      ${this.sources.map((s) => this.renderSource(s))}
    `;
  }

  private renderSource(s: SourceDto) {
    const polled = s.lastPolledAt ? new Date(s.lastPolledAt).toLocaleString() : 'never';
    const health =
      s.lastStatus === 'ok'
        ? html`<span class="ok">ok</span>`
        : s.lastStatus === 'error'
          ? html`<span class="bad">error: ${s.lastError ?? ''}</span>`
          : html`<span class="off">not polled</span>`;
    return html`
      <div class="src">
        <div class="name">${s.title} ${s.active ? '' : html`<span class="off">(inactive)</span>`}</div>
        <div class="meta">${s.slug} · ${s.type} · last polled: ${polled} · ${health}</div>
      </div>
    `;
  }
}
