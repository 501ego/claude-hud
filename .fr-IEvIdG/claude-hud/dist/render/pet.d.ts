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
export declare const PET_SPRITE_WIDTH = 12;
export declare const PET_MIN_AREA: number;
export type PetStyleName = 'cat' | 'claude';
/**
 * Render the pet inside an `areaWidth`-wide strip (>= PET_MIN_AREA).
 * Returns 3 sprite rows — plus a 4th speech row when the current message
 * is too long to sit beside the head. Every row is exactly `areaWidth`
 * visible columns.
 */
export declare function renderPetArea(state: PetStateName, level: PetLevel, now: number, areaWidth: number, align?: 'left' | 'right', styleName?: PetStyleName): string[];
export declare function petBlankRow(areaWidth: number): string;
//# sourceMappingURL=pet.d.ts.map