# CLAUDE.md

File give guidance to Claude Code for this repo.

## Project Overview

Claude HUD = Claude Code plugin. Show real-time multi-line statusline. Context health, usage windows, burn rate, cost, tool activity, agent status, todo progress.

## Build Commands

```bash
npm ci               # Install dependencies
npm run build        # Build TypeScript to dist/
npm test             # Run full test suite (node:test)

# Test with sample stdin data
echo '{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000}}' | node dist/index.js

# Render demo HUD without real session
node dist/index.js --test
```

`dist/` git-tracked on purpose — plugin run compiled output, no build step at install.

## Architecture

### Data Flow

```
Claude Code → stdin JSON → parse → render lines → stdout → Claude Code displays
           ↘ transcript_path → parse JSONL → tools/agents/todos/tokens
           ↘ usage-state.json ← writeUsageState (per reset-window) → claude-notify.py
```

**Key insight**: Statusline invoke every ~300ms, fresh process each call:
1. Get JSON via stdin (model, context, tokens, rate_limits — native accurate)
2. Parse transcript JSONL for tools, agents, todos, session tokens (incremental: cache in transcript-cache/ store parser state + byte offset, only appended bytes re-read)
3. Render multi-line to stdout
4. Claude Code display all lines

Git status disk-cached 5s TTL (state/git-cache.ts) — avoid 4 git subprocess per render. Stale cache files (transcript-cache/, burn-samples/, trend-samples/, git-cache/) swept hourly, >7d age deleted (state/cache-sweep.ts).

### Data Sources

**Native from stdin JSON** (accurate, no estimation):
- `model.display_name` - Current model
- `context_window.current_usage` - Token counts
- `context_window.context_window_size` - Max context
- `transcript_path` - Path to session transcript
- `rate_limits.five_hour` / `rate_limits.seven_day` - `used_percentage` + `resets_at`

**From transcript JSONL parsing**:
- `tool_use` blocks → tool name, input, start time
- `tool_result` blocks → completion, duration
- Running tools = `tool_use` without matching `tool_result`
- `TodoWrite` calls → todo list
- `Task` calls → agent info
- Token usage per model → cost estimate (pricing.ts), burn rate (state/burn-samples.ts)

**From config files**:
- MCP/hooks/rules counts from `~/.claude/settings.json` + CLAUDE.md files (config-reader.ts, cached in config-cache/)
- User HUD config from `~/.claude/plugins/claude-hud/config.json` (config.ts)

### Home/Config Resolution

`claude-config-dir.ts` single source: `getHomeDir()` prefer `$HOME` when valid dir (tests set it; Windows `os.homedir()` ignore it), else `os.homedir()`. `CLAUDE_CONFIG_DIR` env override `.claude` location. Never call `os.homedir()` direct elsewhere.

### Usage State + Notifier

`writeUsageState` (index.ts) write `~/.claude/plugins/claude-hud/usage-state.json` version 2: `windows[]` keyed by (kind, resetAt) — concurrent sessions on DIFFERENT rate-limit pools upsert own window, no clobber. Write deduped vs file content. `scripts/claude-notify.py` (cron / Windows scheduled task, every minute) iterate all windows, fire desktop notification + sound on quota reset. `notifications.soundFile` config flow through state.

### File Structure

```
src/
├── index.ts           # Entry point, --test mode, usage-state writer
├── stdin.ts           # Parse Claude's JSON input + rate limits
├── transcript.ts      # Parse transcript JSONL (cached)
├── config-reader.ts   # Count MCP/rules/hooks configs (cached)
├── config.ts          # Load/validate user config
├── claude-config-dir.ts # Home + .claude dir resolution
├── pricing.ts         # Per-model token pricing → cost
├── git.ts             # Git status (branch, dirty, ahead/behind, line diff)
├── memory.ts          # Process memory usage
├── constants.ts       # Shared constants
├── debug.ts           # Debug logging
├── types.ts           # TypeScript interfaces
├── state/
│   ├── burn-samples.ts   # Token burn-rate sampling window
│   ├── trend-samples.ts  # Generic monotone-counter slope sampling (context growth, quota %)
│   ├── git-cache.ts      # 5s-TTL disk cache for git status
│   ├── cache-sweep.ts    # Hourly sweep of stale cache files (>7d)
│   └── pet-state.ts      # Pet persistence (XP/level) + expression state machine
├── utils/
│   └── terminal.ts       # Terminal width detection
└── render/
    ├── index.ts       # Main render coordinator (expanded layout)
    ├── pet.ts         # Pixel-art pet sprites + half-block ANSI renderer
    ├── format.ts      # Shared formatting helpers
    ├── colors.ts      # ANSI color helpers
    ├── session-line.ts   # Compact mode: single line with all info
    ├── tools-line.ts     # Tool activity (opt-in)
    ├── agents-line.ts    # Agent status (opt-in)
    ├── todos-line.ts     # Todo progress (opt-in)
    └── lines/
        ├── index.ts      # Barrel export
        ├── project.ts    # Identity: project path + git + model bracket
        ├── identity.ts   # Context bar
        ├── usage.ts      # Usage windows bars ([5h]/[wk] + reset glyph)
        ├── session.ts    # Session group: duration, cost, models used
        ├── memory.ts     # Memory usage (opt-in)
        └── environment.ts # Config counts (opt-in)
scripts/
├── claude-hud-launcher.mjs # Statusline entry: resolve newest installed version, import dist
└── claude-notify.py        # Cross-platform usage-reset notifier (Linux/macOS/Windows)
```

