# Dice Baseball — Tier Architecture Guide

How the codebase should grow to support Arcade, Team Builder, and Manager Mode without painful refactors.

**Audience:** Developers (including future Claude sessions) working on tier-specific features.

**See also:** [`EXPERIENCE-TIERS.md`](./EXPERIENCE-TIERS.md) for the player-facing tier definitions.

---

## Core Principle: Tiers Are Data, Not Code Branches

Every tier plays the same game on the same engine. Tiers differ in:

1. **What the player controls** (pre-built team vs. custom roster vs. full tactical management)
2. **What decisions are available mid-game** (none vs. limited subs vs. full bullpen/bench)
3. **What rules are active** (fatigue, platoon splits, situational modifiers)
4. **What UI is visible** (simple vs. full dashboard)

These differences should be expressed as **configuration**, not as `if/else` forks scattered through components and services. A tier is a named bundle of feature flags and rule parameters.

---

## The Tier Profile

A single object defines what a tier enables. This is the source of truth — everything else reads from it.

```typescript
// shared/types/tier.ts (used by both frontend and backend)

export type GameTier = 'arcade' | 'teamBuilder' | 'manager';

export interface TierProfile {
  tier: GameTier;

  // Team building
  teamSource: 'preset' | 'custom';
  salaryCap: number | null;           // null = no cap (arcade)
  rosterSize: number;                  // 10 (arcade/builder) or 25 (manager)
  allowBattingOrderEdit: boolean;

  // In-game decisions
  allowPinchHitters: boolean;
  pinchHitLimit: number | null;        // null = unlimited (manager)
  allowPitchingChanges: boolean;
  allowDefensiveSubstitutions: boolean;

  // Engine modifiers
  enablePitcherFatigue: boolean;
  enablePlatoonSplits: boolean;
  enableSituationalModifiers: boolean;

  // Social
  allowWagers: boolean;
}

export const TIER_PROFILES: Record<GameTier, TierProfile> = {
  arcade: {
    tier: 'arcade',
    teamSource: 'preset',
    salaryCap: null,
    rosterSize: 10,
    allowBattingOrderEdit: false,
    allowPinchHitters: false,
    pinchHitLimit: null,
    allowPitchingChanges: false,
    allowDefensiveSubstitutions: false,
    enablePitcherFatigue: false,
    enablePlatoonSplits: false,
    enableSituationalModifiers: false,
    allowWagers: false,
  },
  teamBuilder: {
    tier: 'teamBuilder',
    teamSource: 'custom',
    salaryCap: 250_000_000,  // generous
    rosterSize: 10,
    allowBattingOrderEdit: true,
    allowPinchHitters: true,
    pinchHitLimit: 3,
    allowPitchingChanges: false,
    allowDefensiveSubstitutions: false,
    enablePitcherFatigue: false,
    enablePlatoonSplits: false,
    enableSituationalModifiers: false,
    allowWagers: false,
  },
  manager: {
    tier: 'manager',
    teamSource: 'custom',
    salaryCap: 180_000_000,  // tight
    rosterSize: 25,
    allowBattingOrderEdit: true,
    allowPinchHitters: true,
    pinchHitLimit: null,
    allowPitchingChanges: true,
    allowDefensiveSubstitutions: true,
    enablePitcherFatigue: true,
    enablePlatoonSplits: true,
    enableSituationalModifiers: true,
    allowWagers: true,
  },
};
```

This object is **the only place** tier behavior is defined. Components, services, and the game engine all read from it. Adding a new capability to a tier means adding a field here and handling it in one place downstream.

---

## Where the Profile Lives at Runtime

### Backend: Stored on the Game

When a game is created, the tier profile is resolved and stored on the `GameSession`:

```typescript
// Extend GameSession (backend/src/types/contracts)
interface GameSession {
  // ... existing fields
  tier: GameTier;
  rules: TierProfile;  // snapshot at game creation time
}
```

