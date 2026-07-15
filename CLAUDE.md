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
- Running tools = `tool_use` without matching `tool_result`. Text-only assistant message close any still-running tool (turn over = orphaned entry; agents exempt, can run in background) — without this the HUD/pet pin on stale "running" forever (cache v3)
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
- Pet (`pet.enabled`, default ON): pixel-art avatar, QUADRANT truecolor render — 24x6 px in 12x3 cells (each cell = 2x2 px, fg+bg; >2 colors per cell quantized to 2 dominant, transparency keep dominant only). Two `pet.style`: 'cat' (default, british shorthair — 12px maps in render/pet.ts scale2'd to 24px so approved look preserved) and 'claude' (Clawd, terracotta CLI mascot, native 24px). Live in `pet.roamWidth`-col strip (default 26, shrunk keep >=60 content cols) beside first 3 HUD lines. Idle states (calm/thinking) PATROL (1 col per 700ms, mirrored on flip); others home edge + 2-frame alt per 900ms (tail/feet gait, drops, chew, sparkles, egg rock, error head-shake = mirrored frame). Motion is GLIDED, never teleported: resolvePetMotion (render/pet.ts) move max 1 col per 350ms elapsed toward the state's target, facing travel direction; previous position persist per-transcript in `~/.claude/plugins/claude-hud/pet-anim.json` (state/pet-anim.ts, read+write every render, entries pruned >24h, stale >30s snap). `pet.position` 'right' (default, `pet.rightMargin` 4) or 'left'. Auto-hide below `pet.minWidth` (80). `pet.debug` width-diag line. Idle animation need `statusLine.refreshInterval: 1` in settings.json. Speech: short utterances (<=6 chars) beside head (hugging the visible head edge, blank sprite cells sliced); longer status messages drop DIRECTLY below sprite (no spacer row, centered under sprite, clamped). State machine (state/pet-state.ts) = TWO channels, not one ladder. Alert channel: melted (5h usage 100%) > panic (5h >=90%, red) > burning (forecast exhaust <=30min) > stressed (ctx>=85%). Activity channel: error flash > dizzy > startled (ctx drop >30%) > eating (todo done) > levelup > focused/working (running tool; speech name tool category: reading.../editing.../running.../browsing.../delegating.../planning...) > cheering (running sub-agent) > idle ladder from transcript last write: thinking (<=15s, no running tool — eyes scan side-to-side, 'hmm...') > waiting (15-60s, foot tap, animated '...') > calm patrol (60s-2.5min) > bored (2.5-4min, yawns, 'meh...') > sleeping (4min+, zzz) > sad (3d away) > sick (5+ errors) > calm fallback. kawaii (pet-touch mtime <=4s, via `/claude-hud:pet` or `scripts/pet` / `scripts/pet.bat`) beat everything; melted always hold. Any other alert time-slice per 8s wall-clock cycle: alert first slice (panic 4s, burning/stressed 2s), current activity/idle state the rest — alert never pin the sprite. EXCEPTION: burning is a consumption forecast — SUPPRESSED entirely when activity is idle (calm/waiting/bored/sleeping/sad/sick); panic/stressed are standing facts and keep their idle slice. Calm speech = '♪' hum, shown 1 of 3 2.7s windows (mostly silent stroll). During activity slice, speech line alternate activity text <-> alert text every 3s (alert exposed via PetStatus.alert, threaded to renderPetArea). Eye animation horizontal ONLY — never move pupils up/down. Eye WIDTH constant per style (cat 2px block e.g. EW/EE/WW/GW; Clawd 1px glyph) — only height (lids/blink) or color (E/W/M/G) may change, NEVER width. Alert speech: '5h almost out!' / 'burning fast!' / 'context full!' / 'quota out...'. XP lifetime tokens (pet-state.json): egg -> kitten (2M) -> adult (50M) -> legend (800M). Coat ALWAYS the same — NO state recolors the body, expressions carry everything (USER RULE, supersedes older red-panic/gray-melted exception): stressed = sweat drops + worried mouth; burning = jitter + R heat-flicker pixel + sweat; panic = WW wide eyes + open-mouth scream alt + jitter; melted = normal-coat puddle + animated drip. Color lives only in SPEECH text (amber stressed, hot-orange burning, red panic/melted — PALETTE A/H kept for text) and tiny accent pixels (C sweat, R spark, G confetti/gold). cheering state (running sub-agent, via agentMap; 30min orphan guard AGENT_ACTIVE_MAX_MS): gold confetti + bounce alt frame, speech gold 'go go!'. Dev preview: `node pet-preview.mjs [state] [claude]` (live, real engine).

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
