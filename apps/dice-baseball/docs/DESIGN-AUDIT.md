# Dice Baseball V2 — Frontend Design Audit

*Generated: February 2026*

This document catalogs every page, component, design token, and styling pattern currently in the frontend codebase. It serves as the baseline for the design sprint — everything we're working with before any redesign begins.

---

## 1. Page Views

### Auth (`/auth`)
**File:** `src/pages/Auth.tsx`
**Purpose:** Login and registration with mode toggle. Includes a dev quick-login for development.
**Components used:** Header, PageContainer, Card, CardContent, Input, Button

### Home / Dashboard (`/`)
**File:** `src/pages/Home.tsx`
**Purpose:** Post-login landing. Shows user stats (W-L record) and quick-action cards linking to Play, Teams, and Players.
**Components used:** Header, PageContainer, Card (interactive variant), CardContent, Button

### Teams (`/teams`)
**File:** `src/pages/Teams.tsx`
**Purpose:** List view of user's teams with status badges. Supports drag-to-reorder, inline creation modal, duplication, and deletion.
**Components used:** Header, PageContainer, Card, CardContent, Button, Input, ConfirmDialog
**Inline components:** `TeamCard` (not extracted — lives inside Teams.tsx)

### Team Editor (`/teams/:teamId`)
**File:** `src/components/team/TeamEditor.tsx` (rendered by Teams.tsx route)
**Purpose:** Full roster management. 10 position slots, player search modal, batting order editor with drag-and-drop, auto-save drafts.
**Components used:** Header, PageContainer, Card, CardContent, Input, Button, BattingOrderEditor, ConfirmDialog

### Players (`/players`)
**File:** `src/pages/Players.tsx`
**Purpose:** MLB player database browser. Search, position/team/league filters, advanced stat filters, pagination.
**Components used:** Header, PageContainer, Card, CardContent, Select, SearchInput, Button, PlayerDetailModal
**Inline components:** `PlayerCard`, `PlayerCardSkeleton` (not extracted — live inside Players.tsx)

### Play (`/play`)
**File:** `src/pages/Play.tsx`
**Purpose:** Game lobby. Create a game (generates join code) or join with a code. Waiting state with polling for opponent.
**Components used:** Header, PageContainer, Card, CardContent, Button, Input, Select

### Game (`/game/:gameId`)
**File:** `src/pages/Game.tsx`
**Purpose:** Live game view. Scoreboard, diamond, batter-vs-pitcher matchup, dice roll, play log, game-over screen.
**Components used:** Header, PageContainer, Button, Card, CardContent, MatchupDisplay, OpponentInfo, BoxScore
**Inline components:** `Scoreboard`, `Diamond`, `RollButton`, `TurnStatus`, `getOutcomeColor` (all live inside Game.tsx)

### Not Found (`/*`)
**File:** `src/pages/NotFound.tsx`
**Purpose:** 404 catch-all with back-to-home link.
**Components used:** Header, PageContainer, Card, CardContent, Button

---

## 2. Component Inventory

### Layout Components

| Component | File | Props | Notes |
|-----------|------|-------|-------|
| **Header** | `components/layout/Header.tsx` | `title`, `showBack?`, `rightAction?` | Sticky top bar, h-14, bg-gray-900/95 backdrop-blur, border-b border-gray-800. Baseball emoji on right. |
| **PageContainer** | `components/layout/Header.tsx` | `children`, `className?` | `max-w-lg mx-auto px-4 py-6`. Lives in same file as Header. |

### Common Components

