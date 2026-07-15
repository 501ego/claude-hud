/**
 * Per-transcript pet motion persistence. The statusline is a fresh process
 * every render, so smooth movement needs the previous sprite position on
 * disk: each render reads the last offset, glides one step toward the
 * current target, and writes the new position back. Best-effort I/O.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getHudPluginDir, getHomeDir } from '../claude-config-dir.js';

export interface PetAnim {
  offset: number;
  mirrored: boolean;
  atMs: number;
}

interface PetAnimFile {
  version: number;
  entries: Record<string, PetAnim>;
}

const ANIM_RETENTION_MS = 24 * 60 * 60 * 1000;

function getAnimPath(): string {
  return path.join(getHudPluginDir(getHomeDir()), 'pet-anim.json');
}

function keyFor(transcriptPath: string): string {
  return createHash('sha256').update(path.resolve(transcriptPath)).digest('hex').slice(0, 16);
}

function loadFile(): PetAnimFile {
  try {
    const raw = JSON.parse(fs.readFileSync(getAnimPath(), 'utf8')) as PetAnimFile;
    if (raw && raw.entries && typeof raw.entries === 'object') return raw;
  } catch {
  }
  return { version: 1, entries: {} };
}

export function readPetAnim(transcriptPath: string): PetAnim | null {
  const entry = loadFile().entries[keyFor(transcriptPath)];
  if (!entry || typeof entry.offset !== 'number' || typeof entry.atMs !== 'number') return null;
  return entry;
}

export function writePetAnim(transcriptPath: string, anim: PetAnim): void {
  try {
    const file = loadFile();
    file.entries[keyFor(transcriptPath)] = anim;
    for (const [key, entry] of Object.entries(file.entries)) {
      if (anim.atMs - entry.atMs > ANIM_RETENTION_MS) delete file.entries[key];
    }
    const filePath = getAnimPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(file), 'utf8');
  } catch {
    void 0;
  }
}
