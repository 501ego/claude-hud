import type { HudColorName, HudColorValue, HudColorOverrides } from '../config.js';

export const RESET = '\x1b[0m';

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BRIGHT_BLUE = '\x1b[94m';
const BRIGHT_MAGENTA = '\x1b[95m';
const CLAUDE_ORANGE = '\x1b[38;5;208m';

const ANSI_BY_NAME: Record<HudColorName, string> = {
  dim: DIM,
  red: RED,
  green: GREEN,
  yellow: YELLOW,
  magenta: MAGENTA,
  cyan: CYAN,
  brightBlue: BRIGHT_BLUE,
  brightMagenta: BRIGHT_MAGENTA,
};

/** Convert a hex color string (#rrggbb) to a truecolor ANSI escape sequence. */
function hexToAnsi(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/**
 * Resolve a color value to an ANSI escape sequence.
 * Accepts named presets, 256-color indices (0-255), or hex strings (#rrggbb).
 */
function resolveAnsi(value: HudColorValue | undefined, fallback: string): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'number') {
    return `\x1b[38;5;${value}m`;
  }
  if (typeof value === 'string' && value.startsWith('#') && value.length === 7) {
    return hexToAnsi(value);
  }
  return ANSI_BY_NAME[value as HudColorName] ?? fallback;
}

function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

function withOverride(text: string, value: HudColorValue | undefined, fallback: string): string {
  return colorize(text, resolveAnsi(value, fallback));
}

export function green(text: string): string {
  return colorize(text, GREEN);
}

export function yellow(text: string): string {
  return colorize(text, YELLOW);
}

export function red(text: string): string {
  return colorize(text, RED);
}

export function cyan(text: string): string {
  return colorize(text, CYAN);
}

export function magenta(text: string): string {
  return colorize(text, MAGENTA);
}

export function dim(text: string): string {
  return colorize(text, DIM);
}

export function claudeOrange(text: string): string {
  return colorize(text, CLAUDE_ORANGE);
}

export function model(text: string, colors?: Partial<HudColorOverrides>): string {
  return withOverride(text, colors?.model, CYAN);
}

export function project(text: string, colors?: Partial<HudColorOverrides>): string {
  return withOverride(text, colors?.project, YELLOW);
}

export function git(text: string, colors?: Partial<HudColorOverrides>): string {
  return withOverride(text, colors?.git, MAGENTA);
}

export function tools(text: string, colors?: Partial<HudColorOverrides>): string {
  return withOverride(text, colors?.tools, CYAN);
}

export function gitBranch(text: string, colors?: Partial<HudColorOverrides>): string {
  return withOverride(text, colors?.gitBranch, CYAN);
}

export function label(text: string, colors?: Partial<HudColorOverrides>): string {
  return withOverride(text, colors?.label, DIM);
}

export function custom(text: string, colors?: Partial<HudColorOverrides>): string {
  return withOverride(text, colors?.custom, CLAUDE_ORANGE);
}

export function warning(text: string, colors?: Partial<HudColorOverrides>): string {
  return colorize(text, resolveAnsi(colors?.warning, YELLOW));
}

export function critical(text: string, colors?: Partial<HudColorOverrides>): string {
  return colorize(text, resolveAnsi(colors?.critical, RED));
}

export function getContextColor(percent: number, colors?: Partial<HudColorOverrides>): string {
  if (percent >= 85) return resolveAnsi(colors?.critical, RED);
  if (percent >= 70) return resolveAnsi(colors?.warning, YELLOW);
  return resolveAnsi(colors?.context, GREEN);
}

export function getQuotaColor(percent: number, colors?: Partial<HudColorOverrides>): string {
  if (percent >= 90) return resolveAnsi(colors?.critical, RED);
  if (percent >= 75) return resolveAnsi(colors?.usageWarning, BRIGHT_MAGENTA);
  return resolveAnsi(colors?.usage, BRIGHT_BLUE);
}

export function quotaBar(percent: number, width: number = 10, colors?: Partial<HudColorOverrides>): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;
  const color = getQuotaColor(safePercent, colors);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

const EIGHTH_BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

export function quotaHeatBar(percent: number, width: number = 10, colors?: Partial<HudColorOverrides>): string {
  const safeWidth = Number.isFinite(width) ? Math.max(2, Math.round(width)) : 2;
  const inner = safeWidth - 2;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const color = getQuotaColor(safePercent, colors);
  const eighths = Math.round((safePercent / 100) * inner * 8);
  const full = Math.min(inner, Math.floor(eighths / 8));
  let cells = '█'.repeat(full);
  let used = full;
  const remainder = eighths % 8;
  if (used < inner && remainder > 0) {
    cells += EIGHTH_BLOCKS[remainder];
    used += 1;
  }
  const pad = ' '.repeat(inner - used);
  return `${color}▕${cells}${pad}▏${RESET}`;
}

export function quotaBrailleBar(percent: number, width: number = 8, colors?: Partial<HudColorOverrides>): string {
  const safeWidth = Number.isFinite(width) ? Math.max(1, Math.round(width)) : 1;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const color = getQuotaColor(safePercent, colors);
  const columns = Math.round((safePercent / 100) * safeWidth * 2);
  const full = Math.min(safeWidth, Math.floor(columns / 2));
  let bar = '⣿'.repeat(full);
  let used = full;
  if (used < safeWidth && columns % 2 === 1) {
    bar += '⡇';
    used += 1;
  }
  const empty = safeWidth - used;
  return `${color}${bar}${DIM}${'⠄'.repeat(empty)}${RESET}`;
}

export function effortCurve(level: string | null | undefined): string {
  switch ((level ?? '').toLowerCase()) {
    case 'xhigh':
      return '⣀⣶⣿⣿';
    case 'high':
    case 'max':
      return '⣀⣤⣶⣿';
    case 'medium':
    case 'med':
      return '⣀⣶⣿⣶⣀';
    case 'low':
      return '⣿⣶⣤⣀';
    default:
      return '';
  }
}

export function coloredBar(percent: number, width: number = 10, colors?: Partial<HudColorOverrides>): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;
  const color = getContextColor(safePercent, colors);
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET}`;
}

export function burnHeatColor(velocity: number, colors?: Partial<HudColorOverrides>): string {
  if (velocity >= 2000) return resolveAnsi(colors?.burnHigh, '\x1b[38;2;240;112;144m');
  if (velocity >= 500) return resolveAnsi(colors?.usage, MAGENTA);
  return resolveAnsi(colors?.burnLow, '\x1b[38;2;244;167;185m');
}

export function coloredBarWithMarker(
  percent: number,
  width: number = 10,
  markerPercent: number,
  burnColor?: string,
  colors?: Partial<HudColorOverrides>,
): string {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const markerIndex = Math.min(safeWidth - 1, Math.max(0, Math.round((markerPercent / 100) * safeWidth)));
  const fillColor = burnColor ?? getContextColor(safePercent, colors);
  const cells: string[] = [];
  for (let i = 0; i < safeWidth; i++) {
    cells.push(i < filled ? '█' : '░');
  }
  if (safeWidth > 0) cells[markerIndex] = '┊';
  const filledCells = cells.slice(0, filled).join('');
  const emptyCells = cells.slice(filled).join('');
  return `${fillColor}${filledCells}${DIM}${emptyCells}${RESET}`;
}
