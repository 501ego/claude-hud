import { readStdin, getUsageFromStdin } from "./stdin.js";
import { parseTranscript } from "./transcript.js";
import { render } from "./render/index.js";
import { countConfigs } from "./config-reader.js";
import { getGitStatus } from "./git.js";
import { loadConfig } from "./config.js";
import { getMemoryUsage } from "./memory.js";
import { fileURLToPath } from "node:url";
import { realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
export async function main(overrides = {}) {
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
            // Running without stdin - this happens during setup verification
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
        const gitStatus = config.gitStatus.enabled
            ? await deps.getGitStatus(stdin.cwd)
            : null;
        // Usage comes only from Claude Code's official stdin rate_limits fields.
        let usageData = null;
        if (config.display.showUsage !== false) {
            usageData = deps.getUsageFromStdin(stdin);
        }
        const sessionDuration = formatSessionDuration(transcript.sessionStart, deps.now);
        const memoryUsage = config.display.showMemoryUsage && config.lineLayout === "expanded"
            ? await deps.getMemoryUsage()
            : null;
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
        };
        writeUsageState(usageData, config);
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
let _lastUsageStateHash = '';
function writeUsageState(usageData, config) {
    if (!usageData)
        return;
    const key = `${usageData.fiveHour}|${usageData.sevenDay}|${usageData.fiveHourResetAt?.toISOString()}|${usageData.sevenDayResetAt?.toISOString()}`;
    if (key === _lastUsageStateHash)
        return;
    _lastUsageStateHash = key;
    try {
        const pluginDir = join(process.env.HOME ?? '~', '.claude', 'plugins', 'claude-hud');
        const state = {
            fiveHour: usageData.fiveHour,
            sevenDay: usageData.sevenDay,
            fiveHourResetAt: usageData.fiveHourResetAt?.toISOString() ?? null,
            sevenDayResetAt: usageData.sevenDayResetAt?.toISOString() ?? null,
            updatedAt: new Date().toISOString(),
            notifications: config.notifications,
        };
        writeFileSync(join(pluginDir, 'usage-state.json'), JSON.stringify(state), 'utf8');
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