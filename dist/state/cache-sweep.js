import * as fs from 'node:fs';
import * as path from 'node:path';
import { getHudPluginDir, getHomeDir } from '../claude-config-dir.js';
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_DIRS = ['transcript-cache', 'burn-samples', 'trend-samples', 'git-cache'];
/**
 * Opportunistic cleanup: cache files accumulate one hashed file per
 * session/cwd forever. At most once per hour, delete files untouched for
 * more than a week. Cheap and entirely best-effort.
 */
export function sweepStaleCaches() {
    try {
        const dir = getHudPluginDir(getHomeDir());
        const marker = path.join(dir, 'last-sweep');
        const now = Date.now();
        try {
            const stat = fs.statSync(marker);
            if (now - stat.mtimeMs < SWEEP_INTERVAL_MS)
                return;
        }
        catch {
        }
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(marker, new Date(now).toISOString(), 'utf8');
        for (const sub of CACHE_DIRS) {
            const subDir = path.join(dir, sub);
            let entries;
            try {
                entries = fs.readdirSync(subDir);
            }
            catch {
                continue;
            }
            for (const name of entries) {
                const filePath = path.join(subDir, name);
                try {
                    const stat = fs.statSync(filePath);
                    if (stat.isFile() && now - stat.mtimeMs > MAX_AGE_MS) {
                        fs.unlinkSync(filePath);
                    }
                }
                catch {
                }
            }
        }
    }
    catch {
        void 0;
    }
}
//# sourceMappingURL=cache-sweep.js.map