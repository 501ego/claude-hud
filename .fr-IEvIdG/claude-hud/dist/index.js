import { readStdin, getUsageFromStdin } from "./stdin.js";
import { parseTranscript } from "./transcript.js";
import { render } from "./render/index.js";
import { countConfigs } from "./config-reader.js";
import { getGitStatus } from "./git.js";
import { loadConfig } from "./config.js";
import { getMemoryUsage } from "./memory.js";
import { fileURLToPath } from "node:url";
import { realpathSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { getClaudeConfigDir, getHomeDir, getHudPluginDir } from "./claude-config-dir.js";
import { readBurnSamples, readBurnTrend, writeBurnSamples } from "./state/burn-samples.js";
import { recordTrendSample, readTrendRatePerMin } from "./state/trend-samples.js";
import { getGitStatusCached } from "./state/git-cache.js";
import { sweepStaleCaches } from "./state/cache-sweep.js";
import { getTotalTokens, getBufferedPercent } from "./stdin.js";
import { AUTOCOMPACT_BUFFER_PERCENT } from "./constants.js";
import { resolvePetStatus } from "./state/pet-state.js";
const CONTEXT_TREND_WINDOW_MS = 10 * 60 * 1000;
const USAGE_TREND_WINDOW_MS = 30 * 60 * 1000;
function computeCompactEta(stdin) {
    if (!stdin?.transcript_path)
        return null;
    const size = stdin.context_window?.context_window_size;
    if (!size || size <= 0)
        return null;
    const contextTokens = getTotalTokens(stdin);
    if (contextTokens <= 0)
        return null;
    const key = `context|${stdin.transcript_path}`;
    recordTrendSample(key, contextTokens, CONTEXT_TREND_WINDOW_MS);
    const ratePerMin = readTrendRatePerMin(key, CONTEXT_TREND_WINDOW_MS);
    if (ratePerMin === null || ratePerMin <= 0)
        return null;
    const compactThreshold = size * (1 - AUTOCOMPACT_BUFFER_PERCENT);
    const remaining = compactThreshold - contextTokens;
    if (remaining <= 0)
        return 0;
    const etaMin = remaining / ratePerMin;
    return Number.isFinite(etaMin) ? Math.round(etaMin) : null;
}
function computeFiveHourExhaust(usageData) {
    if (!usageData || usageData.fiveHour === null)
        return null;
    const percent = usageData.fiveHour;
    if (percent >= 100)
        return 0;
    recordTrendSample("usage|5h", percent, USAGE_TREND_WINDOW_MS);
    const ratePerMin = readTrendRatePerMin("usage|5h", USAGE_TREND_WINDOW_MS);
    if (ratePerMin === null || ratePerMin <= 0)
        return null;
    const exhaustMin = (100 - percent) / ratePerMin;
    if (!Number.isFinite(exhaustMin))
        return null;
    if (usageData.fiveHourResetAt) {
        const resetMin = (usageData.fiveHourResetAt.getTime() - Date.now()) / 60000;
        if (resetMin > 0 && exhaustMin >= resetMin)
            return null;
    }
    return Math.round(exhaustMin);
}
function readEffortLevel() {
    try {
        const settingsPath = join(getClaudeConfigDir(getHomeDir()), "settings.json");
        const raw = JSON.parse(readFileSync(settingsPath, "utf8"));
        return typeof raw.effortLevel === "string" ? raw.effortLevel : null;
    }
    catch {
        return null;
    }
}
export async function main(overrides = {}) {
    if (process.argv.includes("--test")) {
        const mockStdin = {
            model: { display_name: "Sonnet" },
            context_window: {
                context_window_size: 200000,
                current_usage: { input_tokens: 10000 },
            },
        };
        try {
            const testDeps = {
                getUsageFromStdin,
                parseTranscript,
                countConfigs,
                getGitStatus,
                loadConfig,
                getMemoryUsage,
                render,
                now: () => Date.now(),
                log: console.log,
                ...overrides,
                readStdin: async () => mockStdin,
            };
            const config = await testDeps.loadConfig();
            const transcript = await testDeps.parseTranscript("");
            const { claudeMdCount, rulesCount, mcpCount, hooksCount, outputStyle } = await testDeps.countConfigs(undefined);
            const ctx = {
                stdin: mockStdin,
                transcript,
                claudeMdCount,
                rulesCount,
                mcpCount,
                hooksCount,
                sessionDuration: "0m",
                extraLabel: null,
                gitStatus: null,
                usageData: null,
                memoryUsage: null,
                config,
                outputStyle,
                terminalWidth: 0,
            };
            testDeps.render(ctx);
            process.exit(0);
        }
        catch (error) {
            process.stderr.write(`[claude-hud --test] Error: ${error instanceof Error ? error.message : String(error)}\n`);
            process.exit(1);
        }
    }
    const deps = {
        readStdin,
        getUsageFromStdin,
        parseTranscript,
        countConfigs,
        getGitStatus,
        loadConfig,
        getMemoryUsage,
        render,
        now: () => Date.now(),
        log: console.log,
        ...overrides,
    };
    try {
        const stdin = await deps.readStdin();
        if (!stdin) {
            const config = await deps.loadConfig();
            const isMacOS = process.platform === "darwin";
            deps.log("[claude-hud] Initializing...");
            if (isMacOS) {
                deps.log("[claude-hud] Note: On macOS, you may need to restart Claude Code for the HUD to appear.");
            }
            return;
        }
        const transcriptPath = stdin.transcript_path ?? "";
        const transcript = await deps.parseTranscript(transcriptPath);
        const { claudeMdCount, rulesCount, mcpCount, hooksCount, outputStyle } = await deps.countConfigs(stdin.cwd);
        const config = await deps.loadConfig();
        const fetchGitStatus = deps.getGitStatus === getGitStatus
            ? (cwd) => getGitStatusCached(cwd, getGitStatus)
            : deps.getGitStatus;
        const gitStatus = config.gitStatus.enabled
            ? await fetchGitStatus(stdin.cwd)
            : null;
        let usageData = null;
        if (config.display.showUsage !== false) {
            usageData = deps.getUsageFromStdin(stdin);
        }
        const sessionDuration = formatSessionDuration(transcript.sessionStart, deps.now);
        const memoryUsage = config.display.showMemoryUsage && config.lineLayout === "expanded"
            ? await deps.getMemoryUsage()
            : null;
        let burnRate = null;
        let burnTrend = null;
        if (stdin.transcript_path) {
            const sessionTokens = transcript.sessionTokens;
            if (sessionTokens) {
                const tokensTotal = sessionTokens.inputTokens + sessionTokens.outputTokens + sessionTokens.cacheCreationTokens + sessionTokens.cacheReadTokens;
                writeBurnSamples(stdin.transcript_path, tokensTotal);
                burnRate = readBurnSamples(stdin.transcript_path);
                burnTrend = burnRate !== null ? readBurnTrend(stdin.transcript_path) : null;
            }
        }
        const compactEtaMin = config.display.showCompactEta
            ? computeCompactEta(stdin)
            : null;
        const fiveHourExhaustMin = config.display.showUsageForecast
            ? computeFiveHourExhaust(usageData)
            : null;
        let pet = null;
        if (config.pet?.enabled && stdin.transcript_path) {
            try {
                pet = resolvePetStatus({
                    transcriptPath: stdin.transcript_path,
                    transcript,
                    stdin,
                    usageData,
                    fiveHourExhaustMin,
                    contextPercent: getBufferedPercent(stdin),
                }, deps.now());
            }
            catch {
                pet = null;
            }
        }
        const ctx = {
            stdin,
            transcript,
            claudeMdCount,
            rulesCount,
            mcpCount,
            hooksCount,
            sessionDuration,
            extraLabel: null,
            gitStatus,
            usageData,
            memoryUsage,
            config,
            outputStyle,
            terminalWidth: 0,
            burnRate,
            burnTrend,
            effortLevel: config.display.showEffort ? readEffortLevel() : null,
            compactEtaMin,
            fiveHourExhaustMin,
            pet,
        };
        writeUsageState(usageData, config);
        sweepStaleCaches();
        deps.render(ctx);
    }
    catch (error) {
        deps.log("[claude-hud] Error:", error instanceof Error ? error.message : "Unknown error");
    }
}
export function formatSessionDuration(sessionStart, now = () => Date.now()) {
    if (!sessionStart) {
        return "";
    }
    const ms = now() - sessionStart.getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1)
        return "<1m";
    if (mins < 60)
        return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
}
const USAGE_WINDOW_RETENTION_MS = 24 * 60 * 60 * 1000;
function writeUsageState(usageData, config) {
    if (!usageData)
        return;
    try {
        const statePath = join(getHudPluginDir(getHomeDir()), 'usage-state.json');
        let existing = {};
        try {
            existing = JSON.parse(readFileSync(statePath, 'utf8'));
        }
        catch {
            existing = {};
        }
        const nowIso = new Date().toISOString();
        const merged = new Map();
        const prevWindows = Array.isArray(existing.windows) ? existing.windows : [];
        for (const w of prevWindows) {
            if (!w || (w.kind !== '5h' && w.kind !== '7d') || typeof w.percent !== 'number')
                continue;
            merged.set(`${w.kind}|${w.resetAt ?? ''}`, w);
        }
        const current = [
            { kind: '5h', percent: usageData.fiveHour, resetAt: usageData.fiveHourResetAt?.toISOString() ?? null },
            { kind: '7d', percent: usageData.sevenDay, resetAt: usageData.sevenDayResetAt?.toISOString() ?? null },
        ];
        for (const c of current) {
            if (c.percent === null || c.percent === undefined)
                continue;
            const key = `${c.kind}|${c.resetAt ?? ''}`;
            const prev = merged.get(key);
            if (prev && prev.percent === c.percent)
                continue;
            merged.set(key, { kind: c.kind, percent: c.percent, resetAt: c.resetAt, updatedAt: nowIso });
        }
        const cutoff = Date.now() - USAGE_WINDOW_RETENTION_MS;
        const windows = [...merged.values()].filter((w) => {
            if (!w.resetAt)
                return true;
            const t = Date.parse(w.resetAt);
            return Number.isNaN(t) || t >= cutoff;
        });
        const state = {
            version: 2,
            windows,
            notifications: config.notifications,
            updatedAt: existing.updatedAt ?? nowIso,
        };
        const candidate = JSON.stringify({ ...state, updatedAt: null });
        const previous = JSON.stringify({
            version: existing.version,
            windows: existing.windows,
            notifications: existing.notifications,
            updatedAt: null,
        });
        if (candidate === previous)
            return;
        state.updatedAt = nowIso;
        const tmpPath = `${statePath}.${process.pid}.tmp`;
        writeFileSync(tmpPath, JSON.stringify(state), 'utf8');
        renameSync(tmpPath, statePath);
    }
    catch {
    }
}
const scriptPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1];
const isSamePath = (a, b) => {
    try {
        return realpathSync(a) === realpathSync(b);
    }
    catch {
        return a === b;
    }
};
if (argvPath && isSamePath(argvPath, scriptPath)) {
    void main();
}
//# sourceMappingURL=index.js.map