/**
 * Pixel-art pet renderer. Sprites are 24x6 px drawn as quadrant blocks
 * (2x2 px per terminal cell, fg+bg truecolor) into a 12x3-cell strip; a
 * cell can hold at most two colors, extra colors are quantized to the two
 * dominant ones. Cat sprites are authored at 12px and scaled 2x; the
 * claude style (Clawd) is authored natively at 24px. Animation is derived
 * from the wall clock per render, tuned for both ~300ms event renders and
 * the 1s statusLine.refreshInterval timer.
 */
import type { PetLevel, PetStateName } from '../state/pet-state.js';

export const PET_SPRITE_WIDTH = 12;
export const PET_MIN_AREA = PET_SPRITE_WIDTH + 1;

const FRAME_MS = 900;
const WALK_STEP_MS = 700;

type Rgb = [number, number, number];

const PALETTE: Record<string, Rgb> = {
  K: [94, 102, 122],  // outline blue slate
  B: [138, 148, 170], // body blue-gray
  F: [184, 193, 214], // face plate light blue-gray
  I: [152, 160, 182], // inner ear
  E: [108, 150, 228], // blue eyes (light)
  W: [255, 255, 255], // eye highlight
  M: [84, 90, 110],   // mouth
  A: [240, 180, 80],  // amber — alert speech accent only (coat stays normal)
  H: [242, 125, 60],  // hot orange — alert speech accent only
  R: [240, 112, 144], // red (panic outline)
  r: [250, 150, 170], // red-ish body (panic)
  C: [130, 205, 245], // cyan (sweat / tear)
  G: [255, 205, 95],  // gold (crown, sparkle, gem)
  Z: [88, 88, 94],    // gray dark (melted)
  z: [190, 190, 190], // gray light (whisker, zzz)
  V: [138, 148, 170], // sick body = normal coat (message carries the alert)
  v: [184, 193, 214], // sick face = normal coat
  O: [240, 236, 228], // eggshell
  P: [244, 168, 188], // pink blush (kawaii)
  o: [217, 119, 87],  // terracotta body (#D97757)
  e: [20, 18, 16],    // eye gaps (near-black, like the CLI logo)
  m: [130, 62, 44],   // mouth / closed eyes (dark rust)
};

type SpriteKey = PetStateName | 'kitten' | 'legend';

