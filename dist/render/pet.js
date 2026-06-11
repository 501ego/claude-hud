export const PET_SPRITE_WIDTH = 12;
export const PET_MIN_AREA = PET_SPRITE_WIDTH + 1;
const FRAME_MS = 900;
const WALK_STEP_MS = 700;
const PALETTE = {
    K: [94, 102, 122], // outline blue slate
    B: [138, 148, 170], // body blue-gray
    F: [184, 193, 214], // face plate light blue-gray
    I: [152, 160, 182], // inner ear
    E: [108, 150, 228], // blue eyes (light)
    W: [255, 255, 255], // eye highlight
    M: [84, 90, 110], // mouth
    A: [138, 148, 170], // stressed body = normal coat (message carries the alert)
    a: [184, 193, 214], // stressed face = normal coat
    R: [240, 112, 144], // red (panic outline)
    r: [250, 150, 170], // red-ish body (panic)
    C: [130, 205, 245], // cyan (sweat / tear)
    G: [255, 205, 95], // gold (crown, sparkle, gem)
    Z: [88, 88, 94], // gray dark (melted)
    z: [190, 190, 190], // gray light (whisker, zzz)
    V: [138, 148, 170], // sick body = normal coat (message carries the alert)
    v: [184, 193, 214], // sick face = normal coat
    O: [240, 236, 228], // eggshell
    P: [244, 168, 188], // pink blush (kawaii)
    o: [217, 119, 87], // terracotta body (#D97757)
    e: [20, 18, 16], // eye gaps (near-black, like the CLI logo)
    m: [130, 62, 44], // mouth / closed eyes (dark rust)
};
const SPRITES = {
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
        'zKFEFFFFEFKK',
        '.KFEFFFFEFKK',
        '..KFFMMFFK..',
    ],
    curious: [
        '..K.......K.',
        '.KIK....KIK.',
        '.KBFFFFFFBK.',
        'zKFEWFFEWFKK',
        '.KFWEFFWEFKK',
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
        '.KAaaaaaaAK.',
        'zKaEEaaEEaKK',
        '.KaEEaaEEaKK',
        '..KaaMMaaK..',
    ],
    burning: [
        '..K......K..',
        '.KIK....KIKC',
        '.KAaaaaaaAK.',
        'zKaEEaaEEaKC',
        '.KaEEaaEEaKK',
        '..KaaMMaaK..',
    ],
    panic: [
        '..R......R..',
        '.RIR....RIR.',
        '.RrrrrrrrrRR',
        'zRrWWrrWWrRR',
        '.RrWWrrWWrRR',
        '..RrrMMrrR..',
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
        '............',
        '..Z......Z..',
        '.ZzzzzzzzzZ.',
        'ZzzEEzzEEzzZ',
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
const ALT_FRAMES = {
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
        'zKFEFFFFEFKK',
        '.KFEFFFFEFK.',
        '..KFFMMFFK..',
    ],
    curious: [
        '..K......K..',
        '.KIK....KIK.',
        '.KBFFFFFFBK.',
        'zKFEWFFEWFKK',
        '.KFWEFFWEFKK',
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
        '.KAaaaaaaAKC',
        'zKaEEaaEEaKK',
        '.KaEEaaEEaKK',
        '..KaaMMaaK..',
    ],
    burning: [
        '..K......K..',
        '.KIK....KIK.',
        '.KAaaaaaaAKC',
        'zKaEEaaEEaKK',
        '.KaEEaaEEaKC',
        '..KaaMMaaK..',
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
        '..Z......Z.z',
        '.ZzzzzzzzzZ.',
        'ZzzzEzzzEzzZ',
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
        '..R......R..',
        '.RIR.RR.RIR.',
        '.RrrrrrrrrRR',
        'zRrWWrrWWrRR',
        '.RrWWrrWWrR.',
        '..RrrMMrrR..',
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
const CALM_BLINK = [
    '..K......K..',
    '.KIK....KIK.',
    '.KBFFFFFFBKK',
    'zKFFFFFFFFKK',
    '.KFEEFFEEFKK',
    '..KFFMMFFK..',
];
const CLAUDE_SPRITES = {
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
        '......ommoooooommo......',
        '....oooooooooooooooo....',
        '......oooooooooooo......',
        '.......o.o....o.o.......',
        '........................',
    ],
    curious: [
        '......ooeooooooooo......',
        '......oooooooooeoo......',
        '....oooooooooooooooo....',
        '......oooooooooooo......',
        '.......o.o....o.o.......',
        '........................',
    ],
    sleeping: [
        '......oooooooooooo....z.',
        '......ommoooooommo......',
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
        '....oooooooooooooooo....',
        '......oooooooooooo......',
        '.......o.o....o.o.......',
        '........................',
    ],
    burning: [
        '......oooooooooooo....C.',
        '......ooeooooooeoo......',
        '....oooooooooooooooo..C.',
        '......oooooooooooo......',
        '.......o.o....o.o.......',
        '........................',
    ],
    panic: [
        '......RRRRRRRRRRRR......',
        '......RWWRRRRRRWWR......',
        '....RRRRRRRRRRRRRRRR....',
        '......RRRRRRRRRRRR......',
        '.......R.R....R.R.......',
        '........................',
    ],
    error: [
        '......oooooooooooo......',
        '......ooeooooommmo......',
        '....oooooooooooooooo....',
        '......oooooooooooo......',
        '.......o.o....o.o.......',
        '........................',
    ],
    dizzy: [
        '......oooooooooooo......',
        '......oWeooooooeWo......',
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
        '......ooWWooooWWoo......',
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
        '......oWWooooooWWo......',
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
const CLAUDE_ALTS = {
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
    curious: [
        '......oooooooooeoo......',
        '......ooeooooooooo......',
        '....oooooooooooooooo....',
        '......oooooooooooo......',
        '.......o.o....o.o.......',
        '........................',
    ],
    sleeping: [
        '......oooooooooooo..z...',
        '......ommoooooommo......',
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
        '......oooooooooooo......',
        '.......o.o....o.o.......',
        '........................',
    ],
    burning: [
        '......oooooooooooo..C...',
        '......ooeooooooeoo......',
        '....oooooooooooooooo..C.',
        '......oooooooooooo......',
        '.......o.o....o.o.......',
        '........................',
    ],
    panic: [
        '......RRRRRRRRRRRR......',
        '......RRRRRRRRRRRR......',
        '....RRRRRRRRRRRRRRRR....',
        '......RRRRRRRRRRRR......',
        '.......R.R....R.R.......',
        '........................',
    ],
    dizzy: [
        '......oooooooooooo......',
        '......oeWoooooWeoo......',
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
        '......oWWooooooWWo......',
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
        '........................',
        '..................W.....',
        '......oooooooooooo......',
        '....ooooeoooooooeooo....',
    ],
};
CLAUDE_ALTS.error = CLAUDE_SPRITES.error.map((row) => [...row].reverse().join(''));
const CLAUDE_BLINK = [
    '......oooooooooooo......',
    '......oomoooooomoo......',
    '....oooooooooooooooo....',
    '......oooooooooooo......',
    '.......o.o....o.o.......',
    '........................',
];
const scale2 = (map) => map.map((row) => [...row].map((c) => c + c).join(''));
const scaleSet = (set) => Object.fromEntries(Object.entries(set).map(([k, m]) => [k, scale2(m)]));
const CAT_HD = {
    kawaii: [
        '....KK............KK....',
        '..KKIIKK........KKIIKK..',
        '..KKBBFFFFFFFFFFFFBBKKKK',
        'zzKKFFEFFFFFFFFFFEFFKKKK',
        '..KKPPFEFFFFFFFFEFPPKKKK',
        '....KKFFMMMMMMMMFFKK....',
    ],
};
const CAT_HD_ALTS = {
    kawaii: [
        '....KK............KK..R.',
        '..KKIIKK........KKIIKK..',
        '..KKBBFFFFFFFFFFFFBBKKKK',
        'zzKKFFEFFFFFFFFFFEFFKKKK',
        '..KKPPFEFFFFFFFFEFPPKKKK',
        '....KKFFMMMMMMMMFFKK....',
    ],
};
const STYLES = {
    cat: {
        sprites: { ...scaleSet(SPRITES), ...CAT_HD },
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
const fgAnsi = ([r, g, b]) => `\x1b[38;2;${r};${g};${b}m`;
const bgAnsi = ([r, g, b]) => `\x1b[48;2;${r};${g};${b}m`;
const WALKING = new Set(['calm', 'curious']);
const JITTER = new Set(['panic', 'startled']);
const SPEECH = {
    egg: '...',
    calm: ':3',
    curious: 'hi!',
    working: 'working...',
    focused: 'focused...',
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
const SPEECH_COLOR = {
    panic: PALETTE.R,
    melted: PALETTE.R,
    levelup: PALETTE.G,
    kawaii: PALETTE.P,
};
const SPEECH_MUTED = [150, 155, 168];
const SPEECH_BESIDE_MAX = 6;
function speechFor(state, now) {
    const text = SPEECH[state];
    if (!text)
        return null;
    if (state === 'calm' && Math.floor(now / 2700) % 2 === 1)
        return null;
    return text;
}
function resolveSpriteKey(state, level) {
    if (state === 'calm') {
        if (level === 'kitten')
            return 'kitten';
        if (level === 'legend')
            return 'legend';
    }
    return state;
}
function isBlinkFrame(now) {
    return Math.floor(now / FRAME_MS) % 7 === 0;
}
function pickFrame(key, state, now, style) {
    if (state === 'calm' && key === 'calm' && isBlinkFrame(now)) {
        return style.blink;
    }
    const alt = style.alts[key];
    if (alt && Math.floor(now / FRAME_MS) % 2 === 1) {
        return alt;
    }
    return style.sprites[key] ?? style.sprites.calm;
}
function mirrorMap(map) {
    return map.map((row) => [...row].reverse().join(''));
}
const QUAD = [' ', '▗', '▖', '▄', '▝', '▐', '▞', '▟', '▘', '▚', '▌', '▙', '▀', '▜', '▛', '█'];
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
function renderCell(px) {
    const counts = new Map();
    for (const c of px) {
        if (c && c !== '.' && PALETTE[c])
            counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let colors = [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c);
    if (colors.length === 0)
        return ' ';
    const transparent = px.some((c) => !c || c === '.' || !PALETTE[c]);
    if (transparent && colors.length > 1)
        colors = [colors[0]];
    if (colors.length > 2)
        colors = colors.slice(0, 2);
    const snap = (c) => {
        if (!c || c === '.' || !PALETTE[c])
            return null;
        if (colors.includes(c))
            return c;
        return colors.reduce((best, k) => (dist2(PALETTE[c], PALETTE[k]) < dist2(PALETTE[c], PALETTE[best]) ? k : best), colors[0]);
    };
    let mask = 0;
    px.forEach((c, i) => {
        if (snap(c) === colors[0])
            mask |= (8 >> i);
    });
    if (colors.length === 1)
        return `${fgAnsi(PALETTE[colors[0]])}${QUAD[mask]}${RESET}`;
    return `${fgAnsi(PALETTE[colors[0]])}${bgAnsi(PALETTE[colors[1]])}${QUAD[mask]}${RESET}`;
}
function renderSpriteCells(map) {
    const rows = [];
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
function resolveOffset(state, level, now, span, align) {
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
/**
 * Render the pet inside an `areaWidth`-wide strip (>= PET_MIN_AREA).
 * Returns 3 sprite rows — plus a 4th speech row when the current message
 * is too long to sit beside the head. Every row is exactly `areaWidth`
 * visible columns.
 */
export function renderPetArea(state, level, now, areaWidth, align = 'right', styleName = 'cat') {
    const style = STYLES[styleName] ?? STYLES.cat;
    const width = Math.max(PET_MIN_AREA, areaWidth);
    const span = width - PET_SPRITE_WIDTH;
    const key = resolveSpriteKey(state, level);
    let map = pickFrame(key, state, now, style);
    const { offset, mirrored } = resolveOffset(state, level, now, span, align);
    if (mirrored) {
        map = mirrorMap(map);
    }
    const leftPad = Math.min(span, Math.max(0, offset));
    const rightPad = width - PET_SPRITE_WIDTH - leftPad;
    const cells = renderSpriteCells(map);
    const rows = cells.map((row) => `${' '.repeat(leftPad)}${row}${' '.repeat(rightPad)}`);
    const speech = speechFor(state, now);
    if (speech) {
        const colored = `${fgAnsi(SPEECH_COLOR[state] ?? SPEECH_MUTED)}${speech}${RESET}`;
        const need = speech.length + 1;
        const short = speech.length <= SPEECH_BESIDE_MAX;
        if (short && leftPad >= need) {
            rows[0] = `${' '.repeat(leftPad - need)}${colored} ${cells[0]}${' '.repeat(rightPad)}`;
        }
        else if (short && rightPad >= need) {
            rows[0] = `${' '.repeat(leftPad)}${cells[0]} ${colored}${' '.repeat(rightPad - need)}`;
        }
        else if (speech.length <= width) {
            const center = leftPad + Math.floor(PET_SPRITE_WIDTH / 2);
            const start = Math.max(0, Math.min(width - speech.length, center - Math.floor(speech.length / 2)));
            rows.push(' '.repeat(width));
            rows.push(`${' '.repeat(start)}${colored}${' '.repeat(width - speech.length - start)}`);
        }
    }
    return rows;
}
export function petBlankRow(areaWidth) {
    return ' '.repeat(Math.max(PET_MIN_AREA, areaWidth));
}
//# sourceMappingURL=pet.js.map