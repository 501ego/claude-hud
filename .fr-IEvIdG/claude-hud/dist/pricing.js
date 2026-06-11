const PRICING = {
    'claude-fable-5': { inputPerMTok: 10, outputPerMTok: 50, cacheReadPerMTok: 1.0, cacheWritePerMTok: 12.5 },
    'claude-opus-4': { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
    'claude-opus-4-1': { inputPerMTok: 15, outputPerMTok: 75, cacheReadPerMTok: 1.5, cacheWritePerMTok: 18.75 },
    'claude-sonnet-4': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 },
    'claude-haiku-4': { inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
    'claude-3-5-sonnet': { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 },
    'claude-3-5-haiku': { inputPerMTok: 0.8, outputPerMTok: 4, cacheReadPerMTok: 0.08, cacheWritePerMTok: 1.0 },
};
const FAMILY_FALLBACK = {
    fable: 'claude-fable-5',
    opus: 'claude-opus-4',
    sonnet: 'claude-sonnet-4',
    haiku: 'claude-haiku-4',
};
const DEFAULT_RATE = { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3, cacheWritePerMTok: 3.75 };
export function lookupRateInfo(modelId) {
    const lower = modelId.toLowerCase();
    let bestKey = '';
    for (const key of Object.keys(PRICING)) {
        if (lower.includes(key) && key.length > bestKey.length) {
            bestKey = key;
        }
    }
    if (bestKey) {
        return { rate: PRICING[bestKey], known: true };
    }
    for (const family of Object.keys(FAMILY_FALLBACK)) {
        if (lower.includes(family)) {
            return { rate: PRICING[FAMILY_FALLBACK[family]], known: true };
        }
    }
    return { rate: DEFAULT_RATE, known: false };
}
export function lookupRate(modelId) {
    return lookupRateInfo(modelId).rate;
}
export function isRateKnown(modelId) {
    return lookupRateInfo(modelId).known;
}
function toFiniteNumber(value) {
    return Number.isFinite(value) ? value : 0;
}
export function estimateCostFromTokens(modelName, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) {
    const rate = lookupRate(modelName);
    const cost = (inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok + cacheReadTokens * rate.cacheReadPerMTok + cacheWriteTokens * rate.cacheWritePerMTok) / 1_000_000;
    return Number.isFinite(cost) ? cost : null;
}
export function estimateCost(stdin) {
    const modelName = stdin.model?.display_name ?? stdin.model?.id ?? '';
    const usage = stdin.context_window?.current_usage;
    const inputTokens = toFiniteNumber(usage?.input_tokens);
    const outputTokens = toFiniteNumber(usage?.output_tokens);
    const cacheReadTokens = toFiniteNumber(usage?.cache_read_input_tokens);
    const cacheWriteTokens = toFiniteNumber(usage?.cache_creation_input_tokens);
    const totalTokens = inputTokens + outputTokens;
    const rate = lookupRate(modelName);
    const cost = (inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok + cacheReadTokens * rate.cacheReadPerMTok + cacheWriteTokens * rate.cacheWritePerMTok) / 1_000_000;
    return { cost: Number.isFinite(cost) ? cost : null, totalTokens };
}
//# sourceMappingURL=pricing.js.map