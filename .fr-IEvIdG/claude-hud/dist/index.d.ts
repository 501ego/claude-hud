import { readStdin, getUsageFromStdin } from "./stdin.js";
import { parseTranscript } from "./transcript.js";
import { render } from "./render/index.js";
import { countConfigs } from "./config-reader.js";
import { getGitStatus } from "./git.js";
import { loadConfig } from "./config.js";
import { getMemoryUsage } from "./memory.js";
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
export declare function main(overrides?: Partial<MainDeps>): Promise<void>;
export declare function formatSessionDuration(sessionStart?: Date, now?: () => number): string;
//# sourceMappingURL=index.d.ts.map