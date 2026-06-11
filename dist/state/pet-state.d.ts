import type { TranscriptData, StdinData, UsageData } from '../types.js';
export type PetLevel = 'egg' | 'kitten' | 'adult' | 'legend';
export type PetStateName = 'egg' | 'calm' | 'working' | 'focused' | 'curious' | 'sleeping' | 'eating' | 'stressed' | 'burning' | 'panic' | 'error' | 'dizzy' | 'melted' | 'startled' | 'sad' | 'sick' | 'levelup' | 'kawaii';
export interface PetStatus {
    state: PetStateName;
    level: PetLevel;
}
export interface ResolvePetInput {
    transcriptPath: string;
    transcript: TranscriptData;
    stdin: StdinData;
    usageData: UsageData | null;
    fiveHourExhaustMin: number | null;
    contextPercent: number;
}
/**
 * Update persisted pet state from this render's telemetry and resolve the
 * current expression. Called once per render from main(); all I/O best-effort.
 */
export declare function resolvePetStatus(input: ResolvePetInput, now: number): PetStatus;
//# sourceMappingURL=pet-state.d.ts.map