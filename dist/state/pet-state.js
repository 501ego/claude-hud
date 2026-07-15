import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getHudPluginDir, getHomeDir } from '../claude-config-dir.js';
import { isLimitReached } from '../types.js';
import { getTotalTokens } from '../stdin.js';
const LEVEL_XP = [
    { level: 'legend', min: 800_000_000 },
    { level: 'adult', min: 50_000_000 },
    { level: 'kitten', min: 2_000_000 },
    { level: 'egg', min: 0 },
];
const TRANSCRIPT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const SAD_GAP_MS = 3 * 24 * 60 * 60 * 1000;
const SAD_SHOW_MS = 2 * 60 * 1000;
const STARTLE_SHOW_MS = 2_000;
const EAT_SHOW_MS = 1_500;
const LEVELUP_SHOW_MS = 5_000;
const ERROR_FLASH_MS = 5_000;
const DIZZY_WINDOW_MS = 60_000;
const FOCUSED_AFTER_MS = 30_000;
// Running agents count as live activity, but an agent whose completion was
// never logged would pin "working" forever — ignore implausibly old ones.
const AGENT_ACTIVE_MAX_MS = 30 * 60 * 1000;
// Idle ladder after the reply lands: thinking -> waiting -> calm patrol ->
// bored -> sleeping, all measured from the transcript's last write.
const THINKING_WINDOW_MS = 15_000;
const WAITING_UNTIL_MS = 60_000;
const BORED_AFTER_MS = 2.5 * 60 * 1000;
const SLEEP_AFTER_MS = 4 * 60 * 1000;
const SAVE_THROTTLE_MS = 10_000;
const USAGE_PANIC_PCT = 90;
const BURNING_EXHAUST_MIN = 30;
const KAWAII_SHOW_MS = 4_000;
// Alerts time-share the sprite with the current activity instead of eating
// it: within each cycle the alert holds its slice, activity gets the rest.
// Only melted (quota gone) holds the sprite permanently.
const ALERT_CYCLE_MS = 8_000;
const ALERT_SLICE_MS = {
    panic: 4_000,
    burning: 2_000,
    stressed: 2_000,
};
// Burn-rate forecast only matters while tokens are being consumed — an idle
// session isn't burning anything, so the alert is noise there. panic and
// stressed describe standing facts (quota/context) and stay visible.
const IDLE_STATES = new Set(['calm', 'waiting', 'bored', 'sleeping', 'sad', 'sick']);
function getPetStatePath() {
    return path.join(getHudPluginDir(getHomeDir()), 'pet-state.json');
}
function wasJustPetted(now) {
    try {
        const touch = path.join(getHudPluginDir(getHomeDir()), 'pet-touch');
        return now - fs.statSync(touch).mtimeMs <= KAWAII_SHOW_MS;
    }
    catch {
        return false;
    }
}
function loadPetState() {
    try {
        const raw = JSON.parse(fs.readFileSync(getPetStatePath(), 'utf8'));
        if (raw && typeof raw.xpTokens === 'number' && raw.transcripts) {
            return raw;
        }
    }
    catch {
    }
    return {
        version: 1,
        xpTokens: 0,
        level: 'egg',
        lastSeenMs: 0,
        savedAtMs: 0,
        transcripts: {},
    };
}
function savePetState(state) {
    try {
        const filePath = getPetStatePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(state), 'utf8');
    }
    catch {
        void 0;
    }
}
function levelFor(xp) {
    for (const { level, min } of LEVEL_XP) {
        if (xp >= min)
            return level;
    }
    return 'egg';
}
function transcriptMtimeMs(transcriptPath) {
    try {
        return fs.statSync(transcriptPath).mtimeMs;
    }
    catch {
        return null;
    }
}
function sessionTokensTotal(transcript) {
    const t = transcript.sessionTokens;
    if (!t)
        return 0;
    return t.inputTokens + t.outputTokens + t.cacheCreationTokens + t.cacheReadTokens;
}
/**
 * Update persisted pet state from this render's telemetry and resolve the
 * current expression. Called once per render from main(); all I/O best-effort.
 */
