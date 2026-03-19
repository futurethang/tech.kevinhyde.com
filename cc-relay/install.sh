#!/usr/bin/env bash
# install.sh — Install cc-relay: hooks, daemon, and launchd service
set -euo pipefail

RELAY_DIR="$HOME/.cc-relay"
HOOKS_DIR="$RELAY_DIR/hooks"
EVENTS_DIR="$RELAY_DIR/events"
PIPES_DIR="$RELAY_DIR/pipes"
SETTINGS_FILE="$HOME/.claude/settings.json"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS/com.kevinhyde.cc-relay.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== cc-relay installer ==="
echo ""

# 1. Check dependencies
echo "Checking dependencies..."

if ! command -v jq &>/dev/null; then
    echo "⚠  jq not found. Install with: brew install jq"
    echo "   (Required for settings.json manipulation)"
fi

if ! command -v terminal-notifier &>/dev/null; then
    echo "⚠  terminal-notifier not found. Install with: brew install terminal-notifier"
    echo "   (Optional but recommended for Stop hook notifications)"
fi

if ! command -v swift &>/dev/null; then
    echo "✗  Swift not found. Install Xcode Command Line Tools:"
    echo "   xcode-select --install"
    exit 1
fi

echo "✓  Dependencies OK"
echo ""

# 2. Create directories
echo "Creating directories..."
mkdir -p "$RELAY_DIR" "$HOOKS_DIR" "$EVENTS_DIR" "$PIPES_DIR"
echo "✓  Created $RELAY_DIR"

# 3. Copy hook scripts
echo "Installing hook scripts..."
cp "$SCRIPT_DIR/hooks/cc-relay-hook.sh" "$HOOKS_DIR/cc-relay-hook.sh"
cp "$SCRIPT_DIR/hooks/cc-relay-stop.sh" "$HOOKS_DIR/cc-relay-stop.sh"
chmod +x "$HOOKS_DIR/cc-relay-hook.sh"
chmod +x "$HOOKS_DIR/cc-relay-stop.sh"
echo "✓  Hooks installed to $HOOKS_DIR"

# 4. Build Swift daemon
echo "Building cc-relay daemon (this may take a moment on first build)..."
cd "$SCRIPT_DIR/CCRelay"
swift build -c release 2>&1 | tail -5
BINARY_PATH=$(swift build -c release --show-bin-path)/CCRelay
cp "$BINARY_PATH" "$RELAY_DIR/cc-relay"
chmod +x "$RELAY_DIR/cc-relay"
echo "✓  Daemon built and installed to $RELAY_DIR/cc-relay"
cd "$SCRIPT_DIR"
echo ""

# 5. Merge hooks into settings.json
echo "Configuring Claude Code hooks..."
mkdir -p "$(dirname "$SETTINGS_FILE")"

if [ ! -f "$SETTINGS_FILE" ]; then
    echo '{}' > "$SETTINGS_FILE"
fi

# Build the hook config to merge
HOOK_CONFIG=$(cat <<'HOOKEOF'
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "HOOKS_DIR_PLACEHOLDER/cc-relay-hook.sh",
            "timeout": 300
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "HOOKS_DIR_PLACEHOLDER/cc-relay-stop.sh"
          }
        ]
      }
    ]
  }
}
HOOKEOF
)

# Replace placeholder with actual path
HOOK_CONFIG=$(echo "$HOOK_CONFIG" | sed "s|HOOKS_DIR_PLACEHOLDER|$HOOKS_DIR|g")

if command -v jq &>/dev/null; then
    # Deep merge using jq — preserves existing settings
    MERGED=$(jq -s '
        def deep_merge(a; b):
            a as $a | b as $b |
            if ($a | type) == "object" and ($b | type) == "object" then
                reduce ($b | keys[]) as $key ($a;
                    if ($a | has($key)) then
                        .[$key] = deep_merge($a[$key]; $b[$key])
                    else
                        .[$key] = $b[$key]
                    end
                )
            elif ($a | type) == "array" and ($b | type) == "array" then
                $a + $b
            else
                $b
            end;
        deep_merge(.[0]; .[1])
    ' "$SETTINGS_FILE" <(echo "$HOOK_CONFIG"))
    echo "$MERGED" | jq '.' > "$SETTINGS_FILE"
    echo "✓  Hooks merged into $SETTINGS_FILE"
else
    echo "⚠  jq not available — writing hook config manually"
    echo "   Please verify $SETTINGS_FILE is correct"
    echo "$HOOK_CONFIG" > "$SETTINGS_FILE"
fi
echo ""

# 6. Create launchd plist
echo "Setting up launchd service..."
mkdir -p "$LAUNCH_AGENTS"

cat > "$PLIST_PATH" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.kevinhyde.cc-relay</string>
    <key>ProgramArguments</key>
    <array>
        <string>$RELAY_DIR/cc-relay</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardRestartInterval</key>
    <integer>5</integer>
    <key>StandardErrorPath</key>
    <string>$RELAY_DIR/daemon.log</string>
    <key>StandardOutPath</key>
    <string>$RELAY_DIR/daemon.log</string>
</dict>
</plist>
PLISTEOF

echo "✓  Plist created at $PLIST_PATH"

# 7. Load the service
echo "Starting daemon..."
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load "$PLIST_PATH"
echo "✓  Daemon loaded via launchd"
echo ""

echo "=== Installation complete ==="
echo ""
echo "cc-relay installed. Press ⌘⇧Return from any app when Claude needs you."
echo ""
echo "Logs: $RELAY_DIR/daemon.log"
echo "Hooks: $HOOKS_DIR/"
echo "Binary: $RELAY_DIR/cc-relay"
