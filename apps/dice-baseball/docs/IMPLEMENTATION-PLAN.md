# Design Implementation Plan: v5 → Frontend

## Executive Summary

This document bridges the v5 design specification (`docs/design-preview-v5.html`) to the existing React frontend. It is structured as a layered implementation plan for Claude Code agents working in sequence. Each layer has explicit inputs, outputs, validation gates, and safety constraints.

**Key safety finding:** All 6 Playwright E2E tests use `data-testid` selectors exclusively. Zero CSS class selectors, zero text content matchers, zero role-based locators. This means styling changes cannot break functional tests. The only contract we must preserve is: `data-testid` attributes, component prop APIs, and URL routing.

---

## Pre-Flight Checklist

Before any agent touches code, verify:

```bash
# 1. Backend tests pass (209 tests)
cd apps/dice-baseball/backend && pnpm test

# 2. Frontend builds clean
cd apps/dice-baseball/frontend && pnpm build

# 3. E2E smoke test passes
cd apps/dice-baseball/frontend && pnpm e2e:autoplay
```

If any of these fail, STOP. Fix before proceeding.

---

## Architecture Overview

```
Layer 0: Foundation  ─── Tokens, fonts, SVG filters, config cleanup
Layer 1: Utilities   ─── Texture utility classes (gloss, ink-bleed, aged-edge, paper-grain)
Layer 2: Common      ─── Button, Card, Input/Select/SearchInput restyle
Layer 3: Layout      ─── Header, PageContainer restyle
Layer 4: Game        ─── BoxScore, MatchupDisplay, Diamond, Scoreboard restyle
Layer 5: Pages       ─── Page-level composition and texture application
```

Each layer depends only on the layers above it. Agents can work on Layer 0 and Layer 1 concurrently. Layers 2-5 are sequential.

---

## Layer 0: Foundation

**Agent assignment:** Agent A (solo, first)
**Risk level:** LOW — no component changes, no DOM changes
**Files to modify:**
- `frontend/index.html`
- `frontend/src/index.css`
- `frontend/src/App.tsx` (SVG filter insertion only)

**Files to DELETE:**
- `frontend/tailwind.config.js` (vestigial v3 config — superseded by @theme in index.css)

### 0.1 — Font Loading (index.html)

**Current state:** Loads Inter, Oswald, JetBrains Mono
**Target state:** Add Pacifico and Doto

Replace the Google Fonts `<link>` with:
```html
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Pacifico&family=Doto:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

### 0.2 — Design Tokens (index.css)

Replace the entire `@theme` block with the v5 token system. The current tokens use a green/brown palette that is being replaced entirely.

```css
@import 'tailwindcss';

