import type { GitStatus } from '../git.js';
export declare function getGitStatusCached(cwd: string | undefined, fetcher: (cwd?: string) => Promise<GitStatus | null>): Promise<GitStatus | null>;
//# sourceMappingURL=git-cache.d.ts.map