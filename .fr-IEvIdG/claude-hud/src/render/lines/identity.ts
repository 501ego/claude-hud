import type { RenderContext } from "../../types.js";
import { getContextPercent, getBufferedPercent } from "../../stdin.js";
import { coloredBar, coloredBarWithMarker, burnHeatColor, label, getContextColor, RESET } from "../colors.js";
import { getAdaptiveBarWidth } from "../../utils/terminal.js";
import { formatTokens, formatContextValue, formatMinutes } from "../format.js";
import { AUTOCOMPACT_BUFFER_PERCENT } from "../../constants.js";
import { buildCacheGlyph } from "../session-line.js";

const DEBUG =
  process.env.DEBUG?.includes("claude-hud") || process.env.DEBUG === "*";

export function renderIdentityLine(ctx: RenderContext): string {
  const rawPercent = getContextPercent(ctx.stdin);
  const bufferedPercent = getBufferedPercent(ctx.stdin);
  const autocompactMode = ctx.config?.display?.autocompactBuffer ?? "enabled";
  const percent = autocompactMode === "disabled" ? rawPercent : bufferedPercent;
  const colors = ctx.config?.colors;

  if (DEBUG && autocompactMode === "disabled") {
    console.error(
      `[claude-hud:context] autocompactBuffer=disabled, showing raw ${rawPercent}% (buffered would be ${bufferedPercent}%)`,
    );
  }

  const display = ctx.config?.display;
  const contextValueMode = display?.contextValue ?? "percent";
  const contextValue = formatContextValue(ctx, percent, contextValueMode);
  const cacheGlyph = buildCacheGlyph(ctx, display?.showCacheGlyph === true);
  const contextValueDisplay = `${getContextColor(percent, colors)}${contextValue}${RESET}${cacheGlyph}`;

  const barWidth = getAdaptiveBarWidth(ctx.terminalWidth);
  const markerPercent = (1 - AUTOCOMPACT_BUFFER_PERCENT) * 100;
  const contextBar = display?.showAutocompactMarker === true
    ? coloredBarWithMarker(rawPercent, barWidth, markerPercent, ctx.burnRate != null ? burnHeatColor(ctx.burnRate, colors) : undefined, colors)
    : coloredBar(percent, barWidth, colors);
  let line =
    display?.showContextBar !== false
      ? `${label('Context', colors)} ${contextBar} ${contextValueDisplay}`
      : `${label('Context', colors)} ${contextValueDisplay}`;

  if (
    display?.showCompactEta !== false
    && ctx.compactEtaMin != null
    && ctx.compactEtaMin >= 0
    && ctx.compactEtaMin <= 120
  ) {
    line += label(` compact in ~${formatMinutes(ctx.compactEtaMin)}`, colors);
  }

  if (display?.showTokenBreakdown !== false && percent >= 85) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (usage) {
      const input = formatTokens(usage.input_tokens ?? 0);
      const cache = formatTokens(
        (usage.cache_creation_input_tokens ?? 0) +
          (usage.cache_read_input_tokens ?? 0),
      );
      line += label(` (in: ${input}, cache: ${cache})`, colors);
    }
  }

  return line;
}
