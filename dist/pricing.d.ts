import type { StdinData } from './types.js';
export interface PricingRate {
    inputPerMTok: number;
    outputPerMTok: number;
    cacheReadPerMTok: number;
}
export declare function lookupRate(modelId: string): PricingRate;
export declare function estimateCostFromTokens(modelName: string, inputTokens: number, outputTokens: number, cacheReadTokens: number): number | null;
export declare function estimateCost(stdin: StdinData): {
    cost: number | null;
    totalTokens: number;
};
//# sourceMappingURL=pricing.d.ts.map