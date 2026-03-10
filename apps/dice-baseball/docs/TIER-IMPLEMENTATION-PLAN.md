# Tier Implementation Plan

## Objective
Thread tier configuration through the full stack. Feature parity: arcade mode behaves identically to current behavior. Team Builder and Manager tiers are defined and selectable but their unique mechanics (fatigue, platoon, etc.) are gated stubs — infrastructure only, no new game logic.

## Steps

### 1. Shared Types (`contracts/tier.ts`)
- Define `GameTier`, `TierProfile`, `TIER_PROFILES`
- Export from `contracts/index.d.ts`
- Unit test: validate all three profiles have correct flags

### 2. Backend Game Types
- Extend in-memory `Game` type in `game-service.ts` with `tier: GameTier` and `rules: TierProfile`
- Update `GameSession` contract with same fields

### 3. Game Engine (`game-engine.ts`)
- Add optional `rules?: TierProfile` parameter to `resolveAtBat()`
- Add optional `gameContext?: GameContext` parameter
- When rules provided and modifiers enabled, apply stub modifier functions (return 1.0 for now)
- When rules absent or modifiers disabled, behavior is identical to current
- **All 123 existing engine tests must pass unchanged**

### 4. Game Service (`game-service.ts`)
- `createGame()` accepts optional `tier` (defaults to 'arcade')
- Resolves `TIER_PROFILES[tier]` and stores on game object
- `recordMove()` passes `game.rules` to `resolveAtBat()`
- Add tier-based action validation (reject pinchHit/pitchingChange if rules disallow)

### 5. Routes (`routes/games.ts`)
- POST /api/games accepts optional `tier` field in body
- Validates tier is valid GameTier value
- Passes to `createGame()`
- GET endpoints return tier/rules on game object

### 6. WebSocket (`socket/index.ts`)
- `game:state` event includes tier and rules
- `game:roll-result` event unchanged (rules already on game)
- No other socket changes needed

### 7. Roster Validation (`roster-validation.ts`)
- Add `validateRosterForTier(roster, rules)` that checks `rules.rosterSize`
- Existing `validateRoster()` unchanged (backward compat)
- Game creation route uses tier-aware validation

### 8. Frontend Types (`types/index.ts`)
- Add `GameTier`, `TierProfile` types (mirror contracts)
- Add `TIER_PROFILES` constant
- Extend `Game` interface with `tier` and `rules`

### 9. Frontend Components
- Create `FeatureGate.tsx` component
- Add tier selection to Play.tsx (create game flow)
- Game.tsx: wrap future-tier UI sections in FeatureGate (no visible change for arcade)

### 10. Tests
- **New unit tests**: TierProfile validation, tier-aware resolveAtBat, tier-aware roster validation
- **New integration tests**: game creation with tier, tier in game state response
- **Verify**: all 209 existing tests pass with zero modifications

## File Change Summary
```
MODIFY: contracts/index.d.ts
CREATE: contracts/tier.ts
MODIFY: backend/src/services/game-engine.ts
MODIFY: backend/src/services/game-service.ts
MODIFY: backend/src/services/roster-validation.ts
MODIFY: backend/src/routes/games.ts
MODIFY: backend/src/socket/index.ts
CREATE: backend/src/__tests__/unit/tier.test.ts
MODIFY: backend/src/__tests__/integration/game-routes.test.ts
MODIFY: frontend/src/types/index.ts
CREATE: frontend/src/components/common/FeatureGate.tsx
MODIFY: frontend/src/pages/Play.tsx
MODIFY: frontend/src/pages/Game.tsx
MODIFY: frontend/src/stores/gameStore.ts
```
