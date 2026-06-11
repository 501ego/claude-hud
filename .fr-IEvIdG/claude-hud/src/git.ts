import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface LineDiff {
  added: number;
  deleted: number;
}

export interface TrackedFile {
  basename: string;
  fullPath: string;
  type: 'modified' | 'added' | 'deleted';
  lineDiff?: LineDiff;
}

export interface FileStats {
  modified: number;
  added: number;
  deleted: number;
  untracked: number;
  trackedFiles: TrackedFile[];
}

export interface GitStatus {
  branch: string;
  isDirty: boolean;
  ahead: number;
  behind: number;
  fileStats?: FileStats;
  lineDiff?: LineDiff;
  branchUrl?: string;
}

export async function getGitStatus(cwd?: string): Promise<GitStatus | null> {
  if (!cwd) return null;

  try {
    const { stdout: branchOut } = await execFileAsync(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd, timeout: 1000, encoding: 'utf8' }
    );
    const branch = branchOut.trim();
    if (!branch) return null;

    let isDirty = false;
    let fileStats: FileStats | undefined;
    let lineDiff: LineDiff | undefined;
    try {
      const { stdout: statusOut } = await execFileAsync(
        'git',
        ['--no-optional-locks', 'status', '--porcelain'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const trimmed = statusOut.trim();
      isDirty = trimmed.length > 0;
      if (isDirty) {
        fileStats = parseFileStats(trimmed);
      }
    } catch {
    }

    if (isDirty) {
      try {
        const { stdout: numstatOut } = await execFileAsync(
          'git',
          ['diff', '--numstat', 'HEAD'],
          { cwd, timeout: 2000, encoding: 'utf8' }
        );
        const { totalDiff, perFileDiff } = parseNumstat(numstatOut);
        lineDiff = totalDiff;
        if (fileStats) {
          applyLineDiffsToFiles(fileStats.trackedFiles, perFileDiff);
        }
      } catch {
      }
    }

    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: revOut } = await execFileAsync(
        'git',
        ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const parts = revOut.trim().split(/\s+/);
      if (parts.length === 2) {
        behind = parseInt(parts[0], 10) || 0;
        ahead = parseInt(parts[1], 10) || 0;
      }
    } catch {
    }

    let branchUrl: string | undefined;
    try {
      const { stdout: remoteOut } = await execFileAsync(
        'git',
        ['remote', 'get-url', 'origin'],
        { cwd, timeout: 1000, encoding: 'utf8' }
      );
      const remote = remoteOut.trim();
      const httpsBase = remote
        .replace(/^git@([^:]+):/, 'https://$1/')
        .replace(/\.git$/, '');
      if (httpsBase.startsWith('https://')) {
        branchUrl = `${httpsBase}/tree/${branch}`;
      }
    } catch {
    }

    return { branch, isDirty, ahead, behind, fileStats, lineDiff, branchUrl };
  } catch {
    return null;
  }
}

/**
 * Parse git status --porcelain output into file stats.
 * Status codes: M=modified, A=added, D=deleted, ??=untracked
 */
function parseFileStats(porcelainOutput: string): FileStats {
  const stats: FileStats = { modified: 0, added: 0, deleted: 0, untracked: 0, trackedFiles: [] };
  const lines = porcelainOutput.split('\n').filter(Boolean);

  for (const line of lines) {
    if (line.length < 2) continue;

    const index = line[0];
    const worktree = line[1];

    if (line.startsWith('??')) {
      stats.untracked++;
    } else if (index === 'A') {
      stats.added++;
      const fullPath = line.slice(2).trimStart();
      stats.trackedFiles.push({ basename: fullPath.split('/').pop() ?? fullPath, fullPath, type: 'added' });
    } else if (index === 'D' || worktree === 'D') {
      stats.deleted++;
      const fullPath = line.slice(2).trimStart();
      stats.trackedFiles.push({ basename: fullPath.split('/').pop() ?? fullPath, fullPath, type: 'deleted' });
    } else if (index === 'M' || worktree === 'M' || index === 'R' || index === 'C') {
      stats.modified++;
      const fullPath = line.slice(2).trimStart().split(' -> ').pop() ?? line.slice(2).trimStart();
      stats.trackedFiles.push({ basename: fullPath.split('/').pop() ?? fullPath, fullPath, type: 'modified' });
    }
  }

  return stats;
}

/**
 * Parse `git diff --numstat HEAD` output.
 * Returns total line diff and a per-file map.
 */
function parseNumstat(numstatOutput: string): { totalDiff: LineDiff; perFileDiff: Map<string, LineDiff> } {
  const totalDiff: LineDiff = { added: 0, deleted: 0 };
  const perFileDiff = new Map<string, LineDiff>();

  for (const line of numstatOutput.trim().split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const added = parseInt(parts[0], 10);
    const deleted = parseInt(parts[1], 10);
    const filePath = parts[2];
    if (Number.isNaN(added) || Number.isNaN(deleted)) continue;
    totalDiff.added += added;
    totalDiff.deleted += deleted;
    perFileDiff.set(filePath, { added, deleted });
  }

  return { totalDiff, perFileDiff };
}

function applyLineDiffsToFiles(files: TrackedFile[], perFileDiff: Map<string, LineDiff>): void {
  for (const file of files) {
    const diff = perFileDiff.get(file.fullPath);
    if (diff) {
      file.lineDiff = diff;
    }
  }
}
