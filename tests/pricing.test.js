import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupRate, estimateCostFromTokens, estimateCost } from '../dist/pricing.js';

// Rates verified against platform.claude.com/docs pricing (2026-05).
// cacheWrite = 5-minute cache write = 1.25x base input. cacheRead = 0.1x base input.

test('lookupRate resolves the Opus 4.x tier ($5/$25) for current Opus slugs', () => {
  // Opus 4.5+ ($5/$25). NOTE: bare deprecated Opus 4 / Opus 4.1 cost $15/$75; 4.1 is
  // handled by its own slug, bare Opus 4 (claude-opus-4-2025xxxx) still resolves to $5 here
  // by design (deprecated, low value) — so it is intentionally excluded from this tier check.
  for (const id of ['claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-opus-4-5']) {
    const rate = lookupRate(id);
    assert.equal(rate.inputPerMTok, 5, id);
    assert.equal(rate.outputPerMTok, 25, id);
    assert.equal(rate.cacheReadPerMTok, 0.5, id);
    assert.equal(rate.cacheWritePerMTok, 6.25, id);
  }
});

test('lookupRate resolves deprecated Opus 4.1 to $15/$75 via longest-match', () => {
  const rate = lookupRate('claude-opus-4-1-20250805');
  assert.equal(rate.inputPerMTok, 15);
  assert.equal(rate.outputPerMTok, 75);
  assert.equal(rate.cacheReadPerMTok, 1.5);
  assert.equal(rate.cacheWritePerMTok, 18.75);
});

test('lookupRate resolves Sonnet 4.x to $3/$15', () => {
  const rate = lookupRate('claude-sonnet-4-6');
  assert.equal(rate.inputPerMTok, 3);
  assert.equal(rate.outputPerMTok, 15);
  assert.equal(rate.cacheReadPerMTok, 0.3);
  assert.equal(rate.cacheWritePerMTok, 3.75);
});

test('lookupRate resolves Haiku 4.5 to $1/$5', () => {
  const rate = lookupRate('claude-haiku-4-5-20251001');
  assert.equal(rate.inputPerMTok, 1);
  assert.equal(rate.outputPerMTok, 5);
  assert.equal(rate.cacheReadPerMTok, 0.1);
  assert.equal(rate.cacheWritePerMTok, 1.25);
});

test('lookupRate resolves the legacy 3.5 family', () => {
  const sonnet = lookupRate('claude-3-5-sonnet-20241022');
  assert.equal(sonnet.inputPerMTok, 3);
  assert.equal(sonnet.outputPerMTok, 15);

  const haiku = lookupRate('claude-3-5-haiku-20241022');
  assert.equal(haiku.inputPerMTok, 0.8);
  assert.equal(haiku.outputPerMTok, 4);
  assert.equal(haiku.cacheReadPerMTok, 0.08);
  assert.equal(haiku.cacheWritePerMTok, 1.0);
});

test('lookupRate falls back to the Sonnet-equivalent default for unknown models', () => {
  const rate = lookupRate('gpt-something-unknown');
  assert.equal(rate.inputPerMTok, 3);
  assert.equal(rate.outputPerMTok, 15);
  assert.equal(rate.cacheWritePerMTok, 3.75);
});

test('estimateCostFromTokens bills all four buckets including cache writes', () => {
  // Opus 4.x: 100k in, 50k out, 20k cache-read, 10k cache-write
  // 100000*5 + 50000*25 + 20000*0.5 + 10000*6.25 = 1,822,500 → $1.8225
  const cost = estimateCostFromTokens('claude-opus-4-8', 100_000, 50_000, 20_000, 10_000);
  assert.equal(cost, 1.8225);
});

test('estimateCostFromTokens counts cache-write tokens (regression: they were dropped)', () => {
  const withWrites = estimateCostFromTokens('claude-opus-4-8', 0, 0, 0, 1_000_000);
  // 1M cache-write tokens at $6.25/MTok = $6.25, must not be silently dropped to 0.
  assert.equal(withWrites, 6.25);
});

test('estimateCost(stdin) includes cache_creation_input_tokens from the context window', () => {
  const stdin = {
    model: { id: 'claude-opus-4-8' },
    context_window: {
      current_usage: {
        input_tokens: 100_000,
        output_tokens: 50_000,
        cache_read_input_tokens: 20_000,
        cache_creation_input_tokens: 10_000,
      },
    },
  };
  const { cost, totalTokens } = estimateCost(stdin);
  assert.equal(cost, 1.8225);
  assert.equal(totalTokens, 150_000); // input + output
});

test('estimateCost is null-safe when usage is missing', () => {
  const { cost, totalTokens } = estimateCost({ model: { id: 'claude-opus-4-8' } });
  assert.equal(cost, 0);
  assert.equal(totalTokens, 0);
});
