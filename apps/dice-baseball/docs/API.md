# Dice Baseball V2: API Specification

## Overview

The API consists of two layers:
1. **REST API** - CRUD operations, player search, team management
2. **WebSocket API** - Real-time game state synchronization

Base URLs:
- REST: `https://api.dicebaseball.example.com/v1`
- WebSocket: `wss://api.dicebaseball.example.com`

---

## Authentication

All API requests require authentication via Supabase Auth JWT tokens.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Error Response (Unauthorized)
```json
{
    "error": "unauthorized",
    "message": "Invalid or expired token"
}
```

---

## REST API Endpoints

### Authentication

Authentication is handled by Supabase Auth client-side. The backend validates JWTs.

---

### Users

#### GET /users/me

Get current authenticated user's profile.

**Response 200:**
```json
{
    "id": "uuid",
    "email": "kevin@example.com",
    "username": "kevin",
    "avatarUrl": "https://...",
    "createdAt": "2025-01-15T10:00:00Z",
    "gamesPlayed": 23,
    "wins": 15,
    "losses": 8
}
```

---

#### PATCH /users/me

Update current user's profile.

**Request:**
```json
{
    "username": "newusername",
    "avatarUrl": "https://..."
}
```

**Response 200:**
```json
{
    "id": "uuid",
    "username": "newusername",
    "avatarUrl": "https://...",
    "updatedAt": "2025-01-20T14:30:00Z"
}
```

**Error 400:**
```json
{
    "error": "validation_error",
    "message": "Username must be 3-20 alphanumeric characters"
}
```

**Error 409:**
```json
{
    "error": "conflict",
    "message": "Username already taken"
}
```

---

#### GET /users/:id

Get public profile of another user.

**Response 200:**
```json
{
    "id": "uuid",
    "username": "sarah",
    "avatarUrl": "https://...",
    "gamesPlayed": 45,
    "wins": 28,
    "losses": 17
}
```

---

#### GET /users/search?q={query}

Search users by username (for adding friends).

**Parameters:**
- `q` (required): Search query, minimum 3 characters

**Response 200:**
```json
{
    "users": [
        {
            "id": "uuid",
            "username": "sarah123",
            "avatarUrl": "https://...",
            "gamesPlayed": 45,
            "wins": 28,
            "losses": 17
        }
    ]
}
```

---

### Friends

#### GET /friends

Get current user's friends list.

**Response 200:**
```json
{
    "friends": [
        {
            "id": "uuid",
            "username": "sarah",
            "avatarUrl": "https://...",
            "gamesPlayed": 45,
            "wins": 28,
            "losses": 17,
            "isOnline": true,
            "friendsSince": "2025-01-10T08:00:00Z"
        }
    ]
}
```

---

#### POST /friends

Add a friend (creates bidirectional friendship).

**Request:**
```json
{
    "userId": "friend-uuid"
}
```

**Response 201:**
```json
{
    "message": "Friend added",
    "friend": {
        "id": "uuid",
        "username": "sarah"
    }
}
```

**Error 400:**
```json
{
    "error": "bad_request",
    "message": "Cannot friend yourself"
}
```

**Error 409:**
```json
{
    "error": "conflict",
    "message": "Already friends with this user"
}
```

---

#### DELETE /friends/:userId

Remove a friend.

**Response 204:** No content

---

### Teams

#### GET /teams

Get current user's teams.

**Response 200:**
```json
{
    "teams": [
        {
            "id": "uuid",
            "name": "Kevin's Crushers",
            "isActive": true,
            "rosterComplete": true,
            "createdAt": "2025-01-15T10:00:00Z",
            "updatedAt": "2025-01-18T14:00:00Z"
        },
        {
            "id": "uuid2",
            "name": "Dream Team",
            "isActive": false,
            "rosterComplete": false,
            "createdAt": "2025-01-20T09:00:00Z"
        }
    ]
}
```

---

#### POST /teams

Create a new team.

**Request:**
```json
{
    "name": "My New Team"
}
```

