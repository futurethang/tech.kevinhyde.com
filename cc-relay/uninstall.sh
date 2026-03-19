#!/usr/bin/env bash
# uninstall.sh — Remove cc-relay completely
set -euo pipefail

RELAY_DIR="$HOME/.cc-relay"
SETTINGS_FILE="$HOME/.claude/settings.json"
PLIST_PATH="$HOME/Library/LaunchAgents/com.kevinhyde.cc-relay.plist"

echo "=== cc-relay uninstaller ==="
echo ""

# 1. Stop and unload the daemon
echo "Stopping daemon..."
if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "✓  Daemon stopped and plist removed"
else
    echo "  (no plist found)"
fi

# 2. Remove cc-relay directory
echo "Removing cc-relay files..."
if [ -d "$RELAY_DIR" ]; then
    rm -rf "$RELAY_DIR"
    echo "✓  Removed $RELAY_DIR"
else
    echo "  (directory not found)"
fi

# 3. Strip cc-relay hooks from settings.json
echo "Cleaning Claude Code settings..."
if [ -f "$SETTINGS_FILE" ] && command -v jq &>/dev/null; then
    # Remove hook entries that reference cc-relay
    CLEANED=$(jq '
        if .hooks then
            .hooks |= with_entries(
                .value |= map(
                    .hooks |= map(select(.command | test("cc-relay") | not))
                ) | map(select(.hooks | length > 0))
            ) | if .hooks | all(length == 0) then del(.hooks) else . end
        else
            .
        end
    ' "$SETTINGS_FILE")
    echo "$CLEANED" | jq '.' > "$SETTINGS_FILE"
    echo "✓  cc-relay hooks removed from $SETTINGS_FILE"
else
    if [ -f "$SETTINGS_FILE" ]; then
        echo "⚠  jq not available — please manually remove cc-relay hooks from $SETTINGS_FILE"
    else
        echo "  (no settings file found)"
    fi
fi

echo ""
echo "cc-relay removed."
