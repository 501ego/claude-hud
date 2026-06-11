import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderPetArea, petBlankRow, PET_MIN_AREA, PET_SPRITE_WIDTH } from '../dist/render/pet.js';
import { resolvePetStatus } from '../dist/state/pet-state.js';
import { mergeConfig } from '../dist/config.js';

const ANSI = /\x1b\[[0-9;]*m/g;

let tmpDir;
let prevConfigDir;
let transcriptPath;

beforeEach(() => {
  prevConfigDir = process.env.CLAUDE_CONFIG_DIR;
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'hud-pet-'));
  process.env.CLAUDE_CONFIG_DIR = tmpDir;
  transcriptPath = path.join(tmpDir, 'session.jsonl');
  writeFileSync(transcriptPath, '{}\n', 'utf8');
});

afterEach(() => {
  if (prevConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = prevConfigDir;
  if (tmpDir) { rmSync(tmpDir, { recursive: true, force: true }); tmpDir = undefined; }
});

function baseInput(overrides = {}) {
  return {
    transcriptPath,
    transcript: {
      tools: [],
      agents: [],
      todos: [],
      sessionStart: new Date(Date.now() - 10 * 60 * 1000),
      // Enough lifetime tokens to hatch past the egg stage.
      sessionTokens: { inputTokens: 3_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      ...overrides.transcript,
    },
    stdin: overrides.stdin ?? { context_window: { context_window_size: 200000, current_usage: { input_tokens: 50000 } } },
    usageData: overrides.usageData ?? null,
    fiveHourExhaustMin: overrides.fiveHourExhaustMin ?? null,
    contextPercent: overrides.contextPercent ?? 30,
  };
}

test('renderPetArea returns 3 rows of exact area width for every state, level, time and align', () => {
  const states = ['egg', 'calm', 'working', 'focused', 'curious', 'sleeping', 'eating',
    'stressed', 'burning', 'panic', 'error', 'dizzy', 'melted', 'startled', 'sad', 'sick', 'levelup', 'kawaii'];
  for (const areaWidth of [PET_MIN_AREA, 20, 26]) {
    for (const state of states) {
      for (const level of ['egg', 'kitten', 'adult', 'legend']) {
        for (const now of [0, 600, 700, 1400, 9_999_999]) {
          for (const align of ['left', 'right']) {
            for (const style of ['cat', 'claude']) {
              const rows = renderPetArea(state, level, now, areaWidth, align, style);
              assert.ok(rows.length >= 3 && rows.length <= 5, `${state}/${level} rows`);
              for (const row of rows) {
                assert.equal(row.replace(ANSI, '').length, areaWidth,
                  `${style}/${state}/${level}/${now}/${align}/${areaWidth} width`);
              }
            }
          }
        }
      }
    }
  }
  assert.equal(petBlankRow(26).length, 26);
});

test('renderPetArea panic jitter alternates frames at fixed width', () => {
  const a = renderPetArea('panic', 'adult', 0, 20, 'right');
  const b = renderPetArea('panic', 'adult', 300, 20, 'right');
  assert.notEqual(a.join(''), b.join(''), 'shake should alternate frames');
});

test('renderPetArea calm state patrols the area over time', () => {
  const offsets = new Set();
  for (let t = 0; t < 20_000; t += 700) {
    const rows = renderPetArea('calm', 'adult', t, 26, 'right');
    const visible = rows[1].replace(ANSI, '');
    offsets.add(visible.length - visible.trimStart().length);
  }
  assert.ok(offsets.size > 3, `should visit several positions, got ${offsets.size}`);
});

test('renderPetArea working state animates between two frames', () => {
  const a = renderPetArea('working', 'adult', 0, PET_MIN_AREA, 'right');
  const b = renderPetArea('working', 'adult', 900, PET_MIN_AREA, 'right');
  assert.notEqual(a.join(''), b.join(''), 'working should alternate alt frames');
  assert.equal(PET_SPRITE_WIDTH, 12);
});

test('resolvePetStatus stays egg with low lifetime XP', () => {
  const input = baseInput({
    transcript: { sessionTokens: { inputTokens: 1000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } },
  });
  const status = resolvePetStatus(input, Date.now());
  assert.equal(status.level, 'egg');
  assert.equal(status.state, 'egg');
});

test('resolvePetStatus precedence: melted > panic > stressed > working > calm', () => {
  const now = Date.now();

  const melted = resolvePetStatus(baseInput({
    usageData: { fiveHour: 100, sevenDay: 40, fiveHourResetAt: null, sevenDayResetAt: null },
    fiveHourExhaustMin: 5,
    contextPercent: 95,
  }), now);
  assert.equal(melted.state, 'melted');

  const panic = resolvePetStatus(baseInput({
    usageData: { fiveHour: 92, sevenDay: 40, fiveHourResetAt: null, sevenDayResetAt: null },
    fiveHourExhaustMin: 10,
    contextPercent: 95,
  }), now);
  assert.equal(panic.state, 'panic');

  const burning = resolvePetStatus(baseInput({
    fiveHourExhaustMin: 30,
    contextPercent: 95,
  }), now);
  assert.equal(burning.state, 'burning');

  const stressed = resolvePetStatus(baseInput({ contextPercent: 90 }), now);
  assert.equal(stressed.state, 'stressed');

  // The first render hatched the pet (egg -> kitten), which opens a 5s
  // level-up window — advance past it to test the lower-priority states.
  const later = now + 6000;

  const working = resolvePetStatus(baseInput({
    transcript: {
      sessionTokens: { inputTokens: 3_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      tools: [{ id: 't1', name: 'Read', status: 'running', startTime: new Date(later - 1000) }],
    },
  }), later);
  assert.equal(working.state, 'working');

  const focused = resolvePetStatus(baseInput({
    transcript: {
      sessionTokens: { inputTokens: 3_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      tools: [{ id: 't1', name: 'Read', status: 'running', startTime: new Date(later - 60_000) }],
    },
  }), later);
  assert.equal(focused.state, 'focused');

  const calm = resolvePetStatus(baseInput(), later);
  assert.equal(calm.state, 'calm');
  assert.equal(calm.level, 'kitten');
});

test('resolvePetStatus flags recent tool errors', () => {
  const now = Date.now();
  const status = resolvePetStatus(baseInput({
    transcript: {
      sessionTokens: { inputTokens: 3_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      tools: [{ id: 't1', name: 'Bash', status: 'error', startTime: new Date(now - 3000), endTime: new Date(now - 1000) }],
    },
  }), now);
  assert.equal(status.state, 'error');
});

test('resolvePetStatus accumulates XP across renders and levels up', () => {
  const now = Date.now();
  const tokens = (n) => ({ inputTokens: n, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 });

  const first = resolvePetStatus(baseInput({ transcript: { sessionTokens: tokens(1_000_000) } }), now);
  assert.equal(first.level, 'egg');

  const second = resolvePetStatus(baseInput({ transcript: { sessionTokens: tokens(3_000_000) } }), now + 1000);
  assert.equal(second.level, 'kitten');
  assert.equal(second.state, 'levelup');
});

test('mergeConfig pet defaults to an enabled right-anchored cat and accepts overrides', () => {
  const def = mergeConfig({});
  assert.deepEqual(def.pet, { enabled: true, style: 'cat', position: 'right', minWidth: 80, rightMargin: 8, roamWidth: 26, debug: false });

  const on = mergeConfig({ pet: { enabled: true, minWidth: 100, position: 'left' } });
  assert.equal(on.pet.enabled, true);
  assert.equal(on.pet.minWidth, 100);
  assert.equal(on.pet.position, 'left');
  assert.equal(on.pet.style, 'cat');

  const invalid = mergeConfig({ pet: { enabled: 'yes', style: 'dog', position: 'top', minWidth: -5, rightMargin: -1, roamWidth: 5, debug: 1 } });
  assert.deepEqual(invalid.pet, { enabled: true, style: 'cat', position: 'right', minWidth: 80, rightMargin: 8, roamWidth: 26, debug: false });
});

test('renderPetArea speech: short beside the head, long on its own row below', () => {
  // 'yum!' is short: rides the head row, no extra row.
  const eating = renderPetArea('eating', 'adult', 0, 26, 'right');
  assert.equal(eating.length, 3);
  const head = eating[0].replace(ANSI, '');
  assert.ok(head.includes('yum!'), `speech missing in "${head}"`);
  assert.equal(head.length, 26);

  // '5h almost out!' is long: blank spacer row, then its own row centered
  // under the sprite.
  const panic = renderPetArea('panic', 'adult', 0, 26, 'right');
  assert.equal(panic.length, 5);
  assert.ok(!panic[0].replace(ANSI, '').includes('out'), 'long speech must not crowd the head row');
  assert.equal(panic[3].replace(ANSI, '').trim(), '', 'spacer row should be blank');
  const below = panic[4].replace(ANSI, '');
  assert.ok(below.includes('5h almost out!'), `speech missing in "${below}"`);
  assert.equal(below.length, 26);
  // Sprite spans cols 14-25 (center 20); the 14-char message should sit
  // visually centered under it, not flushed to the strip's left edge.
  const msgStart = below.indexOf('5h almost out!');
  const msgCenter = msgStart + 7;
  assert.ok(Math.abs(msgCenter - 20) <= 1, `message center ${msgCenter} too far from sprite center`);
});

test('renderPetArea claude style renders a distinct sprite from the cat', () => {
  const cat = renderPetArea('calm', 'adult', 0, 26, 'right', 'cat');
  const claude = renderPetArea('calm', 'adult', 0, 26, 'right', 'claude');
  assert.notEqual(cat.join(''), claude.join(''), 'styles should differ');
  for (const rows of [cat, claude]) {
    for (const row of rows) assert.equal(row.replace(ANSI, '').length, 26);
  }
  // Unknown style falls back to the cat.
  const fallback = renderPetArea('calm', 'adult', 0, 26, 'right', 'dog');
  assert.equal(fallback.join(''), cat.join(''));
});

test('mergeConfig accepts the claude pet style and rejects unknown ones', () => {
  assert.equal(mergeConfig({ pet: { style: 'claude' } }).pet.style, 'claude');
  assert.equal(mergeConfig({ pet: { style: 'dog' } }).pet.style, 'cat');
});

test('resolvePetStatus reacts kawaii when the pet-touch file was just touched', () => {
  const now = Date.now();
  const touchDir = path.join(tmpDir, 'plugins', 'claude-hud');
  mkdirSync(touchDir, { recursive: true });
  writeFileSync(path.join(touchDir, 'pet-touch'), '', 'utf8');

  const petted = resolvePetStatus(baseInput({ fiveHourExhaustMin: 5, contextPercent: 95 }), now);
  assert.equal(petted.state, 'kawaii', 'petting outranks panic');

  // Touch long expired: back to normal state resolution.
  const later = now + 60_000;
  const expired = resolvePetStatus(baseInput(), later);
  assert.notEqual(expired.state, 'kawaii');
});

test('renderPetArea homes non-walking states at the anchored edge', () => {
  // sleeping doesn't walk: right-anchored -> free space on the left
  const right = renderPetArea('sleeping', 'adult', 0, 20, 'right');
  const left = renderPetArea('sleeping', 'adult', 0, 20, 'left');
  const rightVis = right[1].replace(ANSI, '');
  const leftVis = left[1].replace(ANSI, '');
  assert.ok(rightVis.startsWith(' '.repeat(8)), 'right home leaves left gap');
  assert.ok(leftVis.endsWith(' '.repeat(8)), 'left home leaves right gap');
});