| Component | File | Variants / Props | Notes |
|-----------|------|------------------|-------|
| **Button** | `components/common/Button.tsx` | `variant`: primary / secondary / danger / ghost. `size`: sm / md / lg. `isLoading?`. | Primary = bg-green-500. Has loading spinner SVG. |
| **Card** | `components/common/Card.tsx` | `variant`: default / interactive / highlighted. `padding`: none / sm / md / lg. | Default = bg-gray-800, border-gray-700, rounded-xl. |
| **CardHeader** | `components/common/Card.tsx` | `title`, `subtitle?`, `action?` | font-display heading, gray-400 subtitle. |
| **CardContent** | `components/common/Card.tsx` | `children`, `className?` | Passthrough div wrapper. |
| **CardFooter** | `components/common/Card.tsx` | `children`, `className?` | Top border divider (border-t border-gray-700). |
| **Input** | `components/common/Input.tsx` | `label?`, `error?`, `hint?` + all HTML input attrs | bg-gray-800, border-gray-600, focus:ring-green-500. 48px min-height. |
| **Select** | `components/common/Input.tsx` | `label?`, `error?`, `options[]` | Same styling as Input. Custom SVG dropdown arrow via inline style. |
| **SearchInput** | `components/common/Input.tsx` | `value`, `onChange`, `onClear?` | Input with search icon (left) and clear button (right). |
| **ConfirmDialog** | `components/common/ConfirmDialog.tsx` | `isOpen`, `title`, `message`, `confirmText?`, `cancelText?`, `confirmVariant?`, `onConfirm`, `onCancel` | Fixed overlay modal (bg-black/70). |
| **PlayerDetailModal** | `components/common/PlayerDetailModal.tsx` | `player`, `isOpen`, `onClose`, `onAddToTeam?` | Large scrollable modal (max-w-4xl) with full stat breakdown. |
| **ErrorBoundary** | `components/common/ErrorBoundary.tsx` | `children` | Catch-all error fallback UI. |

### Game Components

| Component | File | Props | Notes |
|-----------|------|-------|-------|
| **MatchupDisplay** | `components/game/MatchupDisplay.tsx` | `batter`, `pitcher` (MLBPlayer or null) | Batter vs Pitcher with initials in colored circles (blue=batter, red=pitcher). Shows key stats (AVG, OPS, HR, RBI vs ERA, WHIP, K/9, W-L). |
| **OpponentInfo** | `components/game/OpponentInfo.tsx` | `game`, `currentUser` | Team name badges. HOME=bg-blue-600, VISITOR=bg-gray-600. |
| **BoxScore** | `components/game/BoxScore.tsx` | `game`, `gameState`, `playLog`, `didWin`, `onPlayAgain?`, `onGoHome` | Game-over screen with trophy/loss emoji, inning-by-inning box score table, game stats grid, key moments. |

### Team Components

| Component | File | Props | Notes |
|-----------|------|-------|-------|
| **TeamEditor** | `components/team/TeamEditor.tsx` | `teamId` | Full page component — roster slots, player search modal, save buttons. |
| **BattingOrderEditor** | `components/team/BattingOrderEditor.tsx` | `roster`, `populatedRoster`, `onReorder`, `onSave`, `disabled?` | Drag-and-drop lineup editor. Batting order number in blue circle (bg-blue-600). |

### Inline Components (Not Extracted)

These live inside page files rather than being standalone components:

| Component | Lives In | What It Does |
|-----------|----------|--------------|
| `TeamCard` | Teams.tsx | Individual team card in list with drag handles, duplicate/delete buttons |
| `PlayerCard` | Players.tsx | Player row in search results with photo or fallback, key stats |
| `PlayerCardSkeleton` | Players.tsx | Loading placeholder for player cards |
| `Scoreboard` | Game.tsx | 9-inning score table (font-mono) with current-inning highlight |
| `Diamond` | Game.tsx | SVG baseball diamond with 3 base indicators (yellow-400 when occupied) |
| `RollButton` | Game.tsx | Large action button — shows dice emoji, roll result, outcome color |
| `TurnStatus` | Game.tsx | Status badge showing whose turn / connection state |
| `getOutcomeColor` | Game.tsx | Utility mapping OutcomeType → text color class |

---

## 3. Design Tokens

### Color Palette

**Custom theme colors** (defined in both `tailwind.config.js` and `src/index.css` via `@theme`):

