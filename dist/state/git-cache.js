import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getHudPluginDir, getHomeDir } from '../claude-config-dir.js';
const TTL_MS = 5000;
function getGitCachePath(cwd) {
    const hash = createHash('sha256').update(path.resolve(cwd)).digest('hex');
    return path.join(getHudPluginDir(getHomeDir()), 'git-cache', `${hash}.json`);
}
export async function getGitStatusCached(cwd, fetcher) {
    if (!cwd)
        return null;
    const cachePath = getGitCachePath(cwd);
    try {
        const raw = JSON.parse(readFileSync(cachePath, 'utf8'));
        if (typeof raw.cachedAt === 'number' && Date.now() - raw.cachedAt < TTL_MS) {
            return raw.status;
        }
    }
    catch {
    }
    const status = await fetcher(cwd);
    try {
        mkdirSync(path.dirname(cachePath), { recursive: true });
        writeFileSync(cachePath, JSON.stringify({ cachedAt: Date.now(), status }), 'utf8');
    }
    catch {
        void 0;
    }
    return status;
}
//# sourceMappingURL=git-cache.js.map