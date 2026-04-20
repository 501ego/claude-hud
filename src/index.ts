import { readStdin, getUsageFromStdin } from "./stdin.js";
import { parseTranscript } from "./transcript.js";
import { render } from "./render/index.js";
import { countConfigs } from "./config-reader.js";
import { getGitStatus } from "./git.js";
import { loadConfig } from "./config.js";
import { getMemoryUsage } from "./memory.js";
import type { RenderContext } from "./types.js";
import { fileURLToPath } from "node:url";
import { realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type MainDeps = {
  readStdin: typeof readStdin;
  getUsageFromStdin: typeof getUsageFromStdin;
  parseTranscript: typeof parseTranscript;
  countConfigs: typeof countConfigs;
  getGitStatus: typeof getGitStatus;
  loadConfig: typeof loadConfig;
  getMemoryUsage: typeof getMemoryUsage;
  render: typeof render;
  now: () => number;
  log: (...args: unknown[]) => void;
};

export async function main(overrides: Partial<MainDeps> = {}): Promise<void> {
  if (process.argv.includes("--test")) {
    const mockStdin = {
      model: { display_name: "Sonnet" },
      context_window: {
        context_window_size: 200000,
        current_usage: { input_tokens: 10000 },
      },
    };
    try {
      const testDeps: MainDeps = {
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
        readStdin: async () => mockStdin,
      };
      const config = await testDeps.loadConfig();
      const transcript = await testDeps.parseTranscript("");
      const { claudeMdCount, rulesCount, mcpCount, hooksCount, outputStyle } =
        await testDeps.countConfigs(undefined);
      const ctx: RenderContext = {
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
    } catch (error) {
      process.stderr.write(
        `[claude-hud --test] Error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(1);
    }
  }

  const deps: MainDeps = {
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

    const { claudeMdCount, rulesCount, mcpCount, hooksCount, outputStyle } =
      await deps.countConfigs(stdin.cwd);

    const config = await deps.loadConfig();
    const gitStatus = config.gitStatus.enabled
      ? await deps.getGitStatus(stdin.cwd)
      : null;

    // Usage comes only from Claude Code's official stdin rate_limits fields.
    let usageData: RenderContext["usageData"] = null;
    if (config.display.showUsage !== false) {
      usageData = deps.getUsageFromStdin(stdin);
    }

    const sessionDuration = formatSessionDuration(
      transcript.sessionStart,
      deps.now,
    );
    const memoryUsage =
      config.display.showMemoryUsage && config.lineLayout === "expanded"
        ? await deps.getMemoryUsage()
        : null;

    const ctx: RenderContext = {
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
  } catch (error) {
    deps.log(
      "[claude-hud] Error:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export function formatSessionDuration(
  sessionStart?: Date,
  now: () => number = () => Date.now(),
): string {
  if (!sessionStart) {
    return "";
  }

  const ms = now() - sessionStart.getTime();
  const mins = Math.floor(ms / 60000);

  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

let _lastUsageStateHash = '';

function writeUsageState(
  usageData: RenderContext['usageData'],
  config: RenderContext['config'],
): void {
  if (!usageData) return;
  const key = `${usageData.fiveHour}|${usageData.sevenDay}|${usageData.fiveHourResetAt?.toISOString()}|${usageData.sevenDayResetAt?.toISOString()}`;
  if (key === _lastUsageStateHash) return;
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
  } catch {
  }
}

const scriptPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1];
const isSamePath = (a: string, b: string): boolean => {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return a === b;
  }
};
if (argvPath && isSamePath(argvPath, scriptPath)) {
  void main();
}