| Token | Hex | Usage |
|-------|-----|-------|
| `green-900` | `#0f2417` | Deepest background tint, HTML theme-color |
| `green-800` | `#1a3d28` | — |
| `green-700` | `#1e5631` | — |
| `green-600` | `#2d7a47` | Button hover states |
| `green-500` | `#3d9b5d` | **Primary accent** — buttons, focus rings, success indicators |
| `green-400` | `#4fb871` | Positive outcome text |
| `green-300` | `#6dd58f` | — |
| `brown-900` | `#2d1f14` | — |
| `brown-800` | `#4a3425` | — |
| `brown-700` | `#6b4d36` | — |
| `brown-600` | `#8b6848` | — |
| `brown-500` | `#a67c52` | — |
| `baseball-red` | `#c9302c` | — |
| `baseball-red-dark` | `#a02622` | — |
| `gold` | `#fbbf24` | Home run highlight |

**Standard Tailwind grays in active use:** gray-900 (page bg), gray-800 (card bg), gray-700 (borders), gray-600 (input borders, secondary borders), gray-500 (placeholder text, muted icons), gray-400 (secondary text), gray-300 (label text), gray-100 (body text base).

**Semantic color assignments currently hardcoded (not tokenized):**

| Purpose | Current Value | Where Used |
|---------|---------------|------------|
| Batter identity | `bg-blue-600` | MatchupDisplay, BattingOrderEditor |
| Pitcher identity | `bg-red-600` | MatchupDisplay |
| Home team badge | `bg-blue-600` | OpponentInfo |
| Visitor team badge | `bg-gray-600` | OpponentInfo |
| Hit outcomes (single/double/triple) | `text-green-400` / `bg-green-500` | Game.tsx inline |
| Home run | `text-yellow-400` / `bg-yellow-500` | Game.tsx inline |
| Walk | `text-blue-400` / `bg-blue-500` | Game.tsx inline |
| Outs (K, ground, fly) | `text-red-400` / `bg-red-500` | Game.tsx inline |
| Toast success border | `#22c55e` (green-500) | App.tsx |
| Toast error border | `#ef4444` (red-500) | App.tsx |
| Toast background | `#1f2937` (gray-800) | App.tsx |

### Typography

| Token | Font | Weights Loaded | Usage |
|-------|------|----------------|-------|
| `--font-display` | Oswald | 500, 600, 700 | All headings (h1-h6), CardHeader titles, Header title, font-display class |
| `--font-body` | Inter | 400, 500, 600, 700 | Body text default, labels, descriptions |
| `--font-mono` | JetBrains Mono | 400, 500 | Stat values, scoreboard table, code/data display |

**Typography scale in use (no formal scale defined):**
- `text-xs` — stat labels, badges, position tags
- `text-sm` — secondary text, labels, hints, play log entries
- `text-base` — default body, button md
- `text-lg` — card headers, header title, button lg
- `text-xl` — baseball emoji, VS text
- `text-2xl` — player initials, VS text (matchup)
- `text-5xl` — error emoji
- `text-6xl` — game over emoji (BoxScore)

### Spacing

No formal spacing scale defined. Values in use:
- **Page padding:** `px-4 py-6`
- **Card padding:** `p-3` (sm), `p-4` (md), `p-6` (lg)
- **Element gaps:** `gap-1`, `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`
- **Stack spacing:** `space-y-1`, `space-y-2`, `space-y-3`, `space-y-4`, `space-y-6`
- **Margin patterns:** `mb-1`, `mb-2`, `mb-3`, `mb-4`, `mt-2`, `mt-4`, `my-4`

### Border Radius

- Cards: `rounded-xl`
- Buttons and inputs: `rounded-lg`
- Avatars/badges: `rounded-full`
- Base squares (diamond): `rx="2"` (very slight rounding)
- Scrollbar thumb: `rounded-full`

### Shadows

- Cards: `shadow-lg` (only shadow in use)
- No other shadow tokens defined

### Transitions

- Standard: `transition-colors duration-200`
- General: `transition-all duration-200`
- Drag: `transition-opacity`, `transition-transform`

### Touch Targets

