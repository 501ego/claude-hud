
# Claude HUD

A Claude Code plugin that shows what's happening — context usage, active tools, running agents, todo progress, cost, and usage-reset notifications. Always visible below your input.

[![License](https://img.shields.io/github/license/501ego/claude-hud?v=2)](LICENSE)

## Install

Inside a Claude Code instance:

**Step 1: Add the marketplace**
```
/plugin marketplace add 501ego/claude-hud
```

**Step 2: Install the plugin**

<details>
<summary><strong>⚠️ Linux users: Click here first</strong></summary>

On Linux, `/tmp` is often a separate filesystem (tmpfs), which causes plugin installation to fail with:
```
EXDEV: cross-device link not permitted
```

**Fix**: Set TMPDIR before installing:
```bash
mkdir -p ~/.cache/tmp && TMPDIR=~/.cache/tmp claude
```

Then run the install command below in that session. This is a [Claude Code platform limitation](https://github.com/anthropics/claude-code/issues/14799).

</details>

```
/plugin install claude-hud
```

**Step 3: Configure the statusline**
```
/claude-hud:setup
```

<details>
<summary><strong>⚠️ Windows users: Click here if setup says no JavaScript runtime was found</strong></summary>

Install Node.js LTS first:
```powershell
winget install OpenJS.NodeJS.LTS
```
Then restart your shell and run `/claude-hud:setup` again.

</details>

Restart Claude Code to load the new statusLine config — the HUD will appear.

---

## What You See

### Default (2 lines)
```
[Opus] │ my-project git:(main*)
Context █████░░░░░ 45% │ Usage ██░░░░░░░░ 25% (1h 30m / 5h)
```

### Optional lines
```
◐ Edit: auth.ts  ✓ Read ×3  ✓ Grep ×2        ← Tools activity
◐ explore [haiku]: Finding auth code (2m 15s)  ← Agent status
▸ Fix authentication bug (2/5)                 ← Todo progress
$0.42                                          ← Session cost
```

### HUD Pet (on by default)

An animated pixel-art pet lives beside the HUD. It patrols while you're idle,
watches Claude work, and reacts to real session telemetry: context pressure,
token burn speed, quota alerts, tool errors, completed todos. It speaks —
short utterances beside its head, alert messages below it (`5h almost out!`,
`burning fast!`, `context full!`) — and levels up with lifetime token usage:
egg → kitten (2M) → adult (50M) → legend (800M).

- Two styles: `cat` (british shorthair, default) and `claude` (Clawd, the
  terracotta CLI mascot) — `pet.style` in config.json.
- Pet it with `/claude-hud:pet` (or the optional `pet` terminal command) for
  a kawaii reaction.
- Rendered as 24x6-px truecolor quadrant pixel art in a 12x3-cell strip;
  auto-hides below 80 columns. Disable with `pet.enabled: false`.
- Idle animation requires `statusLine.refreshInterval: 1` in settings.json
  (`/claude-hud:setup` configures it).

---

## Configuration

Run the unified setup command anytime to configure or reconfigure:

```
/claude-hud:setup
```

Or edit `~/.claude/plugins/claude-hud/config.json` directly.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lineLayout` | `expanded` \| `compact` | `expanded` | Layout mode |
| `terminalWidth` | number | auto-detect | Override terminal width |
| `pathLevels` | 1-3 | 1 | Directory levels in project path |
| `elementOrder` | string[] | see below | Element display order |
| `gitStatus.enabled` | boolean | true | Show git branch |
| `gitStatus.showDirty` | boolean | true | Show `*` for uncommitted changes |
| `gitStatus.showAheadBehind` | boolean | false | Show `↑N ↓N` |
| `gitStatus.pushWarningThreshold` | number | 0 | Warn color at N unpushed commits |
| `gitStatus.pushCriticalThreshold` | number | 0 | Critical color at N unpushed commits |
| `gitStatus.showFileStats` | boolean | false | Show `!M +A ✘D ?U` |
| `display.showModel` | boolean | true | Show model badge `[Opus]` |
| `display.showContextBar` | boolean | true | Show context bar |
| `display.contextValue` | `percent` \| `tokens` \| `remaining` \| `both` | `percent` | Context format |
| `display.showUsage` | boolean | true | Show subscriber usage limits |
| `display.usageBarEnabled` | boolean | true | Usage as visual bar |
| `display.sevenDayThreshold` | 0-100 | 80 | Show 7-day usage when >= threshold |
| `display.showTokenBreakdown` | boolean | true | Token details at high context (85%+) |
| `display.showCost` | boolean | true | Show session cost (inline on project line; estimate includes cache-write tokens) |
| `display.showTools` | boolean | false | Tools activity line |
| `display.showAgents` | boolean | false | Agents activity line |
| `display.showTodos` | boolean | false | Todos progress line |
| `display.showMemoryUsage` | boolean | false | System RAM usage (expanded only) |
| `display.showConfigCounts` | boolean | false | CLAUDE.md, rules, MCPs, hooks counts |
| `display.showDuration` | boolean | false | Session duration |
| `display.modelFormat` | `full` \| `compact` \| `short` | `full` | Model name format |
| `notifications.enabled` | boolean | false | Usage-reset desktop notifications |
| `notifications.methods` | string[] | `["notify-send","bell"]` | `notify-send`, `warp`, `bell` |
| `notifications.minutesBefore` | number | 0 | Alert N minutes before reset |
| `colors.*` | color value | see defaults | Named, 256-index, or `#rrggbb` |

**Default element order:** `["project","context","usage","tools","agents","todos","environment"]`

**Color keys:** `model`, `project`, `git`, `gitBranch`, `context`, `usage`, `warning`, `usageWarning`, `critical`, `label`, `tools`, `custom`

**Supported color names:** `dim`, `red`, `green`, `yellow`, `magenta`, `cyan`, `brightBlue`, `brightMagenta` — or a 256-color number (`0-255`) or hex (`#rrggbb`).

### Example config (this fork's defaults)

```json
{
  "lineLayout": "expanded",
  "terminalWidth": 200,
  "pathLevels": 2,
  "elementOrder": ["project", "context", "usage", "tools", "agents", "todos", "environment"],
  "notifications": {
    "enabled": true,
    "onUsageReset": true,
    "methods": ["notify-send", "bell"],
    "minutesBefore": 0
  },
  "colors": {
    "model": "#f4a7b9",
    "project": "#f9c4d4",
    "git": "#e8a0b4",
    "gitBranch": "#d98aa0",
    "context": "#f4a7b9",
    "usage": "#c9a0c0",
    "warning": "#f5c87a",
    "usageWarning": "#e8a0b4",
    "critical": "#f07090",
    "label": "dim",
    "tools": "#a8d4f5"
  }
}
```

### Usage-Reset Notifications

Get a desktop notification + sound when your 5-hour or 7-day tokens refresh.

The `/claude-hud:setup` command will guide you through this. To set it up manually:

```bash
# 1. Copy the script (after plugin is installed)
mkdir -p ~/.claude/scripts
cp ~/.claude/plugins/cache/claude-hud/claude-hud/*/scripts/claude-notify.py ~/.claude/scripts/claude-notify.py

# 2. Add cron job
(crontab -l 2>/dev/null; echo "* * * * * python3 $HOME/.claude/scripts/claude-notify.py") | crontab -
```

Then enable in `~/.claude/plugins/claude-hud/config.json`:
```json
{
  "notifications": {
    "enabled": true,
    "methods": ["notify-send", "bell"],
    "minutesBefore": 0
  }
}
```

Works on Linux (notify-send + paplay), macOS (osascript + afplay), and Windows (PowerShell).

---

## How It Works

Claude HUD uses Claude Code's native **statusline API** — no separate window, no tmux required.

```
Claude Code → stdin JSON → claude-hud → stdout → displayed in your terminal
           ↘ transcript JSONL (tools, agents, todos)
```

- Native token data from Claude Code (not estimated)
- Parses transcript for tool/agent/todo activity
- Updates every ~300ms

---

## Requirements

- Claude Code v1.0.80+
- Node.js 18+ or Bun

---

## Development

```bash
git clone https://github.com/501ego/claude-hud
cd claude-hud
npm ci && npm run build
```

Test with sample stdin:
```bash
echo '{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000}}' | node dist/index.js
```

---

## Credits

Maintained by [Diego (501ego)](https://github.com/501ego). Based on the original [claude-hud](https://github.com/jarrodwatts/claude-hud) by Jarrod Watts.

---

## License

MIT — see [LICENSE](LICENSE)
