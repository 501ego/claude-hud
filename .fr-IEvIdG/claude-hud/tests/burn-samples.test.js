import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readBurnSamples, readBurnTrend, writeBurnSamples } from '../dist/state/burn-samples.js';

// burn-samples keys files per-transcript-path (sha256 of resolved path) under
// getHudPluginDir, which honors CLAUDE_CONFIG_DIR. Point it at a temp dir so we
// can seed crafted sample files with controlled timestamps.

let tmpDir;
let prevConfigDir;

function setup() {
  prevConfigDir = process.env.CLAUDE_CONFIG_DIR;
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'hud-burn-'));
  process.env.CLAUDE_CONFIG_DIR = tmpDir;
}

function samplePath(transcriptPath) {
  const hash = createHash('sha256').update(path.resolve(transcriptPath)).digest('hex');
  return path.join(tmpDir, 'plugins', 'claude-hud', 'burn-samples', `${hash}.json`);
}

function seed(transcriptPath, samples) {
  const fp = samplePath(transcriptPath);
  mkdirSync(path.dirname(fp), { recursive: true });
  writeFileSync(fp, JSON.stringify({ samples, updatedAt: new Date().toISOString() }), 'utf8');
}

afterEach(() => {
  if (prevConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = prevConfigDir;
  if (tmpDir) { rmSync(tmpDir, { recursive: true, force: true }); tmpDir = undefined; }
});

const T = path.resolve(os.tmpdir(), 'burn-fixture-session.jsonl');

test('readBurnSamples computes tok/min from increasing in-window samples', () => {
  setup();
  const now = Date.now();
  seed(T, [{ tokensTotal: 1000, timestamp: now - 120000 }, { tokensTotal: 5000, timestamp: now - 60000 }]);
  // (5000-1000) / ((120000-60000)/60000 = 1 min) = 4000 tok/min
  assert.equal(readBurnSamples(T), 4000);
});

test('readBurnSamples returns null with fewer than 2 in-window samples', () => {
  setup();
  const now = Date.now();
  seed(T, [{ tokensTotal: 1000, timestamp: now - 30000 }]);
  assert.equal(readBurnSamples(T), null);
});

test('readBurnSamples returns null on token decrease (session reset / clear)', () => {
  setup();
  const now = Date.now();
  seed(T, [{ tokensTotal: 5000, timestamp: now - 60000 }, { tokensTotal: 1000, timestamp: now - 30000 }]);
  assert.equal(readBurnSamples(T), null);
});

test('readBurnSamples returns null when all samples are stale (outside 5-min window)', () => {
  setup();
  const now = Date.now();
  seed(T, [{ tokensTotal: 1000, timestamp: now - 700000 }, { tokensTotal: 5000, timestamp: now - 650000 }]);
  assert.equal(readBurnSamples(T), null);
});

test('readBurnSamples returns null for an unknown transcript (no file)', () => {
  setup();
  assert.equal(readBurnSamples(path.resolve(os.tmpdir(), 'never-written.jsonl')), null);
});

test('readBurnTrend returns the per-interval rate series', () => {
  setup();
  const now = Date.now();
  seed(T, [
    { tokensTotal: 0, timestamp: now - 180000 },
    { tokensTotal: 1000, timestamp: now - 120000 },
    { tokensTotal: 3000, timestamp: now - 60000 },
  ]);
  // intervals: (1000-0)/1=1000, (3000-1000)/1=2000
  assert.deepEqual(readBurnTrend(T), [1000, 2000]);
});

test('writeBurnSamples creates the keyed file, appends, and prunes stale samples', () => {
  setup();
  const now = Date.now();
  seed(T, [{ tokensTotal: 100, timestamp: now - 700000 }]); // stale, must be pruned
  writeBurnSamples(T, 5000);
  const raw = JSON.parse(readFileSync(samplePath(T), 'utf8'));
  assert.equal(raw.samples.length, 1, 'stale sample pruned, new one appended');
  assert.equal(raw.samples[0].tokensTotal, 5000);
});

test('writeBurnSamples is non-fatal and isolates by transcript path', () => {
  setup();
  const A = path.resolve(os.tmpdir(), 'burn-A.jsonl');
  const B = path.resolve(os.tmpdir(), 'burn-B.jsonl');
  writeBurnSamples(A, 1000);
  writeBurnSamples(B, 9999);
  const rawA = JSON.parse(readFileSync(samplePath(A), 'utf8'));
  const rawB = JSON.parse(readFileSync(samplePath(B), 'utf8'));
  assert.equal(rawA.samples[0].tokensTotal, 1000);
  assert.equal(rawB.samples[0].tokensTotal, 9999);
  assert.notEqual(samplePath(A), samplePath(B));
});