export function resolvePetStatus(input, now) {
    const file = loadPetState();
    const hash = createHash('sha256').update(path.resolve(input.transcriptPath)).digest('hex');
    const prev = file.transcripts[hash];
    if (file.lastSeenMs > 0 && now - file.lastSeenMs > SAD_GAP_MS) {
        file.sadUntilMs = now + SAD_SHOW_MS;
    }
    file.lastSeenMs = now;
    const totalTokens = sessionTokensTotal(input.transcript);
    const xpDelta = prev ? Math.max(0, totalTokens - prev.totalTokens) : totalTokens;
    file.xpTokens += xpDelta;
    const newLevel = levelFor(file.xpTokens);
    if (newLevel !== file.level) {
        file.level = newLevel;
        file.levelUpAtMs = now;
    }
    const contextTokens = getTotalTokens(input.stdin);
    if (prev && prev.contextTokens > 0 && contextTokens > 0 && contextTokens < prev.contextTokens * 0.7) {
        file.startledAtMs = now;
    }
    const todosCompleted = input.transcript.todos.filter((t) => t.status === 'completed').length;
    if (prev && todosCompleted > prev.todosCompleted) {
        file.ateAtMs = now;
    }
    file.transcripts[hash] = {
        totalTokens,
        contextTokens,
        todosCompleted,
        updatedAtMs: now,
    };
    for (const [key, entry] of Object.entries(file.transcripts)) {
        if (now - entry.updatedAtMs > TRANSCRIPT_RETENTION_MS) {
            delete file.transcripts[key];
        }
    }
    const materialEvent = xpDelta > 0
        || file.levelUpAtMs === now
        || file.startledAtMs === now
        || file.ateAtMs === now;
    if (materialEvent || now - file.savedAtMs > SAVE_THROTTLE_MS) {
        file.savedAtMs = now;
        savePetState(file);
    }
    const { state, alert } = resolveExpression(input, file, now);
    return { state, level: file.level, alert };
}
function resolveAlert(input) {
    const { usageData, fiveHourExhaustMin, contextPercent } = input;
    if (usageData && isLimitReached(usageData))
        return 'melted';
    if (typeof usageData?.fiveHour === 'number' && usageData.fiveHour >= USAGE_PANIC_PCT)
        return 'panic';
    if (fiveHourExhaustMin !== null && fiveHourExhaustMin >= 0 && fiveHourExhaustMin <= BURNING_EXHAUST_MIN) {
        return 'burning';
    }
    if (contextPercent >= 85)
        return 'stressed';
    return null;
}
function resolveActivity(input, file, now) {
    const { transcript } = input;
    const errorTimes = transcript.tools
        .filter((t) => t.status === 'error' && t.endTime)
        .map((t) => t.endTime.getTime());
    if (errorTimes.some((t) => now - t <= ERROR_FLASH_MS))
        return 'error';
    if (errorTimes.filter((t) => now - t <= DIZZY_WINDOW_MS).length >= 3)
        return 'dizzy';
    if (file.startledAtMs && now - file.startledAtMs <= STARTLE_SHOW_MS)
        return 'startled';
    if (file.ateAtMs && now - file.ateAtMs <= EAT_SHOW_MS)
        return 'eating';
    if (file.levelUpAtMs && now - file.levelUpAtMs <= LEVELUP_SHOW_MS)
        return 'levelup';
    const running = transcript.tools.filter((t) => t.status === 'running');
    if (running.length > 0) {
        const oldest = Math.min(...running.map((t) => t.startTime.getTime()));
        return now - oldest >= FOCUSED_AFTER_MS ? 'focused' : 'working';
    }
    // Delegated work is work: while a sub-agent runs (its tool calls live in
    // its own sidechain transcript), the pet cheers it on from the sideline.
    const agentRunning = transcript.agents.some((a) => a.status === 'running' && now - a.startTime.getTime() <= AGENT_ACTIVE_MAX_MS);
    if (agentRunning)
        return 'cheering';
    // Recent transcript writes with no tool running = Claude reasoning or
    // composing a reply between tool calls; after that the idle ladder runs.
    const mtime = transcriptMtimeMs(input.transcriptPath);
    if (mtime !== null) {
        const idle = now - mtime;
        if (idle <= THINKING_WINDOW_MS)
            return 'thinking';
        if (idle <= WAITING_UNTIL_MS)
            return 'waiting';
        if (idle >= SLEEP_AFTER_MS)
            return 'sleeping';
        if (idle >= BORED_AFTER_MS)
            return 'bored';
    }
    if (file.sadUntilMs && now < file.sadUntilMs)
        return 'sad';
    const recentErrors = transcript.tools.filter((t) => t.status === 'error').length;
    if (recentErrors >= 5)
        return 'sick';
    return 'calm';
}
function resolveExpression(input, file, now) {
    if (file.level === 'egg')
        return { state: 'egg', alert: null };
    if (wasJustPetted(now))
        return { state: 'kawaii', alert: null };
    let alert = resolveAlert(input);
    const activity = resolveActivity(input, file, now);
    if (alert === 'burning' && IDLE_STATES.has(activity))
        alert = null;
    if (!alert)
        return { state: activity, alert: null };
    if (alert === 'melted')
        return { state: 'melted', alert };
    const slice = ALERT_SLICE_MS[alert] ?? 2_000;
    const state = now % ALERT_CYCLE_MS < slice ? alert : activity;
    return { state, alert };
}
//# sourceMappingURL=pet-state.js.map