@theme {
  /* ===== SURFACES (dark navy palette) ===== */
  --color-surface-page: #1a1a2e;       /* Deep Night — page background */
  --color-surface-card: #16213e;       /* Card Surface — card/panel bg */
  --color-surface-elevated: #1a2744;   /* Card Header — elevated elements */
  --color-surface-hover: #2a3a5c;      /* Infield — hover/active states */
  --color-surface-scoreboard: #0a0a14; /* Scoreboard body bg */

  /* ===== ACCENTS (Griffey-card sampled) ===== */
  --color-topps-gold: #E9D447;         /* Primary CTA, gold accents */
  --color-topps-gold-shadow: #B0A030;  /* Hard shadow for gold elements */
  --color-topps-blue: #3D8AC5;         /* Card frames, info elements */
  --color-topps-blue-shadow: #2A6B9E;  /* Hard shadow for blue elements */
  --color-card-red: #c62828;           /* Energy, danger, strikeouts */
  --color-card-red-shadow: #8e0000;    /* Hard shadow for red elements */
  --color-nameplate-orange: #CE632A;   /* Card nameplates */
  --color-stadium-green: #4caf50;      /* Success, hits, positive outcomes */
  --color-stadium-green-shadow: #2e7d32; /* Hard shadow for green elements */

  /* ===== TEXT ===== */
  --color-text-primary: #e8e0d4;       /* Card Stock — primary text */
  --color-text-secondary: #c8b89a;     /* Aged Paper — secondary text */
  --color-text-muted: #8a8070;         /* Worn Ink — labels, captions */
  --color-text-dim: #5a5a6a;           /* Very muted, placeholder-level */
  --color-text-dirt: #4a3425;          /* Dirt Brown — out badges text */

  /* ===== TYPOGRAPHY ===== */
  --font-script: 'Pacifico', cursive;
  --font-display: 'Oswald', sans-serif;
  --font-score: 'Doto', monospace;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

**Update base styles** below the @theme block:
```css
body {
  @apply min-h-screen;
  font-family: var(--font-body);
  background-color: var(--color-surface-page);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-synthesis: none;
}

#root {
  @apply min-h-screen;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

**Preserve existing functional styles:**
- Touch targets (min-h-[48px] on interactive elements)
- Focus-visible outlines (change from green-500 to topps-gold)
- Scrollbar styling (update colors to match new palette)

### 0.3 — SVG Texture Filters (App.tsx)

Add hidden SVG filter definitions at the top of the App component's return, before the Router:

```tsx
{/* Hidden SVG filters for texture system */}
<svg width="0" height="0" style={{ position: 'absolute' }}>
  <defs>
    <filter id="paper-noise" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.65"
        numOctaves={4}
        stitchTiles="stitch"
      />
      <feColorMatrix type="saturate" values="0" />
    </filter>
  </defs>
</svg>
```

Add the global paper grain overlay div as the last child inside the root fragment:

```tsx
{/* Global paper grain overlay */}
<div
  className="fixed inset-0 z-[9999] pointer-events-none"
  style={{
    opacity: 0.08,
    mixBlendMode: 'screen',
    filter: 'url(#paper-noise)',
    background: '#a09080',
  }}
/>
```

### 0.4 — Remove Vestigial Config

Delete `frontend/tailwind.config.js`. The v4 @theme directive in index.css is the source of truth. Verify the build still works after deletion — Tailwind v4 with the @tailwindcss/postcss plugin does not require a JS config file.

### 0.5 — Validation Gate

```bash
# Must pass:
pnpm build              # Compiles without errors
pnpm e2e:autoplay       # Smoke test still passes (no DOM changes made)
```

---

## Layer 1: Texture Utility Classes

**Agent assignment:** Agent B (can run concurrently with Agent A on Layer 0)
**Risk level:** LOW — additive CSS only, no component changes
**Files to modify:**
- `frontend/src/index.css` (append utility classes after base styles)

### 1.1 — Add Utility Classes to index.css

Append the following after the existing base styles. These are composable classes that components will opt into in later layers.

```css
/* ===== v5 TEXTURE UTILITIES ===== */

/* Ink bleed — warm text-shadow for print feel */
.ink-bleed {
  text-shadow:
    0 0 1px rgba(180, 140, 90, 0.25),
    0.4px 0.3px 1px rgba(160, 120, 70, 0.18);
}
.ink-bleed-heavy {
  text-shadow:
    0 0 1.5px rgba(180, 140, 90, 0.35),
    0.5px 0.4px 1.5px rgba(160, 120, 70, 0.25),
    -0.3px 0.3px 1px rgba(170, 130, 80, 0.15);
}

/* Gloss reflection — diagonal light band on cards */
.gloss-surface {
  position: relative;
  overflow: hidden;
}
.gloss-surface::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 0%, transparent 40%,
    rgba(255,255,255,0.04) 42%,
    rgba(255,255,255,0.08) 45%,
    rgba(255,255,255,0.04) 48%,
    transparent 50%, transparent 100%
  );
  mix-blend-mode: overlay;
  pointer-events: none;
  z-index: 10;
  background-size: 200% 200%;
  background-position: 100% 0%;
  transition: background-position 0.6s ease;
}
.gloss-surface:hover::after {
  background-position: 0% 100%;
}

/* Foil variant — gold tint for premium/special cards */
.gloss-foil::after {
  background: linear-gradient(
    115deg,
    transparent 35%,
    rgba(255,255,255,0.06) 38%,
    rgba(255,255,255,0.12) 42%,
    rgba(233,212,71,0.08) 46%,
    rgba(255,255,255,0.06) 50%,
    transparent 52%
  );
  background-size: 200% 200%;
  background-position: 100% 0%;
}

