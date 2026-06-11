import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getHudPluginDir, getHomeDir } from '../claude-config-dir.js';

const UTF8 = 'utf8' as const;
const MIN_SPAN_MS = 60 * 1000;

interface TrendSample {
  value: number;
  timestamp: number;
}

interface TrendSampleFile {
  samples: TrendSample[];
  updatedAt: string;
}

function getTrendSamplePath(key: string): string {
  const hash = createHash('sha256').update(key).digest('hex');
  return path.join(getHudPluginDir(getHomeDir()), 'trend-samples', `${hash}.json`);
}

function loadSamples(filePath: string): TrendSample[] {
  try {
    const raw = JSON.parse(readFileSync(filePath, UTF8)) as TrendSampleFile;
    return Array.isArray(raw.samples) ? raw.samples : [];
  } catch {
    return [];
  }
}

/**
 * Record a monotonically growing value (context tokens, quota percent).
 * A decrease means the underlying counter reset (compaction, quota window
 * reset) — older samples above the new value are dropped so the series
 * stays monotone and the rate restarts from the break point.
 */
export function recordTrendSample(key: string, value: number, windowMs: number): void {
  const filePath = getTrendSamplePath(key);
  try {
    mkdirSync(path.dirname(filePath), { recursive: true });
    let samples = loadSamples(filePath);
    const cutoff = Date.now() - windowMs;
    samples = samples.filter(s => s.timestamp >= cutoff && s.value <= value);
    samples.push({ value, timestamp: Date.now() });
    const data: TrendSampleFile = { samples, updatedAt: new Date().toISOString() };
    writeFileSync(filePath, JSON.stringify(data), UTF8);
  } catch {
    void 0;
  }
}

/** Growth rate in value-units per minute over the sampled window, or null. */
export function readTrendRatePerMin(key: string, windowMs: number): number | null {
  const filePath = getTrendSamplePath(key);
  const cutoff = Date.now() - windowMs;
  const samples = loadSamples(filePath).filter(s => s.timestamp >= cutoff);
  if (samples.length < 2) return null;
  const oldest = samples[0];
  const newest = samples[samples.length - 1];
  const spanMs = newest.timestamp - oldest.timestamp;
  if (spanMs < MIN_SPAN_MS) return null;
  const rate = (newest.value - oldest.value) / (spanMs / 60000);
  if (!Number.isFinite(rate) || rate < 0) return null;
  return rate;
}
