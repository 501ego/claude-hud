import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCacheGlyph } from '../dist/render/session-line.js';
import { renderSessionStatsLine } from '../dist/render/lines/session.js';
import { coloredBar, coloredBarWithMarker, burnHeatColor, effortCurve, quotaBrailleBar } from '../dist/render/colors.js';

const strip = s => (s ?? '').replace(/\x1b\[[0-9;]*m/g, '');

// --- cache-hit glyph: speak-on-signal (hidden when warm, shows when cold) ---

function usageCtx(cacheRead, input) {
  return { stdin: { context_window: { current_usage: { cache_read_input_tokens: cacheRead, input_tokens: input } } } };
}

test('buildCacheGlyph returns empty string when disabled', () => {
  assert.equal(buildCacheGlyph(usageCtx(900, 100), false), '');
});

test('buildCacheGlyph returns empty when usage missing or total zero', () => {
  assert.equal(buildCacheGlyph({ stdin: {} }, true), '');
  assert.equal(buildCacheGlyph(usageCtx(0, 0), true), '');
});

test('buildCacheGlyph hides on a warm cache and only surfaces when cold', () => {
  assert.equal(buildCacheGlyph(usageCtx(950000, 50000), true), '');   // 0.95 warm -> hidden
  assert.equal(buildCacheGlyph(usageCtx(870000, 130000), true), '');  // 0.87 warm -> hidden (>=0.85)
  assert.equal(buildCacheGlyph(usageCtx(700000, 300000), true), ' ◑'); // 0.70 partial
  assert.equal(buildCacheGlyph(usageCtx(200000, 800000), true), ' ○'); // 0.20 cold (<0.5)
  assert.equal(buildCacheGlyph(usageCtx(0, 300000), true), ' ○');      // cold start, nothing cached
});

// --- burn-heat color tiers ---

test('burnHeatColor buckets velocity into three distinct tiers', () => {
  assert.notEqual(burnHeatColor(100), burnHeatColor(700));
  assert.notEqual(burnHeatColor(700), burnHeatColor(3000));
  assert.notEqual(burnHeatColor(100), burnHeatColor(3000));
});

test('burnHeatColor tier boundaries: <500 low, [500,2000) mid, >=2000 high', () => {
  assert.equal(burnHeatColor(0), burnHeatColor(499));
  assert.equal(burnHeatColor(500), burnHeatColor(1999));
  assert.equal(burnHeatColor(2000), burnHeatColor(9999));
  assert.notEqual(burnHeatColor(499), burnHeatColor(500));
  assert.notEqual(burnHeatColor(1999), burnHeatColor(2000));
});

// --- autocompact marker bar: replace-in-place (no widening) ---

test('coloredBarWithMarker keeps the exact bar width (replace-in-place, not insert)', () => {
  for (const p of [0, 25, 45, 83.5, 100]) {
    const withMarker = strip(coloredBarWithMarker(p, 10, 83.5));
    assert.equal(withMarker.length, 10, `marker bar width at ${p}%`);
    assert.equal(withMarker.length, strip(coloredBar(p, 10)).length, `matches plain bar width at ${p}%`);
  }
});

test('coloredBarWithMarker renders the autocompact marker glyph', () => {
  assert.ok(strip(coloredBarWithMarker(50, 10, 83.5)).includes('┊'));
});

// --- effort curve (driven by settings effortLevel) ---

test('effortCurve maps level to a braille shape, empty for unknown', () => {
  assert.equal(effortCurve('high'), '⣀⣤⣶⣿');
  assert.equal(effortCurve('medium'), '⣀⣶⣿⣶⣀');
  assert.equal(effortCurve('low'), '⣿⣶⣤⣀');
  assert.equal(effortCurve(null), '');
  assert.equal(effortCurve('weird'), '');
});

// --- quota braille bar (usage) ---

test('quotaBrailleBar fills proportionally at a fixed cell width', () => {
  const w = 8;
  assert.equal(strip(quotaBrailleBar(0, w)).length, w);
  assert.equal(strip(quotaBrailleBar(50, w)).length, w);
  assert.equal(strip(quotaBrailleBar(100, w)).length, w);
  assert.ok(strip(quotaBrailleBar(100, w)).includes('⣿'));
  assert.ok(strip(quotaBrailleBar(0, w)).split('').every(c => c === '⠄'));
});

// --- session element: duration + models used + tokens + API-equiv cost ---

function sessionCtx() {
  return {
    sessionDuration: '5h 45m',
    burnRate: null,
    burnTrend: null,
    transcript: { modelUsage: {
      'claude-opus-4-8': { inputTokens: 100000, outputTokens: 50000, cacheCreationTokens: 10000, cacheReadTokens: 600000 },
      'claude-sonnet-4-6': { inputTokens: 5000, outputTokens: 2000, cacheCreationTokens: 0, cacheReadTokens: 1000 },
    } },
    config: { display: { showCost: true, showDuration: true, showSparkline: false }, colors: {} },
  };
}

test('renderSessionStatsLine shows duration, models used, tokens and API-equiv cost (no savings/API)', () => {
  const line = strip(renderSessionStatsLine(sessionCtx()));
  assert.ok(line.startsWith('Session'), line);
  assert.ok(line.includes('5h 45m'), line);
  assert.ok(line.includes('Opus 4.8'), line);
  assert.ok(line.includes('Sonnet 4.6'), line);
  assert.ok(line.includes('tok'), line);
  assert.ok(line.includes('≈ $'), line);
  assert.ok(!line.includes('saved'), `savings figure dropped: ${line}`);
  assert.ok(!line.includes('API'), `API label dropped: ${line}`);
});

test('renderSessionStatsLine returns null when there is nothing to show', () => {
  const ctx = { sessionDuration: '', transcript: {}, config: { display: { showCost: false, showDuration: false }, colors: {} } };
  assert.equal(renderSessionStatsLine(ctx), null);
});
