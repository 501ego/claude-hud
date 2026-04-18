import { getContextPercent, getBufferedPercent } from "../../stdin.js";
import { coloredBar, label, getContextColor, RESET } from "../colors.js";
import { getAdaptiveBarWidth } from "../../utils/terminal.js";
import { formatTokens, formatContextValue } from "../format.js";
const DEBUG = process.env.DEBUG?.includes("claude-hud") || process.env.DEBUG === "*";
export function renderIdentityLine(ctx) {
    const rawPercent = getContextPercent(ctx.stdin);
    const bufferedPercent = getBufferedPercent(ctx.stdin);
    const autocompactMode = ctx.config?.display?.autocompactBuffer ?? "enabled";
    const percent = autocompactMode === "disabled" ? rawPercent : bufferedPercent;
    const colors = ctx.config?.colors;
    if (DEBUG && autocompactMode === "disabled") {
        console.error(`[claude-hud:context] autocompactBuffer=disabled, showing raw ${rawPercent}% (buffered would be ${bufferedPercent}%)`);
    }
    const display = ctx.config?.display;
    const contextValueMode = display?.contextValue ?? "percent";
    const contextValue = formatContextValue(ctx, percent, contextValueMode);
    const contextValueDisplay = `${getContextColor(percent, colors)}${contextValue}${RESET}`;
    let line = display?.showContextBar !== false
        ? `${label('Context', colors)} ${coloredBar(percent, getAdaptiveBarWidth(ctx.terminalWidth), colors)} ${contextValueDisplay}`
        : `${label('Context', colors)} ${contextValueDisplay}`;
    if (display?.showTokenBreakdown !== false && percent >= 85) {
        const usage = ctx.stdin.context_window?.current_usage;
        if (usage) {
            const input = formatTokens(usage.input_tokens ?? 0);
            const cache = formatTokens((usage.cache_creation_input_tokens ?? 0) +
                (usage.cache_read_input_tokens ?? 0));
            line += label(` (in: ${input}, cache: ${cache})`, colors);
        }
    }
    return line;
}
//# sourceMappingURL=identity.js.map