import type { RenderContext } from '../../types.js';
import { label, burnHeatColor, critical, RESET } from '../colors.js';
import { estimateCostFromTokens, isRateKnown } from '../../pricing.js';
import { formatMinutes } from '../format.js';

const BRAILLE_LEVELS = ['⣀', '⣄', '⣤', '⣦', '⣶', '⣷', '⣿'];

function seriesToSparkline(series: number[]): string {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min;
  const normalize = (v: number): number =>
    range === 0 ? BRAILLE_LEVELS.length - 1 : Math.round(((v - min) / range) * (BRAILLE_LEVELS.length - 1));
  const cols = 4;
  const sampled: number[] = [];
  for (let i = 0; i < cols; i++) {
    const idx = Math.round((i / (cols - 1)) * (series.length - 1));
    sampled.push(normalize(series[Math.min(idx, series.length - 1)]));
  }
  return sampled.map(l => BRAILLE_LEVELS[l]).join('');
}

function formatTokenCount(total: number): string {
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M`;
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}k`;
  return `${total}`;
}

function modelLabel(id: string): string {
  return id
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/-(\d+)-(\d+)$/, ' $1.$2')
    .replace(/-(\d+)$/, ' $1')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function renderSessionStatsLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;
  const colors = ctx.config?.colors;
  const parts: string[] = [];

  if (display?.showDuration !== false && ctx.sessionDuration) {
    parts.push(ctx.sessionDuration);
  }

  if (
    display?.showUsageForecast !== false
    && ctx.fiveHourExhaustMin != null
    && ctx.fiveHourExhaustMin >= 0
  ) {
    parts.push(critical(`limit in ~${formatMinutes(ctx.fiveHourExhaustMin)}`, colors));
  }

  if (display?.showCost === true && ctx.transcript.modelUsage) {
    const usage = ctx.transcript.modelUsage;
    const ids = Object.keys(usage).filter(id => /claude/i.test(id));
    if (ids.length > 0) {
      parts.push(`${label('via', colors)} ${[...new Set(ids.map(modelLabel))].join(', ')}`);
    }
    let totalTokens = 0;
    let totalCost = 0;
    let costKnown = false;
    let rateUncertain = false;
    for (const id of ids) {
      const st = usage[id];
      totalTokens += st.inputTokens + st.outputTokens;
      const cost = estimateCostFromTokens(id, st.inputTokens, st.outputTokens, st.cacheReadTokens, st.cacheCreationTokens);
      if (cost !== null) {
        totalCost += cost;
        costKnown = true;
        if (!isRateKnown(id)) rateUncertain = true;
      }
    }
    if (totalTokens > 0) {
      const tokStr = formatTokenCount(totalTokens);
      const tokDisplay = display?.showBurnHeat === true && ctx.burnRate != null
        ? `${burnHeatColor(ctx.burnRate, colors)}${tokStr}${RESET}`
        : tokStr;
      const costStr = costKnown ? ` ≈ ${rateUncertain ? '~$' : '$'}${totalCost.toFixed(2)}` : '';
      const sparkline = display?.showSparkline === true && ctx.burnTrend != null && ctx.burnTrend.length > 0
        ? ` ${seriesToSparkline(ctx.burnTrend)}`
        : '';
      parts.push(`${tokDisplay} tok${costStr}${sparkline}`);
    }
  }

  if (parts.length === 0) return null;
  return `${label('Session', colors)} ${parts.join(' │ ')}`;
}