const SPRITES: Record<SpriteKey, string[]> = {
  egg: [
    '............',
    '....KKKK....',
    '...KOOOOK...',
    '..KOOEOOOK..',
    '..KOOOEOOK..',
    '...KOOOOK...',
  ],
  kitten: [
    '...K....K...',
    '..KIK..KIK..',
    '..KBFFFFBK..',
    '..KEWFFEWK..',
    '..KEEFFEEK..',
    '...KFMMFK...',
  ],
  calm: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFEWFFEWFKK',
    '.KFEEFFEEFKK',
    '..KFFMMFFK..',
  ],
  working: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBK.',
    'zKFFEWFFEWKK',
    '.KFFEEFFEEKK',
    '..KFFMMFFK..',
  ],
  focused: [
    '............',
    '.KK......KK.',
    '.KBFFFFFFBK.',
    'zKFFFFFFFFKK',
    '.KFEEFFEEFKK',
    '..KFFMMFFK..',
  ],
  thinking: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBK.',
    'zKEWFFEWFFKK',
    '.KEEFFEEFFKK',
    '..KFFMMFFK..',
  ],
  cheering: [
    'G.K......K.G',
    '.KIK....KIK.',
    '.KBFFFFFFBK.',
    'zKFEWFFEWFKK',
    '.KFEEFFEEFKK',
    '..KFFMMFFK..',
  ],
  waiting: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBK.',
    'zKFEWFFEWFKK',
    '.KFEEFFEEFKK',
    '..KFFMMFFK..',
  ],
  bored: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBK.',
    'zKFEEFFEEFKK',
    '.KFEEFFEEFKK',
    '..KFFMMFFK..',
  ],
  sleeping: [
    '............',
    '.KK......KKz',
    '.KBFFFFFFBK.',
    'zKFFFFFFFFK.',
    '.KFEEFFEEFK.',
    '..KFFFFFFK..',
  ],
  eating: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFEEFFEEFKK',
    '.KFFFMMFFFKK',
    '..KFFMMFFK..',
  ],
  stressed: [
    '..K......K..',
    '.KIK....KIKC',
    '.KBFFFFFFBK.',
    'zKFEEFFEEFKC',
    '.KFEEFFEEFKK',
    '..KFFMMFFK..',
  ],
  burning: [
    '..K.R....K..',
    '.KIK....KIKC',
    '.KBFFFFFFBK.',
    'zKFEEFFEEFKC',
    '.KFEEFFEEFKK',
    '..KFFMMFFK..',
  ],
  panic: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFWWFFWWFKK',
    '.KFWWFFWWFKK',
    '..KFFMMFFK..',
  ],
  error: [
    '............',
    '.KK......KK.',
    '.KBFFFFFFBKK',
    'zKFMMFFMMFKK',
    '.KFFFMMFFFK.',
    '..KFFMMFFK..',
  ],
  dizzy: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBK.',
    'zKFEWFFEWFK.',
    '.KFWEFFWEFKK',
    '..KFMFFMFK..',
  ],
  melted: [
    '............',
    '............',
    '.....B......',
    '..K......K..',
    '.KBBBBBBBBK.',
    'KBBEEBBEEBBK',
  ],
  startled: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFEEFFEEFKK',
    '.KFFFMMFFFKK',
    '..KFFMMFFK..',
  ],
  sad: [
    '............',
    '.KK......KK.',
    '.KBFFFFFFBK.',
    'zKFEWFFEWFK.',
    'CKFFFMMFFFK.',
    '..KFMFFMFK..',
  ],
  sick: [
    '............',
    '.KK......KK.',
    '.KVvvvvvvVK.',
    'zKvFFvvEWvKV',
    '.KvEEvvEEvK.',
    '..KvFMMFvK..',
  ],
  levelup: [
    '..K......K..',
    'GKIK....KIKK',
    '.KBFFFFFFBKK',
    'zKFWWFFWWFKG',
    '.KFWWFFWWFK.',
    '..KFFMMFFK..',
  ],
  legend: [
    '..K..GG..K..',
    '.KIK.GG.KIK.',
    '.KBFFFFFFBKK',
    'zKFGWFFGWFKK',
    '.KFGGFFGGFKK',
    '..KFFMMFFK..',
  ],
  kawaii: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFEEFFEEFKK',
    '.KPFFMMFFPKK',
    '..KFFMMFFK..',
  ],
};

