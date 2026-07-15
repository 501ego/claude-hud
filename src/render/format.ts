import type { RenderContext } from '../types.js';
import { getTotalTokens } from '../stdin.js';
import { label, getQuotaColor, quotaBrailleBar, RESET } from './colors.js';

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

export function formatContextValue(
  ctx: RenderContext,
  percent: number,
  mode: 'percent' | 'tokens' | 'remaining' | 'both',
): string {
  const totalTokens = getTotalTokens(ctx.stdin);
  const size = ctx.stdin.context_window?.context_window_size ?? 0;

  if (mode === 'tokens') {
    return size > 0 ? `${formatTokens(totalTokens)}/${formatTokens(size)}` : formatTokens(totalTokens);
  }
  if (mode === 'both') {
    return size > 0 ? `${percent}% (${formatTokens(totalTokens)}/${formatTokens(size)})` : `${percent}%`;
  }
  if (mode === 'remaining') {
    return `${Math.max(0, 100 - percent)}%`;
  }
  return `${percent}%`;
}

export function formatMinutes(totalMins: number): string {
  const mins = Math.max(0, Math.round(totalMins));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h${rem}m` : `${hours}h`;
}

export function formatResetTime(resetAt: Date | null): string {
  if (!resetAt) return '';
  const diffMs = resetAt.getTime() - Date.now();
  if (diffMs <= 0) return '';

  const diffMins = Math.ceil(diffMs / 60_000);
  if (diffMins < 60) return `${diffMins}m`;

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  }

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatUsagePercent(
  percent: number | null,
  colors?: RenderContext['config']['colors'],
): string {
  if (percent === null) return label('--', colors);
  const color = getQuotaColor(percent, colors);
  return `${color}${percent}%${RESET}`;
}

export function formatUsageWindowPart({
  label: windowLabel,
  percent,
  resetAt,
  colors,
  usageBarEnabled,
  barWidth,
  forceLabel = false,
}: {
  label: string;
  percent: number | null;
  resetAt: Date | null;
  colors?: RenderContext['config']['colors'];
  usageBarEnabled: boolean;
  barWidth: number;
  forceLabel?: boolean;
}): string {
  const usageDisplay = formatUsagePercent(percent, colors);
  const reset = formatResetTime(resetAt);
  const styledLabel = label(windowLabel, colors);

  const resetGlyph = reset ? ` ↺ ${reset.replace(/\s+/g, '')}` : '';

  if (usageBarEnabled) {
    const body = `${quotaBrailleBar(percent ?? 0, barWidth, colors)} ${usageDisplay}${resetGlyph}`;
    return forceLabel ? `${styledLabel} ${body}` : body;
  }

  return `${styledLabel} ${usageDisplay}${resetGlyph}`;
}