**Response 201:**
```json
{
    "id": "uuid",
    "name": "My New Team",
    "isActive": false,
    "roster": [],
    "createdAt": "2025-01-20T10:00:00Z"
}
```

---

#### GET /teams/:id

Get team details with full roster.

**Response 200:**
```json
{
    "id": "uuid",
    "name": "Kevin's Crushers",
    "isActive": true,
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-18T14:00:00Z",
    "roster": [
        {
            "position": "SS",
            "battingOrder": 1,
            "player": {
                "mlbId": 596115,
                "fullName": "Trea Turner",
                "primaryPosition": "SS",
                "currentTeam": "PHI",
                "photoUrl": "https://img.mlb.com/...",
                "battingStats": {
                    "avg": 0.298,
                    "obp": 0.358,
                    "slg": 0.480,
                    "ops": 0.838,
                    "homeRuns": 21,
                    "rbi": 76
                }
            }
        },
        {
            "position": "CF",
            "battingOrder": 2,
            "player": {
                "mlbId": 545361,
                "fullName": "Mike Trout",
                "primaryPosition": "CF",
                "currentTeam": "LAA",
                "photoUrl": "https://img.mlb.com/...",
                "battingStats": {
                    "avg": 0.285,
                    "obp": 0.390,
                    "slg": 0.555,
                    "ops": 0.945,
                    "homeRuns": 32,
                    "rbi": 88
                }
            }
        }
        // ... 7 more position players + 1 pitcher
    ]
}
```

---

#### PATCH /teams/:id

Update team name or active status.

**Request:**
```json
{
    "name": "Updated Name",
    "isActive": true
}
```

**Response 200:**
```json
{
    "id": "uuid",
    "name": "Updated Name",
    "isActive": true,
    "updatedAt": "2025-01-20T11:00:00Z"
}
```

**Note:** Setting `isActive: true` automatically sets all other teams to `isActive: false`.

---

#### DELETE /teams/:id

Delete a team. Cannot delete active team if it's the only one.

**Response 204:** No content

**Error 400:**
```json
{
    "error": "bad_request",
    "message": "Cannot delete your only team"
}
```

---

### Roster Management

#### PUT /teams/:id/roster

Set entire roster (upsert all slots).

**Request:**
```json
{
    "slots": [
        { "position": "C", "mlbPlayerId": 518735, "battingOrder": 9 },
        { "position": "1B", "mlbPlayerId": 518692, "battingOrder": 4 },
        { "position": "2B", "mlbPlayerId": 543760, "battingOrder": 8 },
        { "position": "3B", "mlbPlayerId": 571448, "battingOrder": 5 },
        { "position": "SS", "mlbPlayerId": 596115, "battingOrder": 1 },
        { "position": "LF", "mlbPlayerId": 665742, "battingOrder": 7 },
        { "position": "CF", "mlbPlayerId": 545361, "battingOrder": 2 },
        { "position": "RF", "mlbPlayerId": 605141, "battingOrder": 6 },
        { "position": "SP", "mlbPlayerId": 543037, "battingOrder": null }
    ]
}
```

**Response 200:**
```json
{
    "message": "Roster updated",
    "team": { /* full team object */ }
}
```

**Error 400:**
```json
{
    "error": "validation_error",
    "message": "Must have exactly 9 position players and 1 pitcher",
    "details": {
        "missingPositions": ["LF"],
        "duplicatePlayers": [],
        "invalidBattingOrder": false
    }
}
```

---

#### PUT /teams/:id/roster/:position

Update single roster slot.

**Request:**
```json
{
    "mlbPlayerId": 660271,
    "battingOrder": 3
}
```

**Response 200:**
```json
{
    "position": "DH",
    "battingOrder": 3,
    "player": {
        "mlbId": 660271,
        "fullName": "Shohei Ohtani",
        "primaryPosition": "DH",
        "currentTeam": "LAD",
        "photoUrl": "https://img.mlb.com/...",
        "battingStats": { /* ... */ }
    }
}
```

---

#### DELETE /teams/:id/roster/:position

Remove player from roster slot.

**Response 204:** No content

---

