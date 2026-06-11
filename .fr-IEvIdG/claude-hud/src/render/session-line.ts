import type { RenderContext } from '../types.js';
import { isLimitReached } from '../types.js';
import { getContextPercent, getBufferedPercent, getModelName, formatModelName, getProviderLabel } from '../stdin.js';
import { coloredBar, coloredBarWithMarker, critical, git as gitColor, gitBranch as gitBranchColor, label, model as modelColor, project as projectColor, getContextColor, custom as customColor, RESET, burnHeatColor } from './colors.js';
import { getAdaptiveBarWidth } from '../utils/terminal.js';
import { estimateCost, isRateKnown } from '../pricing.js';
import { formatTokens, formatContextValue, formatResetTime, formatUsagePercent, formatUsageWindowPart } from './format.js';
import { AUTOCOMPACT_BUFFER_PERCENT } from '../constants.js';

const DEBUG = process.env.DEBUG?.includes('claude-hud') || process.env.DEBUG === '*';

export function buildCacheGlyph(ctx: RenderContext, enabled: boolean): string {
  if (!enabled) return '';
  const usage = ctx.stdin.context_window?.current_usage;
  if (!usage) return '';
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const input = usage.input_tokens ?? 0;
  const total = cacheRead + input;
  if (total === 0) return '';
  const ratio = cacheRead / total;
  if (ratio >= 0.85) return '';
  if (ratio >= 0.5) return ' ◑';
  return ' ○';
}

/**
 * Renders the full session line (model + context bar + project + git + counts + usage + duration).
 * Used for compact layout mode.
 */