**Why snapshot?** If tier definitions change between app versions, in-progress games keep the rules they started with. No mid-game rule drift.

The `createGame` route already accepts optional config — extend it:

```typescript
// POST /api/games
{
  teamId: string;
  tier: GameTier;  // new required field
}
```

The backend resolves `TIER_PROFILES[tier]` and attaches it to the game. The client never sends the full profile — only the tier name. The server is authoritative on what each tier means.

### Frontend: Derived from Game State

The frontend receives `tier` and `rules` as part of the game state via WebSocket. No separate feature flag fetch needed.

```typescript
// In gameStore or a dedicated hook
const { rules } = useGameSession();

// Components read from rules
if (rules.allowPinchHitters) {
  // show pinch hitter button
}
```

For pre-game contexts (team building, lobby), the frontend can import `TIER_PROFILES` directly from the shared types to show/hide UI based on the selected tier.

---

## Frontend Gating Patterns

### Pattern 1: Feature Gate Component

A thin wrapper that renders children only when a feature is enabled. Keeps JSX clean.

```typescript
// components/common/FeatureGate.tsx
interface FeatureGateProps {
  rules: TierProfile;
  feature: keyof TierProfile;
  children: React.ReactNode;
}

function FeatureGate({ rules, feature, children }: FeatureGateProps) {
  if (!rules[feature]) return null;
  return <>{children}</>;
}

// Usage in Game.tsx
<FeatureGate rules={rules} feature="allowPinchHitters">
  <PinchHitterButton />
</FeatureGate>

<FeatureGate rules={rules} feature="enablePitcherFatigue">
  <FatigueIndicator pitcher={currentPitcher} />
</FeatureGate>
```

### Pattern 2: Hook for Complex Logic

When gating affects behavior (not just visibility), use a hook:

```typescript
// hooks/useTierFeatures.ts
function useTierFeatures(rules: TierProfile) {
  return {
    canSubstitute: rules.allowPinchHitters || rules.allowDefensiveSubstitutions,
    subsRemaining: rules.pinchHitLimit === null
      ? Infinity
      : rules.pinchHitLimit - subsUsed,
    showBullpen: rules.allowPitchingChanges,
    showFatigue: rules.enablePitcherFatigue,
  };
}
```

### Pattern 3: Tier Selection UI

Before game creation, players pick their tier. This is a first-class screen, not buried in settings.

```
┌─────────────────────────────────────┐
│         Choose Your Mode            │
│                                     │
│  ┌─────────┐ ┌──────────┐ ┌──────┐ │
│  │ ARCADE  │ │  TEAM    │ │MANAGER│ │
│  │         │ │ BUILDER  │ │ MODE  │ │
│  │ Pick a  │ │ Build a  │ │ Full  │ │
│  │ team &  │ │ roster,  │ │dugout │ │
│  │ play    │ │ set your │ │control│ │
│  │         │ │ lineup   │ │       │ │
│  └─────────┘ └──────────┘ └──────┘ │
│                                     │
│  "Try Manager Mode — you've won 5  │
│   straight in Team Builder!"        │
└─────────────────────────────────────┘
```

Tier invitations (the nudge at the bottom) are driven by user stats, not hard-coded thresholds. Keep the logic in one place:

```typescript
// services/tier-invitations.ts
function getTierInvitation(user: User, currentTier: GameTier): string | null {
  if (currentTier === 'arcade' && user.wins >= 3) {
    return 'Ready to build your own team? Try Team Builder mode.';
  }
  if (currentTier === 'teamBuilder' && user.wins >= 10) {
    return "Think you can manage a bullpen? Try Manager Mode.";
  }
  return null;
}
```

### Anti-Pattern: Don't Fork Components by Tier

**Bad:**
```
components/game/ArcadeGame.tsx
components/game/TeamBuilderGame.tsx
components/game/ManagerGame.tsx
```