#### PUT /teams/:id/batting-order

Reorder batting lineup without changing players.

**Request:**
```json
{
    "order": ["SS", "CF", "DH", "1B", "3B", "RF", "LF", "2B", "C"]
}
```

**Response 200:**
```json
{
    "message": "Batting order updated",
    "battingOrder": [
        { "order": 1, "position": "SS", "playerName": "Trea Turner" },
        { "order": 2, "position": "CF", "playerName": "Mike Trout" },
        // ...
    ]
}
```

---

### MLB Players

#### GET /mlb/players

Search and filter MLB players.

**Parameters:**
- `q` (optional): Search by name
- `position` (optional): Filter by position (C, 1B, 2B, 3B, SS, LF, CF, RF, DH, SP, RP)
- `team` (optional): Filter by team abbreviation (NYY, LAD, etc.)
- `sort` (optional): Sort field (ops, avg, hr, era, whip) - default: ops
- `order` (optional): asc or desc - default: desc
- `limit` (optional): Results per page - default: 20, max: 100
- `offset` (optional): Pagination offset - default: 0

**Example:** `GET /mlb/players?position=SS&sort=ops&limit=10`

**Response 200:**
```json
{
    "players": [
        {
            "mlbId": 665742,
            "fullName": "Juan Soto",
            "firstName": "Juan",
            "lastName": "Soto",
            "primaryPosition": "RF",
            "currentTeam": "NYY",
            "currentTeamId": 147,
            "photoUrl": "https://img.mlb.com/mlb-photos/image/upload/.../665742/headshot/67/current",
            "salary": 31000000,
            "battingStats": {
                "gamesPlayed": 155,
                "atBats": 568,
                "avg": 0.288,
                "obp": 0.410,
                "slg": 0.530,
                "ops": 0.940,
                "homeRuns": 35,
                "rbi": 102,
                "walks": 128,
                "strikeouts": 125
            },
            "lastUpdated": "2025-01-20T05:00:00Z"
        }
    ],
    "total": 45,
    "limit": 20,
    "offset": 0
}
```

---

#### GET /mlb/players/:mlbId

Get single player details.

**Response 200:**
```json
{
    "mlbId": 660271,
    "fullName": "Shohei Ohtani",
    "firstName": "Shohei",
    "lastName": "Ohtani",
    "primaryPosition": "DH",
    "currentTeam": "LAD",
    "currentTeamId": 119,
    "photoUrl": "https://img.mlb.com/...",
    "salary": 70000000,
    "battingStats": {
        "gamesPlayed": 159,
        "atBats": 599,
        "avg": 0.312,
        "obp": 0.412,
        "slg": 0.650,
        "ops": 1.062,
        "homeRuns": 52,
        "rbi": 118,
        "walks": 98,
        "strikeouts": 165,
        "stolenBases": 54
    },
    "pitchingStats": null,
    "seasonYear": 2025,
    "isActive": true,
    "lastUpdated": "2025-01-20T05:00:00Z"
}
```

**Error 404:**
```json
{
    "error": "not_found",
    "message": "Player not found"
}
```

---

#### GET /mlb/teams

Get list of MLB teams.

**Response 200:**
```json
{
    "teams": [
        { "id": 147, "name": "New York Yankees", "abbreviation": "NYY" },
        { "id": 119, "name": "Los Angeles Dodgers", "abbreviation": "LAD" },
        // ... all 30 teams
    ]
}
```

---

### Games

#### POST /games

Create a new game (current user is home team).

**Request:**
```json
{
    "teamId": "uuid",
    "isPrivate": true
}
```

**Response 201:**
```json
{
    "id": "game-uuid",
    "joinCode": "ABC123",
    "status": "waiting",
    "homeUser": {
        "id": "uuid",
        "username": "kevin"
    },
    "homeTeam": {
        "id": "uuid",
        "name": "Kevin's Crushers"
    },
    "createdAt": "2025-01-20T15:00:00Z",
    "websocketUrl": "wss://api.dicebaseball.example.com?gameId=game-uuid"
}
```

---