export function renderSessionLine(ctx: RenderContext): string {
  const model = formatModelName(getModelName(ctx.stdin), ctx.config?.display?.modelFormat, ctx.config?.display?.modelOverride);

  const rawPercent = getContextPercent(ctx.stdin);
  const bufferedPercent = getBufferedPercent(ctx.stdin);
  const autocompactMode = ctx.config?.display?.autocompactBuffer ?? 'enabled';
  const percent = autocompactMode === 'disabled' ? rawPercent : bufferedPercent;

  if (DEBUG && autocompactMode === 'disabled') {
    console.error(`[claude-hud:context] autocompactBuffer=disabled, showing raw ${rawPercent}% (buffered would be ${bufferedPercent}%)`);
  }

  const colors = ctx.config?.colors;
  const barWidth = getAdaptiveBarWidth(ctx.terminalWidth);
  const display = ctx.config?.display;
  const markerPercent = (1 - AUTOCOMPACT_BUFFER_PERCENT) * 100;
  const bar = display?.showAutocompactMarker === true
    ? coloredBarWithMarker(rawPercent, barWidth, markerPercent, ctx.burnRate != null ? burnHeatColor(ctx.burnRate, colors) : undefined, colors)
    : coloredBar(percent, barWidth, colors);

  const parts: string[] = [];
  const contextValueMode = display?.contextValue ?? 'percent';
  const contextValue = formatContextValue(ctx, percent, contextValueMode);
  const cacheGlyph = buildCacheGlyph(ctx, display?.showCacheGlyph === true);
  const contextValueDisplay = `${getContextColor(percent, colors)}${contextValue}${RESET}${cacheGlyph}`;

  const providerLabel = getProviderLabel(ctx.stdin);
  const modelQualifier = providerLabel ?? undefined;
  const modelDisplay = modelQualifier ? `${model} | ${modelQualifier}` : model;

  if (display?.showModel !== false && display?.showContextBar !== false) {
    parts.push(`${modelColor(`[${modelDisplay}]`, colors)} ${bar} ${contextValueDisplay}`);
  } else if (display?.showModel !== false) {
    parts.push(`${modelColor(`[${modelDisplay}]`, colors)} ${contextValueDisplay}`);
  } else if (display?.showContextBar !== false) {
    parts.push(`${bar} ${contextValueDisplay}`);
  } else {
    parts.push(contextValueDisplay);
  }

  let projectPart: string | null = null;
  if (display?.showProject !== false && ctx.stdin.cwd) {
    const segments = ctx.stdin.cwd.split(/[/\\]/).filter(Boolean);
    const pathLevels = ctx.config?.pathLevels ?? 1;
    const projectPath = segments.length > 0 ? segments.slice(-pathLevels).join('/') : '/';
    projectPart = projectColor(projectPath, colors);
  }

  let gitPart = '';
  const gitConfig = ctx.config?.gitStatus;
  const showGit = gitConfig?.enabled ?? true;

  if (showGit && ctx.gitStatus) {
    const gitParts: string[] = [ctx.gitStatus.branch];

    if ((gitConfig?.showDirty ?? true) && ctx.gitStatus.isDirty) {
      gitParts.push('*');
    }

    if (gitConfig?.showAheadBehind) {
      if (ctx.gitStatus.ahead > 0) gitParts.push(` ↑${ctx.gitStatus.ahead}`);
      if (ctx.gitStatus.behind > 0) gitParts.push(` ↓${ctx.gitStatus.behind}`);
    }

    if (gitConfig?.showFileStats && ctx.gitStatus.fileStats) {
      const { modified, added, deleted, untracked } = ctx.gitStatus.fileStats;
      const statParts: string[] = [];
      if (modified > 0) statParts.push(`!${modified}`);
      if (added > 0) statParts.push(`+${added}`);
      if (deleted > 0) statParts.push(`✘${deleted}`);
      if (untracked > 0) statParts.push(`?${untracked}`);
      if (statParts.length > 0) gitParts.push(` ${statParts.join(' ')}`);
    }

    gitPart = `${gitColor('git:(', colors)}${gitBranchColor(gitParts.join(''), colors)}${gitColor(')', colors)}`;
  }

  if (projectPart && gitPart) {
    parts.push(`${projectPart} ${gitPart}`);
  } else if (projectPart) {
    parts.push(projectPart);
  } else if (gitPart) {
    parts.push(gitPart);
  }

  if (display?.showCost === true) {
    const { cost } = estimateCost(ctx.stdin);
    if (cost !== null) {
      const modelName = ctx.stdin.model?.display_name ?? ctx.stdin.model?.id ?? '';
      const prefix = isRateKnown(modelName) ? '$' : '~$';
      parts.push(label(`${prefix}${cost.toFixed(2)}`, colors));
    }
  }

  if (display?.showConfigCounts !== false) {
    const totalCounts = ctx.claudeMdCount + ctx.rulesCount + ctx.mcpCount + ctx.hooksCount;
    const envThreshold = display?.environmentThreshold ?? 0;

    if (totalCounts > 0 && totalCounts >= envThreshold) {
      if (ctx.claudeMdCount > 0) parts.push(label(`${ctx.claudeMdCount} CLAUDE.md`, colors));
      if (ctx.rulesCount > 0) parts.push(label(`${ctx.rulesCount} rules`, colors));
      if (ctx.mcpCount > 0) parts.push(label(`${ctx.mcpCount} MCPs`, colors));
      if (ctx.hooksCount > 0) parts.push(label(`${ctx.hooksCount} hooks`, colors));
    }
  }

  if (display?.showUsage !== false && ctx.usageData && !providerLabel) {
    if (isLimitReached(ctx.usageData)) {
      const resetTime = ctx.usageData.fiveHour === 100
        ? formatResetTime(ctx.usageData.fiveHourResetAt)
        : formatResetTime(ctx.usageData.sevenDayResetAt);
      parts.push(critical(`⚠ Limit reached${resetTime ? ` (resets ${resetTime})` : ''}`, colors));
    } else {
      const usageThreshold = display?.usageThreshold ?? 0;
      const fiveHour = ctx.usageData.fiveHour;
      const sevenDay = ctx.usageData.sevenDay;
      const effectiveUsage = Math.max(fiveHour ?? 0, sevenDay ?? 0);

      if (effectiveUsage >= usageThreshold) {
        const usageBarEnabled = display?.usageBarEnabled ?? true;
        if (fiveHour === null && sevenDay !== null) {
          parts.push(formatUsageWindowPart({
            label: 'Weekly',
            percent: sevenDay,
            resetAt: ctx.usageData.sevenDayResetAt,
            colors,
            usageBarEnabled,
            barWidth,
            forceLabel: true,
          }));
        } else {
          const fiveHourPart = formatUsageWindowPart({
            label: '5h',
            percent: fiveHour,
            resetAt: ctx.usageData.fiveHourResetAt,
            colors,
            usageBarEnabled,
            barWidth,
          });

          const sevenDayThreshold = display?.sevenDayThreshold ?? 80;
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
            parts.push(`${label('Usage', colors)} ${fiveHourPart}`);
            parts.push(sevenDayPart);
          } else {
            parts.push(`${label('Usage', colors)} ${fiveHourPart}`);
          }
        }
      }
    }
  }

  if (display?.showSessionTokens && ctx.transcript.sessionTokens) {
    const st = ctx.transcript.sessionTokens;
    const total = st.inputTokens + st.outputTokens + st.cacheCreationTokens + st.cacheReadTokens;
    if (total > 0) {
      const tokText = `tok: ${formatTokens(total)} (in: ${formatTokens(st.inputTokens)}, out: ${formatTokens(st.outputTokens)})`;
      const heatOn = display?.showBurnHeat === true && ctx.burnRate != null;
      parts.push(heatOn ? `${burnHeatColor(ctx.burnRate!, colors)}${tokText}${RESET}` : label(tokText, colors));
    }
  }

  if (display?.showDuration === true && ctx.sessionDuration) {
    parts.push(label(ctx.sessionDuration, colors));
  }

  if (ctx.extraLabel) {
    parts.push(label(ctx.extraLabel, colors));
  }

  const customLine = display?.customLine;
  if (customLine) {
    parts.push(customColor(customLine, colors));
  }

  let line = parts.join(' \u2502 ');

  if (display?.showTokenBreakdown !== false && percent >= 85) {
    const usage = ctx.stdin.context_window?.current_usage;
    if (usage) {
      const input = formatTokens(usage.input_tokens ?? 0);
      const cache = formatTokens((usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0));
      line += label(` (in: ${input}, cache: ${cache})`, colors);
    }
  }

  return line;
}

export { formatUsagePercent };
