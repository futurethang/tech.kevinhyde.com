# Dice Baseball Local Contracts (REST + Socket)

Last updated: February 11, 2026

## Contract Scope
This document captures the current local-development API and socket contracts that frontend and backend are expected to honor.

Shared type source:
- Local package: `@dice-baseball/contracts` (`/contracts/index.d.ts`)
- Current shared interfaces: `ApiError`, `AuthResponse`, `PlayersQuery`, `GameState`, `RollResultEvent`, `SocketEventMap`

## Authentication
- Header: `Authorization: Bearer <jwt>`
- Auth storage key (frontend): `dice-baseball-auth`

## REST Contracts

### Auth
- `POST /api/auth/register`
  - Request: `{ email, username, password }`
  - Response: `{ user: { id, email, username }, token }`
- `POST /api/auth/login`
  - Request: `{ email, password }`
  - Response: `{ user: { id, email, username }, token }`

Frontend normalization contract:
- `username` maps to frontend `displayName`
- `wins/losses` default to `0` when absent

### MLB Players
- `GET /api/mlb/players`
- Supported query params:
  - search: `q` (preferred), `search` (compat)
  - pagination: `limit`, `offset` (preferred), `page` (compat)
  - filters: `position`, `team`, `league` (accepted for compat), `minOps`, `maxOps`, `minEra`, `maxEra`, `minHr`, `maxHr`, `minRbi`, `maxRbi`
  - sorting: `sort` in `ops|avg|hr|rbi|era|whip|wins|name`, `order` in `asc|desc`
- Response: `{ players, total, limit, offset }`

### Teams
- `GET /api/teams` -> `{ teams }`
- `POST /api/teams` -> `Team`
- `GET /api/teams/:id` -> `Team`
- `PUT /api/teams/:id/roster` -> `{ message, team }`
- `PUT /api/teams/:id/draft` -> `{ message, team }`
- `PUT /api/teams/:id/batting-order` -> `{ message, battingOrder }`
- `POST /api/teams/:id/duplicate` -> `{ message, team }`
- `PATCH /api/teams/reorder` -> `{ message, teamIds }`
- `DELETE /api/teams/:id` -> `204 No Content`

### Games
- `POST /api/games` -> create waiting game
- `POST /api/games/join` -> activate game with visitor
- `GET /api/games` -> `{ games }`
- `GET /api/games/:id` -> `Game`
- `POST /api/games/:id/move` -> manual move record (REST fallback path)
- `POST /api/games/:id/forfeit` -> `{ message, winnerId, loserId }`

Game payload contract:
- `Game.state` is authoritative state snapshot.
- Active games should include `homeTeam`/`visitorTeam` snapshots with roster and resolved player data.

## Socket Contracts
Namespace: default Socket.io namespace

Client -> Server:
- `game:join` `{ gameId }`
- `game:roll` `{ gameId }`
- `game:forfeit` `{ gameId }`

Server -> Client:
- `game:state` `{ state }`
- `game:roll-result` `{ diceRolls, outcome, runsScored, outsRecorded, description, batter, pitcher, newState }`
- `game:ended` `{ winnerId, loserId, reason, finalScore? }`
- `opponent:connected` `{ userId }`
- `opponent:disconnected` `{ userId, timeout }`
- `error` `{ error, message }`

Turn contract:
- Top inning (`isTopOfInning=true`): visitor acts
- Bottom inning (`isTopOfInning=false`): home acts

## Known Compatibility Rules
- Frontend must tolerate nullable `currentTeam`/`currentTeamId` in player payloads.
- Frontend batter display must compute lineup spot via modulo (`currentBatterIndex % 9`).
- Frontend waiting-room polling must clean up timers on cancel/unmount.

## Local Validation Commands
- Frontend lint: `cd frontend && npm run lint`
- Frontend build: `cd frontend && npm run build`
- Backend runtime build (excludes tests): `cd backend && npm run build`
- Backend unit-only tests (safe in restricted envs): `cd backend && SKIP_NETWORK_TESTS=1 npm test`
