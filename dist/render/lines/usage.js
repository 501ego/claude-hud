import { isLimitReached } from "../../types.js";
import { getProviderLabel } from "../../stdin.js";
import { critical, label } from "../colors.js";
import { getAdaptiveBarWidth } from "../../utils/terminal.js";
import { formatResetTime, formatUsageWindowPart } from "../format.js";
export function renderUsageLine(ctx) {
    const display = ctx.config?.display;
    const colors = ctx.config?.colors;
    if (display?.showUsage === false)
        return null;
    if (!ctx.usageData)
        return null;
    if (getProviderLabel(ctx.stdin))
        return null;
    const usageLabel = label('Usage', colors);
    if (isLimitReached(ctx.usageData)) {
        const resetTime = ctx.usageData.fiveHour === 100
            ? formatResetTime(ctx.usageData.fiveHourResetAt)
            : formatResetTime(ctx.usageData.sevenDayResetAt);
        return `${usageLabel} ${critical(`⚠ Limit reached${resetTime ? ` (resets ${resetTime})` : ""}`, colors)}`;
    }
    const threshold = display?.usageThreshold ?? 0;
    const fiveHour = ctx.usageData.fiveHour;
    const sevenDay = ctx.usageData.sevenDay;
    const effectiveUsage = Math.max(fiveHour ?? 0, sevenDay ?? 0);
    if (effectiveUsage < threshold)
        return null;
    const usageBarEnabled = display?.usageBarEnabled ?? true;
    const sevenDayThreshold = display?.sevenDayThreshold ?? 80;
    const barWidth = getAdaptiveBarWidth(ctx.terminalWidth);
    if (fiveHour === null && sevenDay !== null) {
        const weeklyOnlyPart = formatUsageWindowPart({
            label: 'Weekly',
            percent: sevenDay,
            resetAt: ctx.usageData.sevenDayResetAt,
            colors,
            usageBarEnabled,
            barWidth,
            forceLabel: true,
        });
        return `${usageLabel} ${weeklyOnlyPart}`;
    }
    const fiveHourPart = formatUsageWindowPart({
        label: "5h",
        percent: fiveHour,
        resetAt: ctx.usageData.fiveHourResetAt,
        colors,
        usageBarEnabled,
        barWidth,
    });
    if (sevenDay !== null && sevenDay >= sevenDayThreshold) {
        const sevenDayPart = formatUsageWindowPart({
            label: 'Weekly',
            percent: sevenDay,
            resetAt: ctx.usageData.sevenDayResetAt,
            colors,
            usageBarEnabled,
            barWidth,
            forceLabel: true,
        });
        return `${usageLabel} ${fiveHourPart} | ${sevenDayPart}`;
    }
    return `${usageLabel} ${fiveHourPart}`;
}
//# sourceMappingURL=usage.js.map