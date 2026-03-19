# cc-relay

A lightweight macOS utility that intercepts Claude Code human-in-the-loop (HITL) moments and surfaces them as OS-level notifications with a global hotkey overlay. Approve or block Claude Code actions from anywhere in the OS — no app switching required. Built for operators running 3+ parallel Claude Code sessions across Ghostty terminal tabs.

## Prerequisites

- **macOS 13+**
- **Xcode Command Line Tools** — `xcode-select --install`
- **jq** — `brew install jq` (required for settings.json manipulation)
- **terminal-notifier** (optional, recommended) — `brew install terminal-notifier` (enables Claude icon on Stop notifications)
- **Claude.app** installed (for notification icon via `-sender com.anthropic.claudefordesktop`)

## Install

```bash
git clone <repo-url>
cd cc-relay
./install.sh
```

The installer will:
1. Build the Swift daemon
2. Copy hook scripts to `~/.cc-relay/hooks/`
3. Merge Notification and Stop hooks into `~/.claude/settings.json`
4. Set up a launchd service to keep the daemon running

## Usage

**Default hotkey:** `⌘⇧Return` (Command + Shift + Return)

When Claude Code hits a HITL moment (needs approval):

1. A macOS notification fires immediately with the action details
2. **Quick response:** Tap "Approve" or "Block" directly on the notification banner
3. **Overlay response:** Press `⌘⇧Return` from any app — a floating overlay appears showing the pending action. Press `Y` to approve, `N` to block, `Esc` to dismiss

Multiple sessions queue up — the overlay shows a badge ("+2 more waiting") and cycles through them.

## Changing the Hotkey

The hotkey is stored in UserDefaults via the [KeyboardShortcuts](https://github.com/sindresorhus/KeyboardShortcuts) library. To change it programmatically, use the KeyboardShortcuts API. No config file needed.

## Uninstall

```bash
./uninstall.sh
```

This removes the daemon, hooks, launchd service, and cleans `~/.claude/settings.json`.

## Architecture

```
CC session hits HITL moment
  → Notification hook fires
  → cc-relay-hook.sh writes event to ~/.cc-relay/events/ and blocks on a named pipe
  → cc-relay daemon picks up the event
  → macOS notification fires
  → User presses ⌘⇧Return (or taps notification action)
  → Overlay appears / action taken
  → Daemon writes response to named pipe
  → Hook script unblocks, exits 0 (approve) or 2 (block)
  → CC session continues
```

## Known Limitations

- The daemon must be running for the hook to unblock. If it crashes, the hook times out after 5 minutes and auto-approves. Check `~/.cc-relay/daemon.log` for errors.
- The overlay does not steal focus — it floats above all apps as a non-activating panel.
- Named pipes are cleaned up on hook exit, but stale pipes may accumulate if sessions are killed forcefully. They are harmless and will be overwritten.

## Logs

```bash
tail -f ~/.cc-relay/daemon.log
```
