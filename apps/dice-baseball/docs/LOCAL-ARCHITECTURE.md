# Dice Baseball Local Architecture (Stage 2)

Last updated: February 11, 2026

## Purpose
This document describes the architecture that is actually implemented for local development today.
It is the source of truth for running and hardening two-player gameplay locally before production deployment.

## Runtime Topology
- Frontend: React + Vite SPA (`frontend`), route base `/apps/dice-baseball`
- Backend: Node.js + Express + Socket.io (`backend`)
- Auth: JWT signed by backend (in-memory user store for local MVP)
- Data stores (local MVP): in-memory maps via repository interfaces for users/teams/games, seeded in-memory MLB player catalog

## Request/Data Flow
1. User authenticates with `POST /api/auth/register` or `POST /api/auth/login`.
2. Frontend stores JWT in Zustand-persisted auth store.
3. Team CRUD and roster updates go through REST routes under `/api/teams`.
4. Game creation/joining goes through REST routes under `/api/games`.
5. On game start, backend hydrates game team snapshots (`homeTeam`, `visitorTeam`) with roster + player stat payloads.
6. Live game events use Socket.io:
   - `game:join` -> initial `game:state`
   - `game:roll` -> server rolls dice and broadcasts `game:roll-result`
   - `game:forfeit` -> broadcasts `game:ended`

## Core Backend Modules
- `backend/src/server.ts`: app composition and middleware wiring
- `backend/src/routes/*.ts`: REST endpoints
- `backend/src/socket/index.ts`: real-time game protocol and reconnection handling
- `backend/src/services/game-engine.ts`: at-bat resolution and inning logic
- `backend/src/services/game-service.ts`: game lifecycle/state storage and move recording
- `backend/src/services/team-service.ts`: team/roster management
- `backend/src/services/mlb-sync.ts`: local player catalog/query service
- `backend/src/repositories/team-repository.ts`: team persistence interface + in-memory adapter
- `backend/src/repositories/game-repository.ts`: game persistence interface + in-memory adapter
- `contracts/index.d.ts`: shared FE/BE contracts for common API/socket payloads

## State Ownership
- Authoritative game state lives on backend (`game-service` + socket events).
- Frontend game store (`frontend/src/stores/gameStore.ts`) mirrors server state for rendering.
- Frontend should treat server state as source of truth and avoid deriving durable game outcomes client-side.

## Current Hardening Constraints
- Persistence is in-memory only (reset on backend restart).
- JWT secret defaults to local test secret when env var is absent.
- No DB migration layer yet.
- Local operability is prioritized over production infra in this stage.

## Stage 1 + Stage 2 Hardening Changes Applied
- Game start now hydrates team snapshots with roster/player stats in backend game state.
- Socket reconnect signaling de-duplicated for cleaner local reconnection behavior.
- Duplicate `DELETE /api/teams/:id` route removed.
- MLB players route now accepts both legacy and current query styles (`q`/`search`, `offset`/`page`) and supports stat range filters + name sort.
- Frontend auth response normalization introduced to keep UI user model stable.
- Shared contracts package (`@dice-baseball/contracts`) added and consumed by frontend/backend for key payload types.
- Team and game services now use repository interfaces, so storage can be swapped without changing route/socket logic.
- Backend build path now uses `backend/tsconfig.build.json` to compile runtime code only (tests/scripts excluded).
- Backend test script now supports `SKIP_NETWORK_TESTS=1` to run unit tests in bind-restricted environments.
- Milestone A foundation: deterministic simulation mode with per-game seed/state and turn-index metadata.
- Dev-only tooling endpoints added under `/api/dev` for state reset and seeded active-game provisioning.

## Near-Term Evolution Path
1. Add a durable repository adapter (PostgreSQL/Supabase) implementing existing `TeamRepository` and `GameRepository`.
2. Introduce dependency injection for repository selection by environment.
3. Expand shared contracts to cover request/response schemas end-to-end (including validation outputs).
4. Add versioned event schema for multiplayer compatibility across releases.
