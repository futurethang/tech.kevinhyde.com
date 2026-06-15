// SCAFFOLD UI — disposable, redesign later. Do not couple business logic here.
// Triage list: filters + inline queue/ignore/save, opens detail, deep-links out.
import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api, OfflineError, type ItemListDto, type ItemStatus } from '../api.ts';

const STATUSES: (ItemStatus | '')[] = ['', 'new', 'queued', 'saved', 'ignored'];

@customElement('marginalia-list')
export class ListView extends LitElement {
  static styles = css`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 0.8rem;
    }
    input,
    select {
      background: #11131a;
      color: inherit;
      border: 1px solid #334;
      border-radius: 7px;
      padding: 0.4rem 0.5rem;
      font: inherit;
    }
    input[type='search'] {
      flex: 1;
      min-width: 160px;
    }
    .item {
      display: grid;
      grid-template-columns: 96px 1fr;
      gap: 0.7rem;
      padding: 0.7rem 0;
      border-bottom: 1px solid #1c1c24;
    }
    .item img {
      width: 96px;
      height: 64px;
      object-fit: cover;
      border-radius: 6px;
      background: #1c1c24;
      cursor: pointer;
    }
    .title {
      font-weight: 600;
      cursor: pointer;
    }
    .meta {
      color: #9aa;
      font-size: 0.8rem;
      margin: 0.15rem 0 0.4rem;
    }
    .badge {
      font-size: 0.7rem;
      padding: 0.1rem 0.4rem;
      border-radius: 999px;
      border: 1px solid #334;
      margin-right: 0.3rem;
    }
    .badge.saved { background: #14532d; }
    .badge.queued { background: #1e3a8a; }
    .badge.ignored { background: #3f3f46; }
    .actions {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      margin-top: 0.3rem;
    }
    .actions button,
    .actions a {
      font: inherit;
      font-size: 0.78rem;
      border: 1px solid #334;
      background: transparent;
      color: inherit;
      border-radius: 6px;
      padding: 0.2rem 0.5rem;
      cursor: pointer;
      text-decoration: none;
    }
    .open { border-color: #4f46e5; }
    .msg { color: #9aa; padding: 1rem 0; }
    .err { color: #f87171; }
    .offline { color: #fbbf24; }
  `;

  @state() private items: ItemListDto[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private status: ItemStatus | '' = '';
  @state() private q = '';

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const res = await api.listItems({ status: this.status || undefined, q: this.q || undefined });
      this.items = res.items;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'failed to load';
    } finally {
      this.loading = false;
    }
  }

  private async triage(item: ItemListDto, status: ItemStatus): Promise<void> {
    try {
      await api.setState(item.id, status);
      item.status = status;
      this.requestUpdate();
    } catch (err) {
      this.error = err instanceof OfflineError ? 'offline — change not saved' : 'update failed';
    }
  }

  private open(id: string): void {
    this.dispatchEvent(new CustomEvent('open-item', { detail: { id }, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="filters">
        <input
          type="search"
          placeholder="Search title, notes, summary…"
          .value=${this.q}
          @change=${(e: Event) => {
            this.q = (e.target as HTMLInputElement).value;
            void this.load();
          }}
        />
        <select
          .value=${this.status}
          @change=${(e: Event) => {
            this.status = (e.target as HTMLSelectElement).value as ItemStatus | '';
            void this.load();
          }}
        >
          ${STATUSES.map((s) => html`<option value=${s}>${s || 'all statuses'}</option>`)}
        </select>
        <button @click=${() => this.load()} class="open">Refresh</button>
      </div>

      ${this.error ? html`<div class="err">${this.error}</div>` : null}
      ${this.loading
        ? html`<div class="msg">Loading…</div>`
        : this.items.length === 0
          ? html`<div class="msg">No items. Add real feeds + run an ingest from Sources.</div>`
          : this.items.map((item) => this.renderItem(item))}
    `;
  }

  private renderItem(item: ItemListDto) {
    const date = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '';
    return html`
      <div class="item">
        ${item.thumbnailUrl
          ? html`<img src=${item.thumbnailUrl} alt="" @click=${() => this.open(item.id)} />`
          : html`<div @click=${() => this.open(item.id)} style="cursor:pointer"></div>`}
        <div>
          <div class="title" @click=${() => this.open(item.id)}>${item.title}</div>
          <div class="meta">
            ${item.source.title} · ${item.source.type} ${date ? `· ${date}` : ''}
          </div>
          <div>
            ${item.status !== 'new'
              ? html`<span class="badge ${item.status}">${item.status}</span>`
              : html`<span class="badge">new</span>`}
            ${item.hasSummary ? html`<span class="badge">★ summary</span>` : null}
            ${item.tags.map((t) => html`<span class="badge">${t.label}</span>`)}
          </div>
          <div class="actions">
            <button @click=${() => this.triage(item, 'queued')}>Queue</button>
            <button @click=${() => this.triage(item, 'saved')}>Save</button>
            <button @click=${() => this.triage(item, 'ignored')}>Ignore</button>
            <a class="open" href=${item.url} target="_blank" rel="noopener">Open ↗</a>
            <button @click=${() => this.open(item.id)}>Details</button>
          </div>
        </div>
      </div>
    `;
  }
}