- All interactive elements: `min-h-[48px]` (set globally in index.css)
- Button sm: `min-h-[40px]`
- Button md: `min-h-[48px]`
- Button lg: `min-h-[56px]`

---

## 4. Styling Patterns & Observations

### Approach
100% inline Tailwind utility classes. No CSS modules, no styled-components, no CSS-in-JS beyond Tailwind. The only CSS file is `index.css` which sets base styles and the `@theme` directive.

### Consistency Issues

1. **Duplicated token definitions.** Colors and fonts are defined in both `tailwind.config.js` (Tailwind v3 format) and `index.css` `@theme` directive (Tailwind v4 format). The project uses Tailwind v4, so `tailwind.config.js` may be vestigial.

2. **Unextracted inline components.** Six presentation components live inside page files (Scoreboard, Diamond, RollButton, TurnStatus in Game.tsx; PlayerCard/Skeleton in Players.tsx; TeamCard in Teams.tsx). These can't be reused or independently styled.

3. **Semantic colors are hardcoded.** Outcome colors, team identity colors (batter=blue, pitcher=red), and status colors are defined as local objects/literals in Game.tsx rather than as shared tokens. If the palette changes, every instance needs manual updating.

4. **No consistent icon system.** Icons are inline SVGs (Header back arrow, SearchInput magnifying glass, Select dropdown arrow via data URI, loading spinner). No icon library, no consistent sizing convention.

5. **Layout ceiling.** `max-w-lg` (32rem / 512px) on PageContainer constrains the app to a narrow mobile-first column. Good for phone, limits tablet/desktop layouts.

6. **Brown palette unused.** Five brown tokens are defined (brown-900 through brown-500) but appear nowhere in the component code. Same for `baseball-red` and `baseball-red-dark`.

7. **Toast styling uses raw hex.** Toast configuration in App.tsx uses hex strings (`#1f2937`, `#22c55e`, `#ef4444`) instead of referencing theme tokens.

8. **No dark/light mode toggle.** Everything is dark-only. Fine for now, but the token structure doesn't separate "semantic" from "primitive" colors, which would be needed for theming.

### What's Working Well

- **Touch-friendly defaults.** The 48px minimum interactive height is solid for mobile.
- **Focus accessibility.** Consistent green-500 focus rings across all interactive elements.
- **Font separation.** Three distinct font roles (display, body, mono) are clearly defined and consistently applied.
- **Component API patterns.** Button variants/sizes, Card variants/padding — these are good composable APIs that will survive a redesign.
- **Semantic HTML.** Proper use of `<button>`, `<input>`, `<select>`, `<label>`, `<header>`, `<main>`.

---

## 5. Component Dependency Map

```
App.tsx
├── Router
│   ├── /auth → Auth
│   ├── / → ProtectedRoute → Home
│   ├── /teams → ProtectedRoute → Teams
│   │   └── /teams/:id → TeamEditor
│   │       └── BattingOrderEditor
│   ├── /players → ProtectedRoute → Players
│   │   └── PlayerDetailModal
│   ├── /play → ProtectedRoute → Play
│   ├── /game/:id → ProtectedRoute → Game
│   │   ├── OpponentInfo
│   │   ├── Scoreboard (inline)
│   │   ├── MatchupDisplay
│   │   ├── Diamond (inline)
│   │   ├── TurnStatus (inline)
│   │   ├── RollButton (inline)
│   │   └── BoxScore (game over)
│   └── /* → NotFound
│
├── Global: Toaster (react-hot-toast)
└── Global: ErrorBoundary

Shared across all pages:
  Header, PageContainer, Card, CardContent, Button
```

---

## 6. Summary Counts

| Category | Count |
|----------|-------|
| Pages | 7 |
| Extracted components | 16 |
| Inline (unextracted) components | 6 |
| Custom color scales | 3 (green, brown, gold/red) |
| Font families | 3 |
| Button variants | 4 |
| Card variants | 3 |
| Animation types | 2 (pulse, spin) + CSS transitions |
| Unused defined tokens | brown-* (5), baseball-red (2) |
