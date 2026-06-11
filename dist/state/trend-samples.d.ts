/**
 * Record a monotonically growing value (context tokens, quota percent).
 * A decrease means the underlying counter reset (compaction, quota window
 * reset) — older samples above the new value are dropped so the series
 * stays monotone and the rate restarts from the break point.
 */
export declare function recordTrendSample(key: string, value: number, windowMs: number): void;
/** Growth rate in value-units per minute over the sampled window, or null. */
export declare function readTrendRatePerMin(key: string, windowMs: number): number | null;
//# sourceMappingURL=trend-samples.d.ts.map