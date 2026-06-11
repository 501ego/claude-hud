import type { StdinData } from './types.js';
export interface PricingRate {
    inputPerMTok: number;
    outputPerMTok: number;
    cacheReadPerMTok: number;
    cacheWritePerMTok: number;
}
export interface RateLookup {
    rate: PricingRate;
    /** false when the model couldn't be identified and DEFAULT_RATE was used */
    known: boolean;
}
export declare function lookupRateInfo(modelId: string): RateLookup;
export declare function lookupRate(modelId: string): PricingRate;
export declare function isRateKnown(modelId: string): boolean;
export declare function estimateCostFromTokens(modelName: string, inputTokens: number, outputTokens: number, cacheReadTokens: number, cacheWriteTokens: number): number | null;
export declare function estimateCost(stdin: StdinData): {
    cost: number | null;
    totalTokens: number;
};
//# sourceMappingURL=pricing.d.ts.map