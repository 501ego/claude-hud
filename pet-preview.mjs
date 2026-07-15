#!/usr/bin/env node
// Live animated preview of every pet state, driven by the real render
// engine (dist/render/pet.js — run `npm run build` first).
//
//   node pet-preview.mjs                 grid with all states, animated (cat)
//   node pet-preview.mjs panic           single state, animated
//   node pet-preview.mjs all claude      clawd style grid
//   node pet-preview.mjs panic claude    single clawd state
//
// Ctrl+C to exit. Requires a truecolor terminal.

import { renderPetArea, petBlankRow } from './dist/render/pet.js';

const CELL_WIDTH = 26;
const CELL_ROWS = 5; // 3 sprite rows + spacer + long-speech row
const GAP = '  ';
const TICK_MS = 150;

// Every visible variation: state plus the level that affects its sprite.
const VARIATIONS = [
  { state: 'egg', level: 'egg', label: 'egg (rocks)' },
  { state: 'calm', level: 'kitten', label: 'calm kitten (patrols)' },
  { state: 'calm', level: 'adult', label: 'calm adult (patrols+blink)' },
  { state: 'calm', level: 'legend', label: 'calm legend (crown)' },
  { state: 'thinking', level: 'adult', label: 'thinking (eye scan)' },
  { state: 'cheering', level: 'adult', label: 'cheering (agent running)' },
  { state: 'waiting', level: 'adult', label: 'waiting (foot tap)' },
  { state: 'bored', level: 'adult', label: 'bored (yawns)' },
  { state: 'working', level: 'adult', label: 'working (tail swing)' },
  { state: 'focused', level: 'adult', label: 'focused (tail tip)' },
  { state: 'sleeping', level: 'adult', label: 'sleeping (floating z)' },
  { state: 'eating', level: 'adult', label: 'eating (chews)' },
  { state: 'stressed', level: 'adult', label: 'stressed (ctx >=85%)' },
  { state: 'burning', level: 'adult', label: 'burning (fast usage)' },
  { state: 'panic', level: 'adult', label: 'panic (5h >=90%, red)' },
  { state: 'error', level: 'adult', label: 'error (head shake)' },
  { state: 'dizzy', level: 'adult', label: 'dizzy (spinning eyes)' },
  { state: 'startled', level: 'adult', label: 'startled (jitter)' },
  { state: 'sad', level: 'adult', label: 'sad (tear)' },
  { state: 'sick', level: 'adult', label: 'sick (drop, breathes)' },
  { state: 'levelup', level: 'adult', label: 'levelup (gold sparks)' },
  { state: 'melted', level: 'adult', label: 'melted (puddle)' },
  { state: 'kawaii', level: 'adult', label: 'kawaii (petted, blush)' },
];

const only = process.argv[2] && process.argv[2] !== 'all' ? process.argv[2] : undefined;
const STYLE = process.argv[3] === 'claude' ? 'claude' : 'cat';
const shown = only
  ? VARIATIONS.filter((v) => v.state === only)
  : VARIATIONS;
if (!shown.length) {
  console.error(`unknown state "${only}" — states: ${[...new Set(VARIATIONS.map((v) => v.state))].join(', ')}`);
  process.exit(1);
}

const COLS = only ? 1 : Math.max(1, Math.min(3, Math.floor(((process.stdout.columns ?? 80) + GAP.length) / (CELL_WIDTH + GAP.length))));

function renderCell(v, now) {
  const rows = renderPetArea(v.state, v.level, now, CELL_WIDTH, 'left', STYLE);
  while (rows.length < CELL_ROWS) rows.push(petBlankRow(CELL_WIDTH));
  rows.push(`\x1b[2m${v.label.padEnd(CELL_WIDTH).slice(0, CELL_WIDTH)}\x1b[0m`);
  return rows;
}

let frameLines = 0;
function paint() {
  const now = Date.now();
  const out = [];
  for (let i = 0; i < shown.length; i += COLS) {
    const cells = shown.slice(i, i + COLS).map((v) => renderCell(v, now));
    for (let r = 0; r <= CELL_ROWS; r++) {
      out.push(cells.map((c) => c[r]).join(GAP));
    }
  }
  const up = frameLines ? `\x1b[${frameLines}A` : '';
  process.stdout.write(`${up}\x1b[0J${out.join('\n')}\n`);
  frameLines = out.length;
}

process.stdout.write('\x1b[?25l'); // hide cursor
const restore = () => { process.stdout.write('\x1b[?25h'); process.exit(0); };
process.on('SIGINT', restore);
process.on('SIGTERM', restore);

console.log('\nclaude-hud pet — live preview (Ctrl+C to exit)\n');
paint();
setInterval(paint, TICK_MS);