#### GET /games/:id

Get game details.

**Response 200:**
```json
{
    "id": "game-uuid",
    "joinCode": "ABC123",
    "status": "active",
    "homeUser": {
        "id": "uuid",
        "username": "kevin"
    },
    "homeTeam": {
        "id": "uuid",
        "name": "Kevin's Crushers"
    },
    "visitorUser": {
        "id": "uuid",
        "username": "sarah"
    },
    "visitorTeam": {
        "id": "uuid",
        "name": "Sarah's Stars"
    },
    "gameState": {
        "inning": 5,
        "isTopOfInning": true,
        "outs": 2,
        "scores": [3, 1],
        "bases": [true, true, false],
        "currentBatterIndex": 4,
        "pitchCount": [2, 1]
    },
    "createdAt": "2025-01-20T15:00:00Z",
    "startedAt": "2025-01-20T15:02:00Z"
}
```

---

#### POST /games/join

Join a game by code.

**Request:**
```json
{
    "joinCode": "ABC123",
    "teamId": "uuid"
}
```

**Response 200:**
```json
{
    "id": "game-uuid",
    "status": "active",
    "message": "Joined game successfully",
    "websocketUrl": "wss://api.dicebaseball.example.com?gameId=game-uuid"
}
```

**Error 404:**
```json
{
    "error": "not_found",
    "message": "Game not found or already started"
}
```

**Error 400:**
```json
{
    "error": "bad_request",
    "message": "Cannot join your own game"
}
```

---

#### GET /games/history

Get user's game history.

**Parameters:**
- `status` (optional): Filter by status (completed, forfeit)
- `limit` (optional): default 20
- `offset` (optional): default 0

**Response 200:**
```json
{
    "games": [
        {
            "id": "uuid",
            "opponent": {
                "id": "uuid",
                "username": "sarah"
            },
            "wasHome": true,
            "won": true,
            "score": {
                "home": 5,
                "visitor": 3
            },
            "innings": 9,
            "completedAt": "2025-01-20T16:30:00Z"
        }
    ],
    "total": 23,
    "limit": 20,
    "offset": 0
}
```

---

#### DELETE /games/:id

Abandon/forfeit a game.

**Response 200:**
```json
{
    "message": "Game forfeited",
    "status": "forfeit",
    "winnerId": "opponent-uuid"
}
```

---

## WebSocket API

### Connection

Connect to WebSocket with authentication and game ID:

```javascript
const socket = io('wss://api.dicebaseball.example.com', {
    auth: {
        token: 'jwt_token'
    },
    query: {
        gameId: 'game-uuid'
    }
});
```

### Client → Server Events

#### `game:ready`

Signal that client is ready to start (both players must send).

```javascript
socket.emit('game:ready');
```

---

#### `game:roll`

