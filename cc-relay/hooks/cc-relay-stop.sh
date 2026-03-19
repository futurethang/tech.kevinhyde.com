#!/usr/bin/env bash
# cc-relay-stop.sh — Claude Code Stop hook
# Fires a non-blocking "session complete" notification. Does NOT block.

set -euo pipefail

# Read JSON payload from stdin
PAYLOAD=$(cat)

SESSION_ID=$(echo "$PAYLOAD" | jq -r '.session_id // empty')
CWD=$(echo "$PAYLOAD" | jq -r '.cwd // empty')

if [ -z "$CWD" ]; then
  CWD="$(pwd)"
fi

# Derive repo name and branch
REPO_NAME=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null | xargs basename 2>/dev/null || echo "unknown")
BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "unknown")

# Clean up any leftover pipe for this session
if [ -n "$SESSION_ID" ]; then
  rm -f "$HOME/.cc-relay/pipes/$SESSION_ID"
  rm -f "$HOME/.cc-relay/events/$SESSION_ID.json"
fi

# Fire notification (non-blocking)
if command -v terminal-notifier &>/dev/null; then
  terminal-notifier \
    -title "Claude Code" \
    -subtitle "$REPO_NAME $BRANCH" \
    -message "Session complete" \
    -sender com.anthropic.claudefordesktop \
    -sound Hero &
else
  osascript -e "display notification \"Session complete\" with title \"Claude Code\" subtitle \"$REPO_NAME $BRANCH\" sound name \"Hero\"" &
fi

exit 0
