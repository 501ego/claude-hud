import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getHudPluginDir, getHomeDir } from '../claude-config-dir.js';
const WINDOW_MS = 5 * 60 * 1000;
const UTF8 = 'utf8';
function getBurnSamplePath(transcriptPath) {
    const hash = createHash('sha256').update(path.resolve(transcriptPath)).digest('hex');
    return path.join(getHudPluginDir(getHomeDir()), 'burn-samples', `${hash}.json`);
}
function loadInWindowSamples(transcriptPath) {
    const filePath = getBurnSamplePath(transcriptPath);
    let samples;
    try {
        const raw = JSON.parse(readFileSync(filePath, UTF8));
        samples = Array.isArray(raw.samples) ? raw.samples : [];
    }
    catch {
        return null;
    }
    const cutoff = Date.now() - WINDOW_MS;
    const inWindow = samples.filter(s => s.timestamp >= cutoff);
    if (inWindow.length < 2)
        return null;
    let start = inWindow.length - 1;
    while (start > 0 && inWindow[start - 1].tokensTotal <= inWindow[start].tokensTotal) {
        start -= 1;
    }
    const monotone = inWindow.slice(start);
    if (monotone.length < 2)
        return null;
    return monotone;
}
export function readBurnSamples(transcriptPath) {
    const inWindow = loadInWindowSamples(transcriptPath);
    if (!inWindow)
        return null;
    const oldest = inWindow[0];
    const newest = inWindow[inWindow.length - 1];
    const deltaTokens = newest.tokensTotal - oldest.tokensTotal;
    const deltaMinutes = (newest.timestamp - oldest.timestamp) / 60000;
    const burnRate = deltaTokens / deltaMinutes;
    if (!Number.isFinite(burnRate) || burnRate < 0)
        return null;
    return burnRate;
}
export function readBurnTrend(transcriptPath) {
    const inWindow = loadInWindowSamples(transcriptPath);
    if (!inWindow)
        return null;
    const series = [];
    for (let i = 1; i < inWindow.length; i++) {
        const deltaTokens = inWindow[i].tokensTotal - inWindow[i - 1].tokensTotal;
        const deltaMinutes = (inWindow[i].timestamp - inWindow[i - 1].timestamp) / 60000;
        const rate = deltaTokens / deltaMinutes;
        if (!Number.isFinite(rate) || rate < 0)
            return null;
        series.push(rate);
    }
    if (series.length === 0)
        return null;
    return series;
}
export function writeBurnSamples(transcriptPath, tokensTotal) {
    const filePath = getBurnSamplePath(transcriptPath);
    try {
        mkdirSync(path.dirname(filePath), { recursive: true });
        let samples = [];
        try {
            const raw = JSON.parse(readFileSync(filePath, UTF8));
            samples = Array.isArray(raw.samples) ? raw.samples : [];
        }
        catch {
            samples = [];
        }
        const cutoff = Date.now() - WINDOW_MS;
        samples = samples.filter(s => s.timestamp >= cutoff);
        samples = samples.filter(s => s.tokensTotal <= tokensTotal);
        samples.push({ tokensTotal, timestamp: Date.now() });
        const data = { samples, updatedAt: new Date().toISOString() };
        writeFileSync(filePath, JSON.stringify(data), UTF8);
    }
    catch {
        void 0;
    }
}
//# sourceMappingURL=burn-samples.js.map