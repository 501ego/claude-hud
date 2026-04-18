import type { StdinData } from './types.js';

export interface PricingRate {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
}

// Rates keyed by canonical model slug. Longest-slug-match wins in lookupRate.
// opus-4 family: 4.5/4.6/4.7 tier selected (latest generation, $5/$25)
const PRICING: Record<string, PricingRate> = {
  'claude-opus-4':        { inputPerMTok: 5,    outputPerMTok: 25,   cacheReadPerMTok: 0.5  },
  'claude-sonnet-4':      { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.3  },
  'claude-haiku-4':       { inputPerMTok: 1,    outputPerMTok: 5,    cacheReadPerMTok: 0.1  },
  'claude-3-5-sonnet':    { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.3  },
  'claude-3-5-haiku':     { inputPerMTok: 0.8,  outputPerMTok: 4,    cacheReadPerMTok: 0.08 },
};

const DEFAULT_RATE: PricingRate = { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.3 };

export function lookupRate(modelId: string): PricingRate {
  const lower = modelId.toLowerCase();
  let bestKey = '';
  for (const key of Object.keys(PRICING)) {
    if (lower.includes(key) && key.length > bestKey.length) {
      bestKey = key;
    }
  }
  return bestKey ? PRICING[bestKey] : DEFAULT_RATE;
}

function toFiniteNumber(value: number | null | undefined): number {
  return Number.isFinite(value as number) ? (value as number) : 0;
}

export function estimateCostFromTokens(modelName: string, inputTokens: number, outputTokens: number, cacheReadTokens: number): number | null {
  const rate = lookupRate(modelName);
  const cost = (inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok + cacheReadTokens * rate.cacheReadPerMTok) / 1_000_000;
  return Number.isFinite(cost) ? cost : null;
}

export function estimateCost(stdin: StdinData): { cost: number | null; totalTokens: number } {
  const modelName = stdin.model?.display_name ?? stdin.model?.id ?? '';
  const usage = stdin.context_window?.current_usage;

  const inputTokens = toFiniteNumber(usage?.input_tokens);
  const outputTokens = toFiniteNumber(usage?.output_tokens);
  const cacheReadTokens = toFiniteNumber(usage?.cache_read_input_tokens);
  const totalTokens = inputTokens + outputTokens;

  const rate = lookupRate(modelName);
  const cost = (inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok + cacheReadTokens * rate.cacheReadPerMTok) / 1_000_000;

  return { cost: Number.isFinite(cost) ? cost : null, totalTokens };
}
