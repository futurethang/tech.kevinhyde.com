# cc-relay — Claude Code HITL Notification Relay

This file describes the design and implementation of cc-relay. See README.md for installation and usage.

## What It Does

cc-relay intercepts Claude Code human-in-the-loop moments and surfaces them as macOS notifications + a global hotkey overlay, so you can approve or block actions from anywhere in the OS without switching back to the terminal.

## Target User

Operators running 3+ parallel Claude Code sessions across Ghostty terminal tabs (each on a separate git worktree) who spend most of their time in other apps.

## Signal Flow

```
CC session hits HITL moment
  → Notification hook fires
  → cc-relay-hook.sh reads stdin JSON (session_id, cwd, message)
  → script writes event to ~/.cc-relay/events/<session_id>.json
  → script opens named pipe at ~/.cc-relay/pipes/<session_id> and BLOCKS
  → cc-relay daemon (watching ~/.cc-relay/events/) picks up the event
  → daemon fires macOS UNUserNotificationCenter notification
  → user presses global hotkey (⌘⇧Return) from anywhere in OS
  → NSPanel overlay appears above all apps (no focus steal)
  → user presses Y / N / Enter / Esc
  → daemon writes response to named pipe
  → hook script reads response, exits 0 (approve) or 2 (block)
  → CC session unblocks and continues
```

## Why Notification Hook (Not PermissionRequest)

PermissionRequest fires on every tool permission check, including auto-allowed ones — too noisy. Notification fires specifically when CC is waiting for user input. Stop is used only for "session finished" ambient awareness (sound only, no blocking).

## Repository Layout

```
cc-relay/
├── PROMPT.md                  ← this file
├── README.md                  ← installation + usage
├── hooks/
│   ├── cc-relay-hook.sh       ← Notification hook (blocks on named pipe)
│   └── cc-relay-stop.sh       ← Stop hook (non-blocking notification)
├── CCRelay/                   ← Swift package (daemon + overlay)
│   ├── Package.swift
│   ├── Sources/
│   │   └── CCRelay/
│   │       ├── main.swift
│   │       ├── Daemon.swift
│   │       ├── OverlayWindow.swift
│   │       ├── QueueManager.swift
│   │       └── NotificationManager.swift
│   └── CCRelay.entitlements
├── install.sh                 ← build, copy hooks, wire settings.json, start daemon
└── uninstall.sh               ← reverse everything
```

## Implementation Details

### Hook Scripts (Layer 1)
- **cc-relay-hook.sh**: Reads CC's JSON stdin, extracts session_id/cwd/message, derives repo name and branch via git, writes event JSON to disk, blocks on a named pipe waiting for daemon response. 5-minute timeout auto-approves if daemon is down.
- **cc-relay-stop.sh**: Fires a non-blocking notification via terminal-notifier (falls back to osascript). Cleans up pipes/events for the session.

### Swift Daemon (Layer 2)
- **main.swift**: LSUIElement app (no Dock icon). Starts daemon, registers ⌘⇧Return hotkey via KeyboardShortcuts.
- **Daemon.swift**: Watches ~/.cc-relay/events/ via DispatchSource + polling fallback. Parses event JSON, enqueues to QueueManager, fires notification, deletes event file.
- **QueueManager.swift**: Thread-safe ordered queue of ApprovalEvents. Writes "allow\n" or "block\n" to named pipes on response.
- **OverlayWindow.swift**: NSPanel (floating, non-activating, borderless). Shows repo/branch, message, key hints. Handles Y/N/Enter/Esc.
- **NotificationManager.swift**: UNUserNotificationCenter with Approve/Block actions. Handles banner action responses directly.

### Settings Integration (Layer 3)
- install.sh merges hooks into ~/.claude/settings.json using jq deep merge.
- Notification hook has 300s timeout. Stop hook has no timeout.
