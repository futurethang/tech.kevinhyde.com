#!/usr/bin/env bash
# cc-relay-hook.sh — Claude Code Notification hook
# Reads HITL event from stdin, writes event file, blocks on named pipe for response.

set -euo pipefail

RELAY_DIR="$HOME/.cc-relay"
EVENTS_DIR="$RELAY_DIR/events"
PIPES_DIR="$RELAY_DIR/pipes"
PIPE_TIMEOUT=300  # 5 minutes

# Ensure directories exist
mkdir -p "$EVENTS_DIR" "$PIPES_DIR"

# Read JSON payload from stdin
PAYLOAD=$(cat)

# Extract fields from the JSON payload
SESSION_ID=$(echo "$PAYLOAD" | jq -r '.session_id // empty')
CWD=$(echo "$PAYLOAD" | jq -r '.cwd // empty')
MESSAGE=$(echo "$PAYLOAD" | jq -r '.message // empty')

# If session_id is missing, generate one from PID
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="unknown-$$"
fi

# Default CWD to current directory if missing
if [ -z "$CWD" ]; then
  CWD="$(pwd)"
fi

# Derive repo name and branch
REPO_NAME=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null | xargs basename 2>/dev/null || echo "unknown")
BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "unknown")

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

PIPE_PATH="$PIPES_DIR/$SESSION_ID"
EVENT_PATH="$EVENTS_DIR/$SESSION_ID.json"

# Cleanup named pipe on exit (trap ensures cleanup if session exits unexpectedly)
cleanup() {
  rm -f "$PIPE_PATH"
}
trap cleanup EXIT

# Create the named pipe if it doesn't already exist
if [ ! -p "$PIPE_PATH" ]; then
  mkfifo "$PIPE_PATH"
fi

# Write structured event JSON
cat > "$EVENT_PATH" <<EOF
{
  "session_id": $(echo "$SESSION_ID" | jq -R .),
  "cwd": $(echo "$CWD" | jq -R .),
  "repo_name": $(echo "$REPO_NAME" | jq -R .),
  "branch": $(echo "$BRANCH" | jq -R .),
  "message": $(echo "$MESSAGE" | jq -R .),
  "timestamp": "$TIMESTAMP"
}
EOF

# Block reading from the named pipe with timeout
# If daemon isn't running, timeout and auto-approve (exit 0)
RESPONSE=""
if command -v timeout &>/dev/null; then
  RESPONSE=$(timeout "$PIPE_TIMEOUT" cat "$PIPE_PATH" 2>/dev/null || echo "allow")
elif command -v gtimeout &>/dev/null; then
  RESPONSE=$(gtimeout "$PIPE_TIMEOUT" cat "$PIPE_PATH" 2>/dev/null || echo "allow")
else
  # Fallback: use a background read with a sleep-based timeout
  (
    sleep "$PIPE_TIMEOUT"
    # If we're still alive after timeout, write allow to unblock
    echo "allow" > "$PIPE_PATH" 2>/dev/null || true
  ) &
  TIMEOUT_PID=$!
  RESPONSE=$(cat "$PIPE_PATH" 2>/dev/null || echo "allow")
  kill "$TIMEOUT_PID" 2>/dev/null || true
  wait "$TIMEOUT_PID" 2>/dev/null || true
fi

# Trim whitespace
RESPONSE=$(echo "$RESPONSE" | tr -d '[:space:]')

# Exit based on response
if [ "$RESPONSE" = "block" ]; then
  exit 2
else
  exit 0
fi