Request a dice roll (only valid when it's your turn).

```javascript
socket.emit('game:roll');
```

---

#### `game:forfeit`

Forfeit the game.

```javascript
socket.emit('game:forfeit');
```

---

#### `game:rematch`

Request a rematch after game ends.

```javascript
socket.emit('game:rematch');
```

---

#### `ping`

Heartbeat to maintain connection.

```javascript
socket.emit('ping');
```

---

### Server → Client Events

#### `game:state`

Full game state update (sent on connect and after each play).

```javascript
socket.on('game:state', (state) => {
    // state object structure
    {
        inning: 5,
        isTopOfInning: true,
        outs: 2,
        scores: [3, 1],
        inningScores: [[0,2,0,1,null,null,null,null,null], [1,0,0,0,null,null,null,null,null]],
        bases: [true, true, false],  // [1st, 2nd, 3rd]

        // Current matchup
        currentBatter: {
            mlbId: 545361,
            name: "Mike Trout",
            position: "CF",
            battingOrder: 2,
            stats: { avg: 0.285, ops: 0.945, hr: 32 }
        },
        currentPitcher: {
            mlbId: 543037,
            name: "Gerrit Cole",
            stats: { era: 3.12, whip: 1.06, k: 215 }
        },

        pitchCount: [2, 1],  // [balls, strikes]

        // Turn info
        isYourTurn: true,
        turnPlayerId: "uuid",

        // Last play (if any)
        lastPlay: {
            batter: "Shohei Ohtani",
            pitcher: "Gerrit Cole",
            outcome: "single",
            description: "Ohtani singled to right, Turner scored from 2nd!",
            runsScored: 1,
            diceRolls: [4, 5]
        },

        // Game over
        isGameOver: false,
        winner: null
    }
});
```

---

#### `game:roll-result`

Dice roll result with animation data.

```javascript
socket.on('game:roll-result', (result) => {
    {
        diceRolls: [4, 6],
        outcome: "double",
        batter: {
            mlbId: 545361,
            name: "Mike Trout"
        },
        pitcher: {
            mlbId: 543037,
            name: "Gerrit Cole"
        },
        description: "Trout doubled off the wall! Runner scores from first!",
        runsScored: 1,
        outsRecorded: 0,

        // For animation timing
        animationDelay: 1500  // ms to wait before showing result
    }
});
```

---

#### `game:started`

Both players ready, game begins.

```javascript
socket.on('game:started', (data) => {
    {
        homeTeam: {
            userId: "uuid",
            username: "kevin",
            teamName: "Kevin's Crushers"
        },
        visitorTeam: {
            userId: "uuid",
            username: "sarah",
            teamName: "Sarah's Stars"
        },
        firstBatter: {
            name: "Trea Turner",
            team: "visitor"
        }
    }
});
```

---

#### `game:ended`

Game has concluded.

```javascript
socket.on('game:ended', (data) => {
    {
        winner: {
            userId: "uuid",
            username: "kevin"
        },
        finalScore: {
            home: 5,
            visitor: 3
        },
        innings: 9,
        reason: "completed",  // or "forfeit", "disconnect"
        stats: {
            home: { hits: 9, errors: 0 },
            visitor: { hits: 7, errors: 1 }
        }
    }
});
```

---

#### `opponent:connected`

Opponent has connected/reconnected.

```javascript
socket.on('opponent:connected', () => {
    // Update UI to show opponent is online
});
```

---

#### `opponent:disconnected`

Opponent has disconnected.

```javascript
socket.on('opponent:disconnected', (data) => {
    {
        timeout: 60  // seconds until auto-forfeit
    }
});
```

---

#### `game:rematch-requested`

Opponent wants a rematch.

```javascript
socket.on('game:rematch-requested', () => {
    // Show rematch prompt
});
```

---

#### `game:rematch-accepted`

Rematch starting.

```javascript
socket.on('game:rematch-accepted', (data) => {
    {
        newGameId: "new-game-uuid"
    }
});
```

---

#### `error`

Error occurred.

```javascript
socket.on('error', (error) => {
    {
        code: "not_your_turn",
        message: "It's not your turn to roll"
    }
});
```

**Error codes:**
- `not_your_turn` - Tried to roll when not your turn
- `game_not_found` - Game doesn't exist
- `game_not_active` - Game is waiting/completed/abandoned
- `invalid_action` - Action not allowed in current state
- `connection_error` - WebSocket connection issue

---

#### `pong`

Heartbeat response.

```javascript
socket.on('pong', () => {
    // Connection is alive
});
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| REST API (general) | 60 requests/minute |
| POST /games | 10 requests/minute |
| POST /friends | 20 requests/minute |
| GET /mlb/players | 120 requests/minute |
| WebSocket events | 30 events/minute |

**Rate Limit Response (429):**
```json
{
    "error": "rate_limit_exceeded",
    "message": "Too many requests",
    "retryAfter": 45
}
```

---

## Error Response Format

All errors follow this format:

```json
{
    "error": "error_code",
    "message": "Human readable message",
    "details": {}  // Optional additional info
}
```

**Common error codes:**
- `bad_request` (400)
- `unauthorized` (401)
- `forbidden` (403)
- `not_found` (404)
- `conflict` (409)
- `validation_error` (422)
- `rate_limit_exceeded` (429)
- `internal_error` (500)