### Output Format (default expanded layout)

```
apps/my-project git:(main*) │ [Opus] ⣀⣤⣶⣿ │ Context ██░░░░░░┊░ 29% ○
[5h] ⣿⣿⡇⠄⠄⠄⠄⠄ 33% ↺1h57m | [wk] ⣿⣿⣿⠄⠄⠄⠄⠄ 40% ↺1d1h
```

Identity + live-health groups always show. More line opt-in via config:
- Tools line (`showTools`): ◐ Edit: auth.ts | ✓ Read ×3
- Agents line (`showAgents`): ◐ explore [haiku]: Finding auth code
- Todos line (`showTodos`): ▸ Fix authentication bug (2/5)
- Environment line (`showConfigCounts`): 2 CLAUDE.md | 4 rules
- Burn/cost instruments: `showBurnHeat`, `showSparkline`, `showApiEquivCost`, `showCacheGlyph`
- Forecasts: `showUsageForecast` (default ON) — Session line show red `limit in ~50m` (next to duration) when 5h quota projected hit 100% before reset. `showCompactEta` (default OFF, too wide) — context line append `compact in ~14m`. Both from trend-samples slopes; need ≥2 samples spanning ≥1min.
- Cost prefix `~$` mean model rate unknown (DEFAULT_RATE fallback); `$` mean exact rate. Display names without canonical slug resolve via family fallback (fable/opus/sonnet/haiku) in pricing.ts.
- Pet (`pet.enabled`, default ON): pixel-art avatar, QUADRANT truecolor render — 24x6 px in 12x3 cells (each cell = 2x2 px, fg+bg; >2 colors per cell quantized to 2 dominant, transparency keep dominant only). Two `pet.style`: 'cat' (default, british shorthair — 12px maps in render/pet.ts scale2'd to 24px so approved look preserved) and 'claude' (Clawd, terracotta CLI mascot, native 24px). Live in `pet.roamWidth`-col strip (default 26, shrunk keep >=60 content cols) beside first 3 HUD lines. Idle states (calm/curious) PATROL (1 col per 700ms, mirrored on flip); others home edge + 2-frame alt per 900ms (tail/feet gait, drops, chew, sparkles, egg rock, error head-shake = mirrored frame). `pet.position` 'right' (default, `pet.rightMargin` 4) or 'left'. Auto-hide below `pet.minWidth` (80). `pet.debug` width-diag line. Idle animation need `statusLine.refreshInterval: 1` in settings.json. Speech: short utterances (<=6 chars) beside head; longer status messages drop below sprite (blank spacer + row centered under sprite, clamped). State machine (state/pet-state.ts) precedence: kawaii (pet-touch file mtime <=4s, via `/claude-hud:pet` slash command or `scripts/pet` / `scripts/pet.bat` terminal helpers) > melted (5h usage 100%) > panic (5h usage >=90%, red) > burning (forecast exhaust <=30min) > error flash > dizzy > startled (ctx drop >30%) > stressed (ctx>=85%) > eating (todo done) > levelup > focused/working > curious > sleeping (idle 5min) > sad (3d away) > sick (5+ errors) > calm. Alert speech: '5h almost out!' / 'burning fast!' / 'context full!' / 'quota out...'. XP lifetime tokens (pet-state.json): egg -> kitten (2M) -> adult (50M) -> legend (800M). Coat never change with mood except red panic + gray melted. Dev preview: `node pet-preview.mjs [state] [claude]` (live, real engine).

### Context Thresholds

| Threshold | Color | Action |
|-----------|-------|--------|
| <70% | Green | Normal |
| 70-85% | Yellow | Warning |
| >85% | Red | Show token breakdown |

## Plugin Configuration

Plugin manifest in `.claude-plugin/plugin.json` (metadata only — name, description, version, author).

**StatusLine config** go in user `~/.claude/settings.json` via `/claude-hud:setup`. Setup copy `scripts/claude-hud-launcher.mjs` to `~/.claude/scripts/` and point statusLine at it — launcher resolve newest installed plugin version each render, so updates never break statusline, no re-run setup.

Note: `statusLine` NOT valid plugin.json field. Must configure in settings.json after install.

## Tests

`tests/*.test.js` run against `dist/` — build before test. Tests mock home via `process.env.HOME` (work cross-platform through `getHomeDir()`). Integration snapshot regenerate with `UPDATE_SNAPSHOTS=1 npm test`.

## Dependencies

- **Runtime**: Node.js 18+ or Bun
- **Build**: TypeScript 5, ES2022 target, NodeNext modules