const ALT_FRAMES: Partial<Record<SpriteKey, string[]>> = {
  calm: [
    '..K......K..',
    '.KIK....KIKK',
    '.KBFFFFFFBKK',
    'zKFEWFFEWFKK',
    '.KFEEFFEEFK.',
    '..KFFMMFFK..',
  ],
  kitten: [
    '...K....K...',
    '..KIK..KIK..',
    '..KBFFFFBK..',
    '..KEWFFEWK..',
    '..KEEFFEEK..',
    '..KFFMMFFK..',
  ],
  kawaii: [
    '..K......K.R',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFEEFFEEFKK',
    '.KPFFMMFFPKK',
    '..KFFMMFFK..',
  ],
  legend: [
    'G.K..GG..K..',
    '.KIK.GG.KIKK',
    '.KBFFFFFFBKK',
    'zKFGWFFGWFKK',
    '.KFGGFFGGFK.',
    '..KFFMMFFK..',
  ],
  working: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFFEWFFEWKK',
    '.KFFEEFFEEK.',
    '..KFFMMFFK..',
  ],
  focused: [
    '............',
    '.KK......KK.',
    '.KBFFFFFFBKK',
    'zKFFFFFFFFKK',
    '.KFEEFFEEFK.',
    '..KFFMMFFK..',
  ],
  thinking: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFFEWFFEWKK',
    '.KFFEEFFEEK.',
    '..KFFMMFFK..',
  ],
  cheering: [
    '..K..GG..K..',
    'GKIK....KIKG',
    '.KBFFFFFFBKK',
    'zKFWWFFWWFKK',
    '.KFEEFFEEFK.',
    '..KFFMMFFK..',
  ],
  waiting: [
    '..K......K..',
    '.KIK....KIKK',
    '.KBFFFFFFBK.',
    'zKFEWFFEWFKK',
    '.KFEEFFEEFK.',
    '..KFFMMFFK..',
  ],
  bored: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFMMFFMMFKK',
    '.KFFMMMMFFK.',
    '..KFFMMFFK..',
  ],
  sleeping: [
    '...........z',
    '.KK......KK.',
    '.KBFFFFFFBK.',
    'zKFFFFFFFFK.',
    '.KFEEFFEEFK.',
    '..KFFFFFFK..',
  ],
  eating: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFEEFFEEFKK',
    '.KFFFFFFFFKK',
    '..KFFMMFFK..',
  ],
  stressed: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKC',
    'zKFEEFFEEFKK',
    '.KFEEFFEEFKC',
    '..KFMMMMFK..',
  ],
  burning: [
    '..K....R.K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKC',
    'zKFEEFFEEFKK',
    '.KFEEFFEEFKC',
    '..KFFMMFFK..',
  ],
  dizzy: [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBK.',
    'zKFWEFFWEFK.',
    '.KFEWFFEWFKK',
    '..KFMFFMFK..',
  ],
  sad: [
    '............',
    '.KK......KK.',
    '.KBFFFFFFBK.',
    'zKFEWFFEWFK.',
    '.KFFFMMFFFK.',
    'C.KFMFFMFK..',
  ],
  melted: [
    '............',
    '............',
    '............',
    '..K..B...K.B',
    '.KBBBBBBBBK.',
    'KBBEEBBEEBBK',
  ],
  egg: [
    '............',
    '.....KKKK...',
    '....KOOOOK..',
    '...KOOEOOOK.',
    '...KOOOEOOK.',
    '....KOOOOK..',
  ],
  panic: [
    '..K......K..',
    '.KIK.KK.KIK.',
    '.KBFFFFFFBKK',
    'zKFWWFFWWFKK',
    '.KFWWFFWWFK.',
    '..KFMMMMFK..',
  ],
  startled: [
    '..K......K..',
    '.KIK.KK.KIK.',
    '.KBFFFFFFBKK',
    'zKFEEFFEEFKK',
    '.KFFFMMFFFK.',
    '..KFFMMFFK..',
  ],
  sick: [
    '............',
    '.KK......KK.',
    '.KVvvvvvvVK.',
    'zKvFFvvEWvK.',
    '.KvEEvvEEvKV',
    '..KvFMMFvK..',
  ],
  levelup: [
    '..K......K.G',
    '.KIK....KIKK',
    'GKBFFFFFFBKK',
    'zKFWWFFWWFKK',
    '.KFWWFFWWFKG',
    '..KFFMMFFK..',
  ],
};

ALT_FRAMES.error = SPRITES.error.map((row) => [...row].reverse().join(''));

const CALM_BLINK: string[] = [
  '..K......K..',
  '.KIK....KIK.',
  '.KBFFFFFFBKK',
  'zKFFFFFFFFKK',
  '.KFEEFFEEFKK',
  '..KFFMMFFK..',
];

const CLAUDE_SPRITES: Record<SpriteKey, string[]> = {
  egg: [
    '........................',
    '..........oooo..........',
    '.........oooooo.........',
    '.........oeooeo.........',
    '.........oooooo.........',
    '........................',
  ],
  kitten: [
    '........................',
    '........oooooooo........',
    '........oeooooeo........',
    '......oooooooooooo......',
    '........oooooooo........',
    '.........o....o.........',
  ],
  calm: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  legend: [
    '......ooooGGGGoooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  working: [
    '......oooooooooooo......',
    '......oooeooooooeo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  focused: [
    '......oooooooooooo......',
    '......oomoooooomoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  thinking: [
    '......oooooooooooo......',
    '......oeooooooeooo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  cheering: [
    '..G...oooooooooooo...G..',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  waiting: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  bored: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooommoooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  sleeping: [
    '......oooooooooooo....z.',
    '......oomoooooomoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  eating: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooommmmoooooo....',
    '......oooommmmoooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  stressed: [
    '......oooooooooooo....C.',
    '......ooeooooooeoo......',
    '....oooooooooooooooo..C.',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  burning: [
    '...R..oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo..C.',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  panic: [
    '......oooooooooooo......',
    '......ooWooooooWoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  error: [
    '......oooooooooooo......',
    '......ooeoooooomoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  dizzy: [
    '......oooooooooooo......',
    '......ooWooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  melted: [
    '........................',
    '........................',
    '........................',
    '........................',
    '......oooooooooooo......',
    '....ooooeoooooooeooo....',
  ],
  startled: [
    '......oooooooooooo......',
    '......ooWooooooWoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  sad: [
    '......oooooooooooo......',
    '......oooooooooooo......',
    '....ooooeooooooeooooC...',
    '......oooommmmoooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  sick: [
    '......oooooooooooo......',
    '......ommoooooommo......',
    '....oooooooooooooooo....',
    '......oooooooooooo..C...',
    '.......o.o....o.o.......',
    '........................',
  ],
  levelup: [
    'G.....oooooooooooo.....G',
    '......ooWooooooWoo......',
    '..G.oooooooooooooooo.G..',
    '......oooommmmoooo......',
    '.G.....o.o....o.o.....G.',
    '........................',
  ],
  kawaii: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....ooPPooooooooPPoo....',
    '......oooommmmoooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
};

const CLAUDE_ALTS: Partial<Record<SpriteKey, string[]>> = {
  egg: [
    '........................',
    '...........oooo.........',
    '..........oooooo........',
    '..........oeooeo........',
    '..........oooooo........',
    '........................',
  ],
  kitten: [
    '........................',
    '........oooooooo........',
    '........oeooooeo........',
    '......oooooooooooo......',
    '........oooooooo........',
    '..........o..o..........',
  ],
  calm: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '......o.o......o.o......',
    '........................',
  ],
  legend: [
    '......ooooGGGGoooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '......o.o......o.o......',
    '........................',
  ],
  working: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  focused: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  thinking: [
    '......oooooooooooo......',
    '......oooeooooooeo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  cheering: [
    '........................',
    '..G...oooooooooooo...G..',
    '......ooWooooooWoo......',
    '....oooooooooooooooo....',
    '......o.o......o.o......',
    '........................',
  ],
  waiting: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '......o.o......o.o......',
    '........................',
  ],
  bored: [
    '......oooooooooooo......',
    '......oomoooooomoo......',
    '....oooooommmmoooooo....',
    '......oooommmmoooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  sleeping: [
    '......oooooooooooo..z...',
    '......oomoooooomoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  eating: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooommmmoooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  stressed: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo..C.',
    '......oooommoooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  burning: [
    '......oooooooooooo..R...',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo...C..',
    '.......o.o....o.o.......',
    '........................',
  ],
  panic: [
    '......oooooooooooo......',
    '......ooWooooooWoo......',
    '....oooooWWWWooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  dizzy: [
    '......oooooooooooo......',
    '......ooeooooooWoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  startled: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  sad: [
    '......oooooooooooo......',
    '......oooooooooooo......',
    '....ooooeooooooeoooo....',
    '......oooommmmoooo..C...',
    '.......o.o....o.o.......',
    '........................',
  ],
  sick: [
    '......oooooooooooo......',
    '......ommoooooommo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o...C...',
    '........................',
  ],
  levelup: [
    '.G....oooooooooooo....G.',
    '......ooWooooooWoo......',
    '.G..oooooooooooooooo..G.',
    '......oooommmmoooo......',
    'G......o.o....o.o......G',
    '........................',
  ],
  kawaii: [
    '......oooooooooooo......',
    '......ooeooooooeoo......',
    '....ooPPooooooooPPoo....',
    '......ooommmmmmooo......',
    '.......o.o....o.o.......',
    '........................',
  ],
  melted: [
    '........................',
    '........................',
    '.........o..............',
    '........................',
    '......oooooooooooo......',
    '....ooooeoooooooeooo....',
  ],
};
CLAUDE_ALTS.error = CLAUDE_SPRITES.error.map((row) => [...row].reverse().join(''));

const CLAUDE_BLINK: string[] = [
  '......oooooooooooo......',
  '......oomoooooomoo......',
  '....oooooooooooooooo....',
  '......oooooooooooo......',
  '.......o.o....o.o.......',
  '........................',
];

export type PetStyleName = 'cat' | 'claude';

const scale2 = (map: string[]): string[] => map.map((row) => [...row].map((c) => c + c).join(''));
const scaleSet = (set: Partial<Record<SpriteKey, string[]>>): Partial<Record<SpriteKey, string[]>> =>
  Object.fromEntries(Object.entries(set).map(([k, m]) => [k, scale2(m as string[])]));

interface StyleSet {
  sprites: Record<SpriteKey, string[]>;
  alts: Partial<Record<SpriteKey, string[]>>;
  blink: string[];
}

const CAT_HD: Partial<Record<SpriteKey, string[]>> = {
  kawaii: [
    '....KK............KK....',
    '..KKIIKK........KKIIKK..',
    '..KKBBFFFFFFFFFFFFBBKKKK',
    'zzKKFFEFFFFFFFFFFEFFKKKK',
    '..KKPPFEFFFFFFFFEFPPKKKK',
    '....KKFFMMMMMMMMFFKK....',
  ],
};
const CAT_HD_ALTS: Partial<Record<SpriteKey, string[]>> = {
  kawaii: [
    '....KK............KK..R.',
    '..KKIIKK........KKIIKK..',
    '..KKBBFFFFFFFFFFFFBBKKKK',
    'zzKKFFEFFFFFFFFFFEFFKKKK',
    '..KKPPFEFFFFFFFFEFPPKKKK',
    '....KKFFMMMMMMMMFFKK....',
  ],
};

const STYLES: Record<PetStyleName, StyleSet> = {
  cat: {
    sprites: { ...scaleSet(SPRITES), ...CAT_HD } as Record<SpriteKey, string[]>,
    alts: { ...scaleSet(ALT_FRAMES), ...CAT_HD_ALTS },
    blink: scale2(CALM_BLINK),
  },
  claude: {
    sprites: CLAUDE_SPRITES,
    alts: CLAUDE_ALTS,
    blink: CLAUDE_BLINK,
  },
};

const RESET = '\x1b[0m';
const fgAnsi = ([r, g, b]: Rgb): string => `\x1b[38;2;${r};${g};${b}m`;
const bgAnsi = ([r, g, b]: Rgb): string => `\x1b[48;2;${r};${g};${b}m`;

const WALKING = new Set<PetStateName>(['calm', 'thinking']);
const JITTER = new Set<PetStateName>(['panic', 'startled', 'burning']);

const SPEECH: Partial<Record<PetStateName, string>> = {
  egg: '...',
  calm: '♪',
  thinking: 'hmm...',
  working: 'working...',
  focused: 'focused...',
  cheering: 'go go!',
  bored: 'meh...',
  sleeping: 'zzz',
  eating: 'yum!',
  stressed: 'context full!',
  burning: 'burning fast!',
  panic: '5h almost out!',
  error: 'oops!',
  dizzy: 'so dizzy...',
  melted: 'quota out...',
  startled: 'compacted?!',
  sad: 'missed you..',
  sick: 'feeling sick',
  levelup: 'LEVEL UP!',
  kawaii: 'purr~',
};

const SPEECH_COLOR: Partial<Record<PetStateName, Rgb>> = {
  panic: PALETTE.R,
  melted: PALETTE.R,
  stressed: PALETTE.A,
  burning: PALETTE.H,
  levelup: PALETTE.G,
  cheering: PALETTE.G,
  kawaii: PALETTE.P,
};
const SPEECH_MUTED: Rgb = [150, 155, 168];
const SPEECH_BESIDE_MAX = 6;

const TOOL_SPEECH: Array<[RegExp, string]> = [
  [/^(Read|Grep|Glob|NotebookRead)$/, 'reading...'],
  [/^(Edit|Write|MultiEdit|NotebookEdit)$/, 'editing...'],
  [/^(Bash|PowerShell)$/, 'running...'],
  [/^(WebFetch|WebSearch)$/, 'browsing...'],
  [/^(Task|Agent)$/, 'delegating...'],
  [/^TodoWrite$/, 'planning...'],
];

const SPEECH_TICK_MS = 600;
const HUM_FRAMES = ['♪ ', '♫ ', '♪♫'];

/**
 * Liven up ongoing-action speech: trailing '...' and 'zzz' grow one glyph
 * per tick, and the calm hum cycles melody notes — everything space-padded
 * to a constant length so the layout never shifts.
 */
function animateSpeech(text: string, now: number): string {
  const n = 1 + (Math.floor(now / SPEECH_TICK_MS) % 3);
  if (text.endsWith('...')) {
    return `${text.slice(0, -3)}${'.'.repeat(n)}${' '.repeat(3 - n)}`;
  }
  if (text === 'zzz') {
    return `${'z'.repeat(n)}${' '.repeat(3 - n)}`;
  }
  if (text === '♪') {
    return HUM_FRAMES[Math.floor(now / SPEECH_TICK_MS) % HUM_FRAMES.length];
  }
  return text;
}

function speechFor(state: PetStateName, now: number, runningTool?: string | null): string | null {
  if ((state === 'working' || state === 'focused') && runningTool) {
    for (const [re, text] of TOOL_SPEECH) {
      if (re.test(runningTool)) return animateSpeech(text, now);
    }
  }
  const text = SPEECH[state];
  if (!text) return null;
  // Calm hums: silent stroll most of the time, a brief note now and then.
  if (state === 'calm' && Math.floor(now / 2700) % 3 !== 0) return null;
  return animateSpeech(text, now);
}

function resolveSpriteKey(state: PetStateName, level: PetLevel): SpriteKey {
  if (state === 'calm') {
    if (level === 'kitten') return 'kitten';
    if (level === 'legend') return 'legend';
  }
  return state;
}

function isBlinkFrame(now: number): boolean {
  return Math.floor(now / FRAME_MS) % 7 === 0;
}

function pickFrame(key: SpriteKey, state: PetStateName, now: number, style: StyleSet): string[] {
  if (state === 'calm' && key === 'calm' && isBlinkFrame(now)) {
    return style.blink;
  }
  const alt = style.alts[key];
  if (alt && Math.floor(now / FRAME_MS) % 2 === 1) {
    return alt;
  }
  return style.sprites[key] ?? style.sprites.calm;
}

function mirrorMap(map: string[]): string[] {
  return map.map((row) => [...row].reverse().join(''));
}

const QUAD = [' ', '▗', '▖', '▄', '▝', '▐', '▞', '▟', '▘', '▚', '▌', '▙', '▀', '▜', '▛', '█'];

const dist2 = (a: Rgb, b: Rgb): number =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function renderCell(px: Array<string | undefined>): string {
  const counts = new Map<string, number>();
  for (const c of px) {
    if (c && c !== '.' && PALETTE[c]) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let colors = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c);
  if (colors.length === 0) return ' ';
  const transparent = px.some((c) => !c || c === '.' || !PALETTE[c]);
  if (transparent && colors.length > 1) colors = [colors[0]];
  if (colors.length > 2) colors = colors.slice(0, 2);
  const snap = (c: string | undefined): string | null => {
    if (!c || c === '.' || !PALETTE[c]) return null;
    if (colors.includes(c)) return c;
    return colors.reduce((best, k) =>
      (dist2(PALETTE[c], PALETTE[k]) < dist2(PALETTE[c], PALETTE[best]) ? k : best), colors[0]);
  };
  let mask = 0;
  px.forEach((c, i) => {
    if (snap(c) === colors[0]) mask |= (8 >> i);
  });
  if (colors.length === 1) return `${fgAnsi(PALETTE[colors[0]])}${QUAD[mask]}${RESET}`;
  return `${fgAnsi(PALETTE[colors[0]])}${bgAnsi(PALETTE[colors[1]])}${QUAD[mask]}${RESET}`;
}

function renderSpriteCells(map: string[]): string[] {
  const rows: string[] = [];
  for (let row = 0; row < map.length; row += 2) {
    const top = map[row] ?? '';
    const bottom = map[row + 1] ?? '';
    let line = '';
    for (let col = 0; col < PET_SPRITE_WIDTH * 2; col += 2) {
      line += renderCell([top[col], top[col + 1], bottom[col], bottom[col + 1]]);
    }
    rows.push(line);
  }
  return rows;
}

/**
 * Sprite offset (columns from the area's left edge) for the current moment.
 * Walking states bounce across the free span (triangle wave); the rest sit
 * at the home edge (the side the area is anchored to).
 */
function resolveOffset(
  state: PetStateName,
  level: PetLevel,
  now: number,
  span: number,
  align: 'left' | 'right',
): { offset: number; mirrored: boolean } {
  const home = align === 'right' ? span : 0;

  if (span > 0 && level !== 'egg' && WALKING.has(state)) {
    const cycle = span * 2;
    const phase = Math.floor(now / WALK_STEP_MS) % cycle;
    const pos = phase < span ? phase : cycle - phase;
    const movingUp = phase < span;
    const offset = align === 'right' ? span - pos : pos;
    const movingAwayFromHome = movingUp;
    const mirrored = align === 'right' ? movingAwayFromHome : !movingAwayFromHome;
    return { offset, mirrored };
  }

  if (JITTER.has(state) && span > 0 && Math.floor(now / 300) % 2 === 1) {
    return { offset: align === 'right' ? home - 1 : home + 1, mirrored: false };
  }

  return { offset: home, mirrored: false };
}

const GLIDE_STEP_MS = 350;
const GLIDE_RESET_MS = 30_000;

export interface PetMotion {
  offset: number;
  mirrored: boolean;
  atMs: number;
}

/**
 * Smooth motion between renders: instead of teleporting to the state's
 * target offset, glide toward it at most one column per GLIDE_STEP_MS of
 * elapsed time, facing the direction of travel. `prev` is the persisted
 * position from the previous render; stale/missing history snaps to target.
 */
export function resolvePetMotion(
  state: PetStateName,
  level: PetLevel,
  now: number,
  areaWidth: number,
  align: 'left' | 'right' = 'right',
  prev?: PetMotion | null,
): PetMotion {
  const width = Math.max(PET_MIN_AREA, areaWidth);
  const span = width - PET_SPRITE_WIDTH;
  const target = resolveOffset(state, level, now, span, align);
  if (!prev || prev.atMs >= now || now - prev.atMs > GLIDE_RESET_MS) {
    return { ...target, atMs: now };
  }
  const from = Math.max(0, Math.min(span, prev.offset));
  const delta = target.offset - from;
  if (delta === 0) return { ...target, atMs: now };
  const maxStep = Math.max(1, Math.round((now - prev.atMs) / GLIDE_STEP_MS));
  const step = Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
  const offset = from + step;
  if (offset === target.offset) return { ...target, atMs: now };
  // Mid-glide: face the way we're moving (patrol convention — moving away
  // from the home edge shows the mirrored sprite).
  const movingAway = align === 'right' ? step < 0 : step > 0;
  return { offset, mirrored: movingAway, atMs: now };
}

/**
 * Render the pet inside an `areaWidth`-wide strip (>= PET_MIN_AREA).
 * Returns 3 sprite rows — plus a speech row directly below the sprite when
 * the current message is too long to sit beside the head. Every row is
 * exactly `areaWidth` visible columns.
 */
export function renderPetArea(
  state: PetStateName,
  level: PetLevel,
  now: number,
  areaWidth: number,
  align: 'left' | 'right' = 'right',
  styleName: PetStyleName = 'cat',
  runningTool?: string | null,
  alert?: PetStateName | null,
  motion?: PetMotion | null,
): string[] {
  const style = STYLES[styleName] ?? STYLES.cat;
  const width = Math.max(PET_MIN_AREA, areaWidth);
  const span = width - PET_SPRITE_WIDTH;
  const key = resolveSpriteKey(state, level);
  let map = pickFrame(key, state, now, style);

  const { offset, mirrored } = motion ?? resolveOffset(state, level, now, span, align);
  if (mirrored) {
    map = mirrorMap(map);
  }

  const leftPad = Math.min(span, Math.max(0, offset));
  const rightPad = width - PET_SPRITE_WIDTH - leftPad;
  const cells = renderSpriteCells(map);
  const rows = cells.map((row) => `${' '.repeat(leftPad)}${row}${' '.repeat(rightPad)}`);

  // During an activity slice with an alert pending, the speech line keeps
  // the alert visible by alternating activity text <-> alert text every 3s.
  let speechState = state;
  let speech = speechFor(state, now, runningTool);
  if (alert && alert !== state && SPEECH[alert] && Math.floor(now / 3000) % 2 === 1) {
    speechState = alert;
    speech = animateSpeech(SPEECH[alert]!, now);
  }
  if (speech) {
    const speechColor = SPEECH_COLOR[speechState] ?? SPEECH_MUTED;
    const colored = `${fgAnsi(speechColor)}${speech}${RESET}`;
    const need = speech.length + 1;
    const short = speech.length <= SPEECH_BESIDE_MAX;
    // Blank sprite cells render as plain spaces at the edges of the row;
    // measure them so speech hugs the visible head, not the cell strip.
    const headLeft = (cells[0].match(/^ */) ?? [''])[0].length;
    const headRight = (cells[0].match(/ *$/) ?? [''])[0].length;
    if (short && leftPad + headLeft >= need) {
      // Animation pads speech with trailing spaces; on this side they'd sit
      // between the text and the head, so move them out to the left.
      const trimmed = speech.trimEnd();
      const pad = speech.length - trimmed.length;
      const coloredTrim = `${fgAnsi(speechColor)}${trimmed}${RESET}`;
      rows[0] = `${' '.repeat(leftPad - need + pad + headLeft)}${coloredTrim} ${cells[0].slice(headLeft)}${' '.repeat(rightPad)}`;
    } else if (short && rightPad + headRight >= need) {
      const cut = headRight > 0 ? cells[0].slice(0, -headRight) : cells[0];
      rows[0] = `${' '.repeat(leftPad)}${cut} ${colored}${' '.repeat(rightPad - need + headRight)}`;
    } else if (speech.length <= width) {
      const center = leftPad + Math.floor(PET_SPRITE_WIDTH / 2);
      const start = Math.max(0, Math.min(width - speech.length, center - Math.floor(speech.length / 2)));
      rows.push(`${' '.repeat(start)}${colored}${' '.repeat(width - speech.length - start)}`);
    }
  }
  return rows;
}

export function petBlankRow(areaWidth: number): string {
  return ' '.repeat(Math.max(PET_MIN_AREA, areaWidth));
}
