# Backend API Endpoints - Required for Team Management Enhancements

The frontend implementation is complete and requires these backend API endpoints to be created:

## 1. Draft Saving for Incomplete Rosters
**PUT** `/api/teams/:id/draft`

```javascript
{
  "slots": [
    {
      "position": "C",
      "mlbPlayerId": 545361,
      "battingOrder": 1
    },
    // ... more slots
  ]
}
```

**Response:**
```javascript
{
  "message": "Draft saved successfully"
}
```

## 2. Update Batting Order
**PUT** `/api/teams/:id/batting-order`

```javascript
{
  "order": ["C", "SS", "CF", "1B", "3B", "LF", "RF", "2B", "DH"]
}
```

**Response:**
```javascript
{
  "message": "Batting order updated successfully"
}
```

## 3. Delete Team
**DELETE** `/api/teams/:id`

**Response:** 204 No Content

## 4. Duplicate Team
**POST** `/api/teams/:id/duplicate`

```javascript
{
  "name": "Team Name Copy"
}
```

**Response:**
```javascript
{
  "id": "new-team-uuid",
  "name": "Team Name Copy",
  "userId": "user-uuid",
  "isActive": false,
  "rosterComplete": false,
  "roster": [...], // Copied from original team
  "createdAt": "2026-02-07T12:00:00Z"
}
```

## 5. Reorder Teams
**PATCH** `/api/teams/reorder`

```javascript
{
  "teamIds": ["team-1-uuid", "team-2-uuid", "team-3-uuid"]
}
```

**Response:**
```javascript
{
  "message": "Team order updated successfully"
}
```

## Implementation Notes:

1. **Authentication:** All endpoints require JWT authentication via Authorization header
2. **Validation:** Ensure user owns the team(s) being modified
3. **Draft saving:** Should save incomplete rosters without validation errors
4. **Batting order:** Only position players (not SP) should be included in batting order
5. **Team duplication:** Reset `isActive: false` and `rosterComplete: false` for duplicates
6. **Soft deletes:** Consider implementing soft deletes instead of hard deletes
7. **Audit logging:** Consider logging team operations for debugging

## Database Schema Updates:

If not already present, you may need:

```sql
-- Add order column to teams table
ALTER TABLE teams ADD COLUMN display_order INTEGER DEFAULT 0;

-- Add index for team ordering
CREATE INDEX idx_teams_user_order ON teams(user_id, display_order);

-- Add draft saving timestamp
ALTER TABLE teams ADD COLUMN draft_saved_at TIMESTAMP;
```