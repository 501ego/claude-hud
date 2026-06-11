import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
export function getHomeDir() {
    const envHome = process.env.HOME?.trim();
    if (envHome && path.isAbsolute(envHome)) {
        try {
            if (fs.statSync(envHome).isDirectory()) {
                return envHome;
            }
        }
        catch {
        }
    }
    return os.homedir();
}
function expandHomeDirPrefix(inputPath, homeDir) {
    if (inputPath === '~') {
        return homeDir;
    }
    if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
        return path.join(homeDir, inputPath.slice(2));
    }
    return inputPath;
}
export function getClaudeConfigDir(homeDir) {
    const envConfigDir = process.env.CLAUDE_CONFIG_DIR?.trim();
    if (!envConfigDir) {
        return path.join(homeDir, '.claude');
    }
    return path.resolve(expandHomeDirPrefix(envConfigDir, homeDir));
}
export function getClaudeConfigJsonPath(homeDir) {
    return `${getClaudeConfigDir(homeDir)}.json`;
}
export function getHudPluginDir(homeDir) {
    return path.join(getClaudeConfigDir(homeDir), 'plugins', 'claude-hud');
}
//# sourceMappingURL=claude-config-dir.js.map