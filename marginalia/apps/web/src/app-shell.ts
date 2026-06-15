// SCAFFOLD UI — disposable, redesign later. Do not couple business logic here.
// App shell: token gate + simple routing between list / detail / sources views.
import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getToken, clearToken } from './idb.ts';
import './auth-gate.ts';
import './views/list.ts';
import './views/detail.ts';
import './views/sources.ts';

type View = 'list' | 'detail' | 'sources';

@customElement('marginalia-app')
export class AppShell extends LitElement {
  static styles = css`
    :host {
      display: block;
      color: #e7e7ea;
      background: #0b0b0f;
      min-height: 100dvh;
      font-family: system-ui, sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      display: flex;
      gap: 0.5rem;
      align-items: center;
      padding: 0.6rem 0.9rem;
      background: #11131a;
      border-bottom: 1px solid #222;
    }
    header .brand {
      font-family: Georgia, serif;
      font-weight: 700;
      margin-right: auto;
    }
    nav button,
    header button {
      background: transparent;
      border: 1px solid #334;
      color: inherit;
      border-radius: 7px;
      padding: 0.35rem 0.6rem;
      cursor: pointer;
      font: inherit;
    }
    nav button[aria-current='true'] {
      background: #4f46e5;
      border-color: #4f46e5;
    }
    main {
      padding: 0.9rem;
      max-width: 920px;
      margin: 0 auto;
    }
  `;

  @state() private authed = false;
  @state() private ready = false;
  @state() private view: View = 'list';
  @state() private selectedId: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this.checkToken();
    this.addEventListener('token-set', () => {
      this.authed = true;
    });
    this.addEventListener('open-item', (e: Event) => {
      this.selectedId = (e as CustomEvent<{ id: string }>).detail.id;
      this.view = 'detail';
    });
    this.addEventListener('back', () => {
      this.view = 'list';
      this.selectedId = null;
    });
  }

  private async checkToken(): Promise<void> {
    this.authed = (await getToken()) != null;
    this.ready = true;
  }

  private async logout(): Promise<void> {
    await clearToken();
    this.authed = false;
    this.view = 'list';
  }

  private nav(view: View): void {
    this.view = view;
    this.selectedId = null;
  }

  render() {
    if (!this.ready) return html``;
    if (!this.authed) return html`<marginalia-auth-gate></marginalia-auth-gate>`;

    return html`
      <header>
        <span class="brand">Marginalia</span>
        <nav>
          <button aria-current=${this.view === 'list'} @click=${() => this.nav('list')}>Triage</button>
          <button aria-current=${this.view === 'sources'} @click=${() => this.nav('sources')}>Sources</button>
        </nav>
        <button @click=${this.logout} title="Forget token">Logout</button>
      </header>
      <main>${this.renderView()}</main>
    `;
  }

  private renderView() {
    if (this.view === 'sources') return html`<marginalia-sources></marginalia-sources>`;
    if (this.view === 'detail' && this.selectedId) {
      return html`<marginalia-detail .itemId=${this.selectedId}></marginalia-detail>`;
    }
    return html`<marginalia-list></marginalia-list>`;
  }
}