**Good:**
```
components/game/Game.tsx          // one component, reads from rules
components/game/SubstitutionPanel.tsx  // rendered conditionally via FeatureGate
components/game/FatigueIndicator.tsx   // rendered conditionally via FeatureGate
```

One `Game.tsx` with gated sections. Not three parallel implementations that drift apart.

---

## Backend Gating Patterns

### Game Engine: Parameterized Modifiers

The existing `resolveAtBat()` function should accept rules as a parameter. Engine internals check the rules object before applying optional modifiers.

```typescript
// Current signature:
resolveAtBat(batter, pitcher, diceRolls, rng)

// Extended signature:
resolveAtBat(batter, pitcher, diceRolls, rng, rules: TierProfile, gameContext?: GameContext)
```

Where `GameContext` carries situational state only relevant when modifiers are enabled:

```typescript
interface GameContext {
  outs: number;
  runners: [boolean, boolean, boolean];
  pitcherAtBatCount: number;     // for fatigue
  batterHandedness: 'L' | 'R';  // for platoon splits
  pitcherHandedness: 'L' | 'R';
}
```

Inside the engine:

```typescript
function resolveAtBat(batter, pitcher, diceRolls, rng, rules, context?) {
  let modifiers = calculateBaseModifiers(batter, pitcher);

  if (rules.enablePitcherFatigue && context) {
    modifiers = applyFatigueModifier(modifiers, context.pitcherAtBatCount);
  }
  if (rules.enablePlatoonSplits && context) {
    modifiers = applyPlatoonModifier(modifiers, context);
  }
  if (rules.enableSituationalModifiers && context) {
    modifiers = applySituationalModifier(modifiers, context);
  }

  return weightedOutcome(modifiers, diceRolls, rng);
}
```

Each modifier function is isolated, testable, and only invoked when the tier enables it. The base engine path (Arcade) has zero overhead from Manager Mode features.

### Game Service: Validate Tier-Appropriate Actions

The `recordMove()` function validates that the action is legal for the tier:

```typescript
// In game-service.ts
if (action.type === 'pinchHit' && !game.rules.allowPinchHitters) {
  throw new ValidationError('Pinch hitters not available in this game mode');
}
if (action.type === 'pitchingChange' && !game.rules.allowPitchingChanges) {
  throw new ValidationError('Pitching changes not available in this game mode');
}
```

This is server-authoritative validation. Even if a hacked client sends a pinch-hit action in Arcade mode, the server rejects it.

### Roster Validation: Tier-Aware

```typescript
// In roster-validation.ts
function validateRoster(roster: Player[], rules: TierProfile): ValidationResult {
  if (roster.length !== rules.rosterSize) {
    return { valid: false, error: `Roster must have ${rules.rosterSize} players` };
  }
  if (rules.salaryCap !== null) {
    const totalSalary = roster.reduce((sum, p) => sum + p.salary, 0);
    if (totalSalary > rules.salaryCap) {
      return { valid: false, error: `Over salary cap (${totalSalary} > ${rules.salaryCap})` };
    }
  }
  // ... position requirements
}
```

---

## Data Model Changes

### User: Add Tier Stats

```typescript
interface User {
  // ... existing fields
  tierStats: Record<GameTier, { wins: number; losses: number }>;
  stakesRecord?: { wins: number; losses: number; net: number };
}
```

### Game: Add Tier and Rules

```typescript
interface GameSession {
  // ... existing fields
  tier: GameTier;
  rules: TierProfile;  // frozen at creation
}
```

### Team: Add Tier Compatibility

Teams aren't locked to a tier, but they must pass validation for the tier they're used in:

```typescript
// A 10-player team is valid for teamBuilder and arcade (via preset)
// A 25-player team is valid for manager only
// Validation happens at game creation, not at team save
```

---

## Shared Types: Contracts Package

The `TierProfile` and `GameTier` types must be shared between frontend and backend. The repo already has a `contracts/` directory — use it:

