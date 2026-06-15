// SCAFFOLD UI — disposable, redesign later. Do not couple business logic here.
// Item detail: full description, notes CRUD, summary generate/regenerate, deep-link out.
import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { api, OfflineError, type ItemDetailDto } from '../api.ts';

@customElement('marginalia-detail')
export class DetailView extends LitElement {
  static styles = css`
    button,
    a.btn {
      font: inherit;
      font-size: 0.85rem;
      border: 1px solid #334;
      background: transparent;
      color: inherit;
      border-radius: 7px;
      padding: 0.35rem 0.6rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .primary { background: #4f46e5; border-color: #4f46e5; color: #fff; }
    h2 { font-family: Georgia, serif; margin: 0.4rem 0; }
    .meta { color: #9aa; font-size: 0.85rem; }
    .row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.6rem 0; }
    .desc { white-space: pre-wrap; line-height: 1.5; color: #cdced3; }
    section { border-top: 1px solid #1c1c24; margin-top: 1rem; padding-top: 0.8rem; }
    textarea {
      width: 100%;
      background: #11131a;
      color: inherit;
      border: 1px solid #334;
      border-radius: 7px;
      padding: 0.5rem;
      font: inherit;
      box-sizing: border-box;
    }
    .note { border: 1px solid #1c1c24; border-radius: 7px; padding: 0.5rem; margin: 0.4rem 0; }
    .summary { white-space: pre-wrap; background: #11131a; border-radius: 7px; padding: 0.6rem; }
    .tag { font-size: 0.75rem; border: 1px solid #334; border-radius: 999px; padding: 0.1rem 0.5rem; }
    .err { color: #f87171; }
    .offline { color: #fbbf24; }
  `;

  @property({ type: String }) itemId = '';
  @state() private item: ItemDetailDto | null = null;
  @state() private error = '';
  @state() private note = '';
  @state() private newTag = '';
  @state() private busy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.item = await api.getItem(this.itemId);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'failed to load';
    }
  }

  private async guard(fn: () => Promise<unknown>): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await fn();
      await this.load();
    } catch (err) {
      this.error = err instanceof OfflineError ? 'offline — change not saved' : 'action failed';
    } finally {
      this.busy = false;
    }
  }

  private back(): void {
    this.dispatchEvent(new CustomEvent('back', { bubbles: true, composed: true }));
  }

  render() {
    if (this.error && !this.item) return html`<div class="err">${this.error}</div>`;
    const item = this.item;
    if (!item) return html`<div class="meta">Loading…</div>`;
    const latestSummary = item.summaries[0];

    return html`
      <button @click=${this.back}>← Back</button>
      <h2>${item.title}</h2>
      <div class="meta">${item.source.title} · ${item.source.type} · status: ${item.status}</div>

      <div class="row">
        <a class="btn primary" href=${item.url} target="_blank" rel="noopener">
          Open in ${item.source.type === 'youtube' ? 'YouTube' : 'Podcast'} ↗
        </a>
        <button @click=${() => this.guard(() => api.setState(item.id, 'queued'))}>Queue</button>
        <button @click=${() => this.guard(() => api.setState(item.id, 'saved'))}>Save</button>
        <button @click=${() => this.guard(() => api.setState(item.id, 'ignored'))}>Ignore</button>
      </div>
      ${this.error ? html`<div class="err">${this.error}</div>` : null}

      <div class="row">
        ${item.tags.map(
          (t) => html`<span class="tag">${t.label}
            <button style="border:0;background:none;color:#f87171;cursor:pointer"
              @click=${() => this.guard(() => api.removeTag(item.id, t.slug))}>×</button></span>`,
        )}
        <input
          placeholder="add tag"
          .value=${this.newTag}
          @input=${(e: Event) => (this.newTag = (e.target as HTMLInputElement).value)}
          style="background:#11131a;color:inherit;border:1px solid #334;border-radius:7px;padding:0.2rem 0.4rem"
        />
        <button
          @click=${() => {
            const label = this.newTag.trim();
            if (label) this.guard(() => api.addTag(item.id, label)).then(() => (this.newTag = ''));
          }}
        >+ tag</button>
      </div>

      <p class="desc">${item.description ?? '(no description)'}</p>

      <section>
        <strong>Summary</strong>
        <div class="row">
          <button class="primary" ?disabled=${this.busy} @click=${() => this.guard(() => api.generateSummary(item.id))}>
            ${latestSummary ? 'Show / cache' : 'Summarize'}
          </button>
          <button ?disabled=${this.busy} @click=${() => this.guard(() => api.generateSummary(item.id, true))}>
            Regenerate
          </button>
        </div>
        ${latestSummary
          ? html`<div class="summary">${latestSummary.body}</div>
              <div class="meta">${latestSummary.model} · ${item.summaries.length} version(s)</div>`
          : html`<div class="meta">No summary yet.</div>`}
      </section>

      <section>
        <strong>Notes</strong>
        ${item.notes.map(
          (n) => html`<div class="note">
            <div class="desc">${n.body}</div>
            <div class="row">
              <button @click=${() => this.editNote(n.id, n.body)}>Edit</button>
              <button @click=${() => this.guard(() => api.deleteNote(n.id))}>Delete</button>
            </div>
          </div>`,
        )}
        <textarea
          rows="3"
          placeholder="Write a note…"
          .value=${this.note}
          @input=${(e: Event) => (this.note = (e.target as HTMLTextAreaElement).value)}
        ></textarea>
        <div class="row">
          <button
            class="primary"
            @click=${() => {
              const body = this.note.trim();
              if (body) this.guard(() => api.addNote(item.id, body)).then(() => (this.note = ''));
            }}
          >Add note</button>
        </div>
      </section>
    `;
  }

  private editNote(noteId: string, current: string): void {
    const next = prompt('Edit note', current);
    if (next != null && next.trim() && next !== current) {
      void this.guard(() => api.updateNote(noteId, next.trim()));
    }
  }
}
