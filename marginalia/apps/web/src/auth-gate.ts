// SCAFFOLD UI — disposable, redesign later. Do not couple business logic here.
// One-field access-token screen (§3.8). Stores the token in IndexedDB and emits
// `token-set` so the shell can proceed.
import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { setToken } from './idb.ts';

@customElement('marginalia-auth-gate')
export class AuthGate extends LitElement {
  static styles = css`
    :host {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 1rem;
    }
    form {
      width: min(420px, 100%);
      display: grid;
      gap: 0.75rem;
    }
    h1 {
      margin: 0 0 0.25rem;
      font-family: Georgia, serif;
    }
    p {
      margin: 0;
      color: var(--muted, #9aa);
      font-size: 0.9rem;
    }
    input {
      padding: 0.6rem 0.7rem;
      border-radius: 8px;
      border: 1px solid #334;
      background: #11131a;
      color: inherit;
      font: inherit;
    }
    button {
      padding: 0.6rem;
      border-radius: 8px;
      border: 0;
      background: #4f46e5;
      color: #fff;
      font: inherit;
      cursor: pointer;
    }
    .err {
      color: #f87171;
      font-size: 0.85rem;
    }
  `;

  @state() private value = '';
  @state() private error = '';

  private async submit(e: Event): Promise<void> {
    e.preventDefault();
    const token = this.value.trim();
    if (!token) {
      this.error = 'Enter your access token.';
      return;
    }
    await setToken(token);
    this.dispatchEvent(new CustomEvent('token-set', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <form @submit=${this.submit}>
        <h1>Marginalia</h1>
        <p>Enter your access token to continue.</p>
        <input
          type="password"
          autocomplete="off"
          placeholder="APP_TOKEN"
          .value=${this.value}
          @input=${(e: Event) => (this.value = (e.target as HTMLInputElement).value)}
        />
        ${this.error ? html`<div class="err">${this.error}</div>` : null}
        <button type="submit">Continue</button>
      </form>
    `;
  }
}
