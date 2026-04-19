import type { RenderContext } from '../types.js';
export declare function formatTokens(n: number): string;
export declare function formatContextValue(ctx: RenderContext, percent: number, mode: 'percent' | 'tokens' | 'remaining' | 'both'): string;
export declare function formatResetTime(resetAt: Date | null): string;
export declare function formatUsagePercent(percent: number | null, colors?: RenderContext['config']['colors']): string;
export declare function formatUsageWindowPart({ label: windowLabel, percent, resetAt, colors, usageBarEnabled, barWidth, forceLabel, }: {
    label: string;
    percent: number | null;
    resetAt: Date | null;
    colors?: RenderContext['config']['colors'];
    usageBarEnabled: boolean;
    barWidth: number;
    forceLabel?: boolean;
}): string;
//# sourceMappingURL=format.d.ts.map