/* Mobile gloss animation (no hover on touch) */
@keyframes gloss-sweep {
  0%, 100% { background-position: 100% 0%; }
  50% { background-position: 0% 100%; }
}
@media (hover: none) {
  .gloss-surface::after {
    animation: gloss-sweep 5s ease-in-out infinite;
  }
}

/* Gloss pulse — CTA attention animation (always plays) */
.gloss-pulse {
  position: relative;
  overflow: hidden;
}
.gloss-pulse::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 35%,
    rgba(255,255,255,0.08) 38%,
    rgba(255,255,255,0.15) 42%,
    rgba(255,255,255,0.08) 46%,
    transparent 49%
  );
  background-size: 250% 250%;
  background-position: 100% 0%;
  pointer-events: none;
  z-index: 1;
  animation: gloss-sweep 3s ease-in-out infinite;
}

/* Edge wear — warm vignette on cards */
.aged-edge {
  position: relative;
}
.aged-edge::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: radial-gradient(
    ellipse at 50% 50%,
    transparent 50%,
    rgba(0,0,0,0.12) 85%,
    rgba(0,0,0,0.2) 100%
  );
  box-shadow:
    inset 0 0 30px rgba(180,140,90,0.06),
    inset 0 0 60px rgba(0,0,0,0.08);
}

/* Card stipple — secondary page-level grain */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  opacity: 0.05;
  background-image:
    radial-gradient(circle, #c8b89a 0.5px, transparent 0.5px),
    radial-gradient(circle, #c8b89a 0.3px, transparent 0.3px);
  background-size: 7px 7px, 5px 5px;
  background-position: 0 0, 2.5px 2.5px;
  mix-blend-mode: screen;
}
```

### 1.2 — Validation Gate

```bash
pnpm build    # CSS compiles, no errors
```

No E2E tests needed — these classes aren't applied to anything yet.

---

## Layer 2: Common Components

**Agent assignment:** Agent C (after Layers 0+1 complete)
**Risk level:** MEDIUM — visual changes, but zero DOM structure changes
**Files to modify:**
- `frontend/src/components/common/Button.tsx`
- `frontend/src/components/common/Card.tsx`
- `frontend/src/components/common/Input.tsx`
- `frontend/src/components/common/ConfirmDialog.tsx`

### Critical Safety Rules

1. **PRESERVE all `data-testid` attributes** — do not remove, rename, or relocate any
2. **PRESERVE all component prop interfaces** — same props in, same behavior out
3. **PRESERVE all event handlers** — onClick, onChange, onSubmit must fire identically
4. **PRESERVE DOM hierarchy** — elements can gain/lose CSS classes but not be removed or reordered. Exception: adding wrapper divs for texture effects is OK if they have `pointer-events: none`
5. **DO NOT add or change any `data-testid`** — the E2E tests have a fixed contract

### 2.1 — Button.tsx

**Design direction:** Zero radius, hard offset shadows, 1px black border. Pacifico for script variant.

| Current | Target |
|---------|--------|
| `rounded-lg` | Remove (border-radius: 0 is default without it) |
| `bg-green-500 hover:bg-green-600` (primary) | `bg-[var(--color-stadium-green)]` + hard shadow |
| `bg-red-500` (danger) | `bg-[var(--color-card-red)]` + hard shadow |
| `bg-transparent border-green-500` (secondary) | `border-[var(--color-topps-gold)]` + hard shadow |
| `focus:ring-green-500` | `focus:ring-[var(--color-topps-gold)]` |
| Smooth transitions | `transition: transform 0.1s, box-shadow 0.1s` |
| No hover transform | `hover:translate(-1px,-1px)` + shadow expand |
| No active transform | `active:translate(3px,3px)` + shadow compress |

**Add a new "roll" variant** specifically for the Roll Dice button:
- Background: `var(--color-topps-gold)`
- Text: `var(--color-surface-page)` (dark on gold)
- Font: `var(--font-script)` (Pacifico)
- Text-transform: none (not uppercase)
- Shadow: 5px 5px offset in gold-shadow
- Apply `.gloss-pulse` class for animated attention
- Apply `.ink-bleed-heavy` class

**What NOT to change:**
- Loading spinner SVG
- disabled state logic
- size prop values (sm/md/lg)
- children rendering
- forwardRef behavior (if present)
- Any data-testid attributes

### 2.2 — Card.tsx

**Design direction:** Color-block frame technique. Zero radius. No CSS border properties — use grid + gap on black container.

The Card component needs the most significant structural change, but it must be backwards-compatible.

**Approach:** The Card component's outer wrapper changes from `rounded-xl border border-gray-700 bg-gray-800 shadow-lg` to the color-block frame system. The inner content areas (CardHeader, CardContent, CardFooter) become grid children inside the black-background grid container.

| Current | Target |
|---------|--------|
| `rounded-xl` | Remove |
| `border border-gray-700` | `bg-black` container with `gap-[1px]` grid |
| `bg-gray-800` | Grid children get `bg-[var(--color-surface-card)]` |
| `shadow-lg` | Remove (color blocks create their own visual weight) |
| `hover:bg-gray-750` (interactive) | `hover:bg-[var(--color-surface-hover)]` on content area |

**Add optional texture classes based on variant:**
- `default` → no texture
- `interactive` → `.gloss-surface` on outer wrapper
- `highlighted` → `.gloss-surface .aged-edge` on outer wrapper

**New optional prop: `frameStyle`**
- `'none'` (default) — simple card, no color-block frame
- `'griffey'` — blue/gold Topps frame with halftone
- `'donruss'` — navy side block
- `'special'` — full-width banner variant (Record Breaker)

This prop is additive — existing code that doesn't pass frameStyle gets the default (no frame), so nothing breaks.

### 2.3 — Input.tsx / Select / SearchInput

**Design direction:** Zero radius, dark navy surface, gold focus ring.

| Current | Target |
|---------|--------|
| `rounded-lg` | Remove |
| `bg-gray-800` | `bg-[var(--color-surface-card)]` |
| `border-gray-600 hover:border-gray-500` | `border-[var(--color-text-dim)]` |
| `focus:ring-green-500` | `focus:ring-[var(--color-topps-gold)]` |
| `placeholder-gray-500` | `placeholder-[var(--color-text-muted)]` |
| `text-white` | `text-[var(--color-text-primary)]` |

**What NOT to change:**
- useId() behavior
- forwardRef behavior
- label/error/hint rendering logic
- SearchInput icon/clear button functionality

### 2.4 — ConfirmDialog.tsx

| Current | Target |
|---------|--------|
| `bg-black/70` overlay | Keep (looks fine on dark theme) |
| Card wrapper styles | Will inherit from updated Card |
| `text-lg font-display` | Keep, add `.ink-bleed` class |
| Button styles | Will inherit from updated Button |

### 2.5 — Validation Gate

```bash
pnpm build              # Compiles
pnpm e2e:autoplay       # Smoke test passes (tests use data-testid only)
pnpm e2e:matrix         # All scenario tests pass
```

Take screenshots at this point to compare with baseline screenshots in `e2e/screenshots/`.

---

## Layer 3: Layout Components

**Agent assignment:** Agent C (continues after Layer 2)
**Risk level:** LOW
**Files to modify:**
- `frontend/src/components/layout/Header.tsx`

### 3.1 — Header

**Design direction:** Color-blocked, hard edge. Pacifico title. Red accent stripe.

| Current | Target |
|---------|--------|
| `bg-gray-900/95 backdrop-blur` | `bg-[var(--color-surface-elevated)]` (solid, no blur) |
| `border-b border-gray-800` | Remove border. Add 4px red accent div below. |
| `text-lg font-display font-bold text-white` | `font-[var(--font-script)] text-[var(--color-topps-gold)]` |
| `h-14` | Keep (functional — touch targets) |
| Back button styling | Update colors to match palette |

**Add red accent stripe:** A `<div>` after the header bar with `h-1 bg-[var(--color-card-red)]`. This is purely visual — no testid, no interaction.

### 3.2 — PageContainer

| Current | Target |
|---------|--------|
| `max-w-lg` | Consider `max-w-xl` or `max-w-2xl` (cards are wider now) |
| `px-4 py-6` | Keep |

### 3.3 — Validation Gate

```bash
pnpm build
pnpm e2e:autoplay
```

---

## Layer 4: Game Components

**Agent assignment:** Agent D (after Layer 3)
**Risk level:** MEDIUM-HIGH — these are the most complex components
**Files to modify:**
- `frontend/src/components/game/BoxScore.tsx`
- `frontend/src/components/game/MatchupDisplay.tsx`
- `frontend/src/components/game/OpponentInfo.tsx`
- `frontend/src/pages/Game.tsx` (extract inline components)

### Critical: Game.tsx Inline Component Extraction

The Game.tsx page currently contains inline components that should be extracted into their own files for modularity. Based on the design audit, these include:
- Scoreboard (9-inning table)
- Diamond (SVG baseball diamond)
- RollButton (with outcome colors)
- TurnStatus (status badge)
- getOutcomeColor (utility function)

**Strategy:** Extract to `frontend/src/components/game/` as separate files, import back into Game.tsx. The DOM output must be identical — only the file organization changes. Then restyle the extracted components.

### 4.1 — Scoreboard (extract + restyle)

New file: `frontend/src/components/game/Scoreboard.tsx`

**Design direction:** Black container with 1px grid gap. Doto font for scores. Red header bar. Gold score numbers with glow on totals.

Reference: v5 scoreboard section. The Doto font at weight 600 for inning numbers, 800 for totals.

### 4.2 — Diamond (extract + restyle)

New file: `frontend/src/components/game/Diamond.tsx`

Restyle the SVG to match the dark navy palette. Base indicators should use gold for occupied, muted for empty.

### 4.3 — RollButton (merge into Button variant)

The inline RollButton should become a usage of the new Button `roll` variant from Layer 2, with `data-testid="game-roll-button"` preserved.

### 4.4 — BoxScore.tsx (restyle)

**Design direction:** The game-over screen should feel celebratory. Victory uses Pacifico script. Score display uses Doto at weight 800.

**CRITICAL:** Preserve `data-testid="game-over-screen"` on the outer container.

### 4.5 — MatchupDisplay.tsx (restyle)

**Design direction:** Color-block card frames for batter and pitcher. Blue identity circle becomes a mini Griffey-style card. Stats grid uses JetBrains Mono.

### 4.6 — OpponentInfo.tsx (restyle)

Update colors and typography to match palette. **CRITICAL:** Preserve `data-testid="game-opponent-disconnected"` if it exists on disconnect notice.

### 4.7 — Validation Gate

```bash
pnpm build
pnpm e2e                # Run ALL tests (smoke, midgame, fullgame, disconnect, screenshots)
```

This is the most critical gate. The game flow must work end-to-end. If any test fails, check:
1. data-testid attributes are present
2. Roll button is visible and clickable
3. Game-over screen renders
4. Disconnect notice appears/disappears

---

## Layer 5: Page-Level Composition

**Agent assignment:** Agent D (continues after Layer 4)
**Risk level:** LOW — applying texture classes to page wrappers
**Files to modify:**
- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Teams.tsx`
- `frontend/src/pages/Players.tsx`
- `frontend/src/pages/Play.tsx`
- `frontend/src/pages/Game.tsx`
- `frontend/src/pages/Auth.tsx`

### Strategy

Pages primarily compose existing components. At this layer, the work is:
1. Apply texture utility classes to page-level containers (`.aged-edge` on card wrappers, etc.)
2. Update any remaining hardcoded colors to use CSS variables
3. Add `.ink-bleed` to display headings
4. Ensure background colors use `var(--color-surface-page)` or appropriate surface token

### Page-Specific Notes

**Home.tsx** — Dashboard cards get `.gloss-surface` on interactive cards.
**Teams.tsx** — Team cards use Griffey-style frames if displaying player rosters.
**Players.tsx** — Player cards in the MLB database list use card frames. This is the main showcase for the Topps aesthetic.
**Play.tsx** — Create/join game interface. Keep it clean and functional. **CRITICAL:** Preserve all `data-testid` attributes (`play-create-game`, `play-created-join-code`, `play-join-code-input`, `play-join-game`).
**Game.tsx** — Most work done in Layer 4 via component extraction. This layer adds texture classes to the overall game container. **CRITICAL:** Preserve `data-testid="game-screen"`.
**Auth.tsx** — Simple form page. Update colors. **CRITICAL:** Preserve `data-testid="auth-quick-login"`.

### 5.1 — Validation Gate (FINAL)

```bash
# Full test suite
pnpm build
pnpm e2e:all            # All tests, all browser projects (desktop + mobile)

# Visual verification
pnpm e2e:autoplay       # Watch the smoke test in headed mode
# Compare screenshots in e2e/screenshots/ with baseline
```

---

## Agent Coordination Protocol

### Parallel Work

Agents A and B can work concurrently:
- **Agent A:** Layer 0 (foundation — fonts, tokens, SVG, config cleanup)
- **Agent B:** Layer 1 (texture utilities — CSS class definitions)

Both are purely additive/foundational. No component changes.

### Sequential Work

After Layers 0+1 are merged and validated:
- **Agent C:** Layers 2 + 3 (common components + layout)
- **Agent D:** Layers 4 + 5 (game components + page composition)

### Handoff Protocol

Each agent, when finishing their layer:
1. Run the validation gate commands
2. Commit with descriptive message: `style(layer-N): description`
3. Document any decisions or deviations in commit message body
4. Leave TODO comments on anything that needs follow-up

### Conflict Prevention

- Only one agent touches a file at a time
- Layer boundaries are strict file boundaries
- If an agent needs to modify a file outside their layer, they leave a TODO comment instead and document it in the handoff

---

## Reference: Complete data-testid Contract

These attributes are the E2E test contract. They MUST exist on visible, interactable DOM elements after implementation.

| Test ID | Must Be | Must Support |
|---------|---------|--------------|
| `auth-quick-login` | Visible button | Click |
| `nav-play-link` | Visible link | Click → navigates to /play |
| `play-create-game` | Visible button | Click → creates game |
| `play-created-join-code` | Visible div | Contains 6-char alphanumeric text |
| `play-join-code-input` | Visible input | Text input (fill) |
| `play-join-game` | Visible button | Click → joins game |
| `game-screen` | Visible div | Contains game UI |
| `game-roll-button` | Visible button (when turn) | Click → rolls dice |
| `game-over-screen` | Visible div (when game ends) | Present in DOM |
| `game-opponent-disconnected` | Visible div (on disconnect) | Appears/disappears |

---

## Reference: Design Token Map

### Color Tokens → CSS Variables

| Role | Hex | CSS Variable | Usage |
|------|-----|-------------|-------|
| Page bg | #1a1a2e | `--color-surface-page` | body background |
| Card bg | #16213e | `--color-surface-card` | card/panel backgrounds |
| Elevated bg | #1a2744 | `--color-surface-elevated` | headers, elevated sections |
| Hover bg | #2a3a5c | `--color-surface-hover` | interactive hover states |
| Scoreboard bg | #0a0a14 | `--color-surface-scoreboard` | scoreboard body |
| Topps Gold | #E9D447 | `--color-topps-gold` | CTA, gold accents, score text |
| Gold Shadow | #B0A030 | `--color-topps-gold-shadow` | hard shadows on gold |
| Topps Blue | #3D8AC5 | `--color-topps-blue` | card frames, info badges |
| Blue Shadow | #2A6B9E | `--color-topps-blue-shadow` | hard shadows on blue |
| Card Red | #c62828 | `--color-card-red` | danger, strikeouts, red accents |
| Red Shadow | #8e0000 | `--color-card-red-shadow` | hard shadows on red |
| Orange | #CE632A | `--color-nameplate-orange` | card nameplates |
| Green | #4caf50 | `--color-stadium-green` | success, hits, positive |
| Green Shadow | #2e7d32 | `--color-stadium-green-shadow` | hard shadows on green |
| Primary text | #e8e0d4 | `--color-text-primary` | body text |
| Secondary text | #c8b89a | `--color-text-secondary` | muted text |
| Muted text | #8a8070 | `--color-text-muted` | labels, captions |
| Dim text | #5a5a6a | `--color-text-dim` | placeholders |
| Dirt text | #4a3425 | `--color-text-dirt` | out badge bg |

### Font Tokens → CSS Variables

| Role | Font | Variable | Usage |
|------|------|----------|-------|
| Script | Pacifico | `--font-script` | Celebrations, team names, Roll Dice |
| Display | Oswald 500-700 | `--font-display` | Player names, headings (uppercase) |
| Score | Doto 400-900 | `--font-score` | Scoreboard numbers, big score display |
| Body | Inter 400-700 | `--font-body` | Body text, UI labels |
| Mono | JetBrains Mono 400-500 | `--font-mono` | Stat numbers, tabular data |

### Texture Utility Classes

| Class | Effect | Apply To |
|-------|--------|----------|
| `.ink-bleed` | Warm text-shadow (subtle) | Headings, structural labels |
| `.ink-bleed-heavy` | Warm text-shadow (strong) | Celebration text, banners |
| `.gloss-surface` | Hover gloss reflection | Cards, interactive panels |
| `.gloss-foil` | Gold-tinted gloss | Special/premium cards |
| `.gloss-pulse` | Continuous gloss sweep | CTA buttons (Roll Dice) |
| `.aged-edge` | Warm vignette | Cards, scoreboard |
| `.paper-grain` | Global noise overlay | App root (one instance) |

### Design Rules (Zero Tolerance)

1. **border-radius: 0 everywhere.** Only exception: player avatar circles (border-radius: 50%).
2. **No smooth CSS gradients.** Use halftone dot patterns (radial-gradient) for transitions.
3. **Hard offset shadows only.** No blur-radius shadows. Shadow compresses on press, expands on hover.
4. **1px strokes via CSS grid gap on black container.** Not CSS border properties.
5. **Screen blend mode for textures on dark backgrounds.** Never overlay — it's mathematically invisible on darks.

---

## Reference: File Modification Map

Complete list of files each layer touches.

| Layer | File | Action |
|-------|------|--------|
| 0 | `frontend/index.html` | Modify (fonts) |
| 0 | `frontend/src/index.css` | Modify (tokens, base styles) |
| 0 | `frontend/src/App.tsx` | Modify (SVG filters, paper grain div) |
| 0 | `frontend/tailwind.config.js` | DELETE |
| 1 | `frontend/src/index.css` | Modify (append utility classes) |
| 2 | `frontend/src/components/common/Button.tsx` | Modify (restyle) |
| 2 | `frontend/src/components/common/Card.tsx` | Modify (restyle + new prop) |
| 2 | `frontend/src/components/common/Input.tsx` | Modify (restyle) |
| 2 | `frontend/src/components/common/ConfirmDialog.tsx` | Modify (restyle) |
| 3 | `frontend/src/components/layout/Header.tsx` | Modify (restyle) |
| 4 | `frontend/src/components/game/Scoreboard.tsx` | CREATE (extract from Game.tsx) |
| 4 | `frontend/src/components/game/Diamond.tsx` | CREATE (extract from Game.tsx) |
| 4 | `frontend/src/components/game/BoxScore.tsx` | Modify (restyle) |
| 4 | `frontend/src/components/game/MatchupDisplay.tsx` | Modify (restyle) |
| 4 | `frontend/src/components/game/OpponentInfo.tsx` | Modify (restyle) |
| 4 | `frontend/src/components/game/index.ts` | Modify (add exports) |
| 4 | `frontend/src/pages/Game.tsx` | Modify (import extracted components) |
| 5 | `frontend/src/pages/Home.tsx` | Modify (texture + colors) |
| 5 | `frontend/src/pages/Teams.tsx` | Modify (texture + colors) |
| 5 | `frontend/src/pages/Players.tsx` | Modify (texture + colors) |
| 5 | `frontend/src/pages/Play.tsx` | Modify (texture + colors) |
| 5 | `frontend/src/pages/Auth.tsx` | Modify (texture + colors) |