```
apps/dice-baseball/
├── contracts/
│   ├── tier.ts          # TierProfile, GameTier, TIER_PROFILES
│   ├── game.ts          # GameSession, GameState (extended)
│   └── index.ts         # re-exports
├── frontend/            # imports from ../contracts
├── backend/             # imports from ../contracts
```

Both sides import the same type definitions. No drift.

---

## Testing Strategy

### Tier Profiles Are Testable Data

```typescript
// Every tier should be independently testable
describe('TierProfile validation', () => {
  it('arcade disables all in-game decisions', () => {
    const arcade = TIER_PROFILES.arcade;
    expect(arcade.allowPinchHitters).toBe(false);
    expect(arcade.allowPitchingChanges).toBe(false);
    expect(arcade.allowDefensiveSubstitutions).toBe(false);
  });
});
```

### Engine Tests: Parameterized by Tier

```typescript
describe.each(['arcade', 'teamBuilder', 'manager'] as GameTier[])
  ('resolveAtBat in %s mode', (tier) => {
    const rules = TIER_PROFILES[tier];
    // ... test that outcomes respect the tier's enabled modifiers
  });
```

### Integration Tests: Tier-Gated Actions Rejected

```typescript
it('rejects pinch hit in arcade mode', async () => {
  const game = await createGame({ tier: 'arcade' });
  const res = await request(app)
    .post(`/api/games/${game.id}/move`)
    .send({ type: 'pinchHit', playerId: '...' });
  expect(res.status).toBe(400);
});
```

---

## Migration Path: How to Get There Without Breaking Things

The current codebase assumes a single implicit mode. Here's how to layer in tier support incrementally:

### Step 1: Define the Types (No Behavior Change)

Add `tier.ts` to contracts. Import it in both frontend and backend. Don't use it yet. Ship it.

### Step 2: Default Everything to Arcade

Add `tier: 'arcade'` and `rules: TIER_PROFILES.arcade` to game creation. The game plays identically — arcade profile matches current behavior (no subs, no fatigue, no modifiers). All existing tests pass unchanged.

### Step 3: Add Tier Selection UI

Tier picker before game creation. Only "Arcade" is selectable at first. The UI is there, the other tiers are grayed out with "Coming Soon." This establishes the player-facing concept.

### Step 4: Implement Team Builder Features

Enable Team Builder in the tier picker. Add salary cap to team validation, batting order editing, and limited pinch hitter support. Arcade still works exactly as before.

### Step 5: Implement Manager Features

Enable Manager Mode. Add expanded rosters, pitching changes, fatigue, platoon splits, situational modifiers. Each is gated behind the `rules` object. Arcade and Team Builder are untouched.

Each step is a standalone PR. No step breaks the previous one. The `rules` object is the seam that keeps everything isolated.

---

## Rules of Thumb

1. **Never check `tier === 'manager'`** in component or service code. Check `rules.allowPitchingChanges` instead. If a feature is added to a different tier later, only `TIER_PROFILES` changes — not every call site.

2. **The server is authoritative on tier definitions.** The client sends a tier name. The server resolves the profile. A tampered client can't upgrade its own tier.

3. **New features default to `false` / disabled.** When adding a new field to `TierProfile`, set it to `false` in all profiles first. Then enable it in the appropriate tier. This means new code ships dark by default.

4. **One Game.tsx, not three.** Feature gates inside a single component tree. Shared layout, shared state flow, conditionally rendered panels.

5. **Test each tier independently.** Every engine test should parameterize across tiers. A bug in fatigue calculation can't affect Arcade if fatigue is gated behind `enablePitcherFatigue`.

6. **Tier profiles are immutable at runtime.** They're frozen into the game at creation. Mid-game tier changes are not a thing. If the profile definition changes in a future deploy, existing games keep their original rules.

---

*Last updated: 2026-03-10*
