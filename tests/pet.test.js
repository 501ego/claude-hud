import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderPetArea, resolvePetMotion, petBlankRow, PET_MIN_AREA, PET_SPRITE_WIDTH } from '../dist/render/pet.js';
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
  const states = ['egg', 'calm', 'working', 'focused', 'thinking', 'cheering', 'waiting', 'bored', 'sleeping', 'eating',
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
  // Align to the alert cycle so alert checks land inside the alert slice.
  const now = Math.floor(Date.now() / 8000) * 8000;

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

  // Fresh transcript mtime with no running tool reads as thinking.
  const thinking = resolvePetStatus(baseInput(), later);
  assert.equal(thinking.state, 'thinking');

  // Idle ladder: waiting (15s-60s) -> calm (60s-2.5min) -> bored (2.5-4min)
  // -> sleeping (4min+).
  const ladder = [
    [30_000, 'waiting'],
    [90_000, 'calm'],
    [3 * 60_000, 'bored'],
    [5 * 60_000, 'sleeping'],
  ];
  for (const [idleMs, expected] of ladder) {
    const aged = new Date(later - idleMs);
    utimesSync(transcriptPath, aged, aged);
    const status = resolvePetStatus(baseInput(), later);
    assert.equal(status.state, expected, `idle ${idleMs}ms should be ${expected}`);
  }
  assert.equal(resolvePetStatus(baseInput(), later).level, 'kitten');
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

test('resolvePetStatus time-slices alerts with live activity, holds them when idle', () => {
  const base = Math.floor(Date.now() / 8000) * 8000;
  // Prime: hatch the pet so the level-up window expires before the asserts.
  resolvePetStatus(baseInput(), base);

  const withTool = (t) => resolvePetStatus(baseInput({
    fiveHourExhaustMin: 20,
    transcript: {
      sessionTokens: { inputTokens: 3_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      tools: [{ id: 't1', name: 'Read', status: 'running', startTime: new Date(t - 1000) }],
    },
  }), t);

  const alertSlice = withTool(base + 8000);
  assert.equal(alertSlice.state, 'burning', 'cycle start belongs to the alert');
  assert.equal(alertSlice.alert, 'burning');

  const activitySlice = withTool(base + 8000 + 3000);
  assert.equal(activitySlice.state, 'working', 'rest of the cycle shows live activity');
  assert.equal(activitySlice.alert, 'burning', 'alert stays exposed during activity');

  // Idle (no tools, aged transcript): burning is suppressed entirely —
  // nothing is being consumed, the forecast is noise.
  const aged = new Date(base - 5 * 60_000);
  utimesSync(transcriptPath, aged, aged);
  const idleBurning = resolvePetStatus(baseInput({ fiveHourExhaustMin: 20 }), base + 16_000);
  assert.equal(idleBurning.state, 'sleeping', 'idle never shows burning');
  assert.equal(idleBurning.alert ?? null, null, 'burning alert cleared while idle');

  // Standing alerts (context/quota facts) still time-share while idle.
  const idleStressed = resolvePetStatus(baseInput({ contextPercent: 90 }), base + 16_000);
  assert.equal(idleStressed.state, 'stressed', 'stressed keeps its idle slice');
  const idleStressedRest = resolvePetStatus(baseInput({ contextPercent: 90 }), base + 16_000 + 3000);
  assert.equal(idleStressedRest.state, 'sleeping', 'rest of the cycle shows the idle state');
});

test('resolvePetStatus treats running agents as live activity', () => {
  const base = Math.floor(Date.now() / 8000) * 8000;
  resolvePetStatus(baseInput(), base); // hatch; let the level-up window expire

  const t = base + 8000;
  const withAgent = (startMs, at) => resolvePetStatus(baseInput({
    transcript: {
      sessionTokens: { inputTokens: 3_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      agents: [{ id: 'a1', type: 'code-graph-worker', status: 'running', startTime: new Date(startMs) }],
    },
  }), at);

  assert.equal(withAgent(t - 1000, t).state, 'cheering', 'running agent = pet cheers it on');
  assert.equal(withAgent(t - 60_000, t).state, 'cheering', 'still cheering while the agent works');
  // An implausibly old "running" agent (orphaned entry) no longer counts.
  assert.notEqual(withAgent(t - 31 * 60_000, t).state, 'cheering');
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

  // '5h almost out!' is long: its own row directly under the sprite —
  // no blank spacer, same closeness as beside-head speech.
  const panic = renderPetArea('panic', 'adult', 0, 26, 'right');
  assert.equal(panic.length, 4);
  assert.ok(!panic[0].replace(ANSI, '').includes('out'), 'long speech must not crowd the head row');
  const below = panic[3].replace(ANSI, '');
  assert.ok(below.includes('5h almost out!'), `speech missing in "${below}"`);
  assert.equal(below.length, 26);
  // Sprite spans cols 14-25 (center 20); the 14-char message should sit
  // visually centered under it, not flushed to the strip's left edge.
  const msgStart = below.indexOf('5h almost out!');
  const msgCenter = msgStart + 7;
  assert.ok(Math.abs(msgCenter - 20) <= 1, `message center ${msgCenter} too far from sprite center`);
});

test('renderPetArea working speech names the running tool category', () => {
  // now=1200 puts the dot animation at its full '...' phase.
  for (const [tool, verb] of [['Read', 'reading...'], ['Edit', 'editing...'], ['Bash', 'running...']]) {
    const rows = renderPetArea('working', 'adult', 1200, 26, 'right', 'claude', tool);
    const text = rows.map((r) => r.replace(ANSI, '')).join('\n');
    assert.ok(text.includes(verb), `${tool} should speak "${verb}" in:\n${text}`);
  }
  // Unknown tools fall back to the generic working speech.
  const generic = renderPetArea('working', 'adult', 1200, 26, 'right', 'claude', 'mcp__foo__bar');
  assert.ok(generic.map((r) => r.replace(ANSI, '')).join('').includes('working...'));
});

test('renderPetArea thinking speech rides beside the head', () => {
  const rows = renderPetArea('thinking', 'adult', 1200, 26, 'right', 'claude');
  assert.equal(rows.length, 3, 'short speech adds no extra rows');
  assert.ok(rows[0].replace(ANSI, '').includes('hmm...'));
});

test('renderPetArea speech ellipsis and zzz animate over ticks at stable width', () => {
  const phases = [0, 600, 1200].map((t) => {
    const rows = renderPetArea('thinking', 'adult', t, 26, 'right', 'claude');
    return rows[0].replace(ANSI, '');
  });
  assert.ok(phases[0].includes('hmm.') && !phases[0].includes('hmm..'), `t=0 one dot: "${phases[0]}"`);
  assert.ok(phases[1].includes('hmm..') && !phases[1].includes('hmm...'), `t=600 two dots: "${phases[1]}"`);
  assert.ok(phases[2].includes('hmm...'), `t=1200 three dots: "${phases[2]}"`);
  for (const p of phases) assert.equal(p.length, 26, 'animation must not shift the layout width');

  const z0 = renderPetArea('sleeping', 'adult', 0, 26, 'right', 'claude')[0].replace(ANSI, '');
  const z2 = renderPetArea('sleeping', 'adult', 1200, 26, 'right', 'claude')[0].replace(ANSI, '');
  assert.ok(z0.includes('z') && !z0.includes('zz'), `zzz grows from one z: "${z0}"`);
  assert.ok(z2.includes('zzz'), `zzz reaches full length: "${z2}"`);

  // The calm hum cycles melody notes inside its visible window (0-2.7s).
  const hum = [0, 600, 1200].map((t) =>
    renderPetArea('calm', 'adult', t, 26, 'right', 'claude')[0].replace(ANSI, ''));
  assert.ok(hum[0].includes('♪') && !hum[0].includes('♫'), `t=0 single note: "${hum[0]}"`);
  assert.ok(hum[1].includes('♫') && !hum[1].includes('♪'), `t=600 other note: "${hum[1]}"`);
  assert.ok(hum[2].includes('♪♫'), `t=1200 double note: "${hum[2]}"`);
});

test('renderPetArea alternates activity and alert speech while an alert is pending', () => {
  // floor(now/3000)%2 — even window shows the activity text, odd the alert.
  const act = renderPetArea('working', 'adult', 1200, 26, 'right', 'claude', 'Read', 'burning');
  const actText = act.map((r) => r.replace(ANSI, '')).join('\n');
  assert.ok(actText.includes('reading...'), `activity window speaks the tool:\n${actText}`);

  const al = renderPetArea('working', 'adult', 3600, 26, 'right', 'claude', 'Read', 'burning');
  const alText = al.map((r) => r.replace(ANSI, '')).join('\n');
  assert.ok(alText.includes('burning fast!'), `alert window speaks the alert:\n${alText}`);
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

test('resolvePetMotion glides toward the target instead of teleporting', () => {
  // sleeping homes at the right edge: offset = span = 26 - 12 = 14.
  const step1 = resolvePetMotion('sleeping', 'adult', 1000, 26, 'right', { offset: 0, mirrored: true, atMs: 0 });
  assert.ok(step1.offset > 0 && step1.offset < 14, `one render moves a few cols, got ${step1.offset}`);
  assert.equal(step1.mirrored, false, 'faces the direction of travel');

  // Successive renders converge on the home edge.
  let cur = step1;
  for (let t = 2000; t <= 20_000 && cur.offset !== 14; t += 1000) {
    cur = resolvePetMotion('sleeping', 'adult', t, 26, 'right', cur);
  }
  assert.equal(cur.offset, 14, 'glide converges on the target');

  // Stale or missing history snaps straight to the target.
  const stale = resolvePetMotion('sleeping', 'adult', 100_000, 26, 'right', { offset: 0, mirrored: false, atMs: 1000 });
  assert.equal(stale.offset, 14);
  const fresh = resolvePetMotion('sleeping', 'adult', 0, 26, 'right', null);
  assert.equal(fresh.offset, 14);
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
