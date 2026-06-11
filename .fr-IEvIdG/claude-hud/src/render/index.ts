import type { HudElement } from '../config.js';
import { DEFAULT_ELEMENT_ORDER } from '../config.js';
import type { RenderContext } from '../types.js';
import { renderSessionLine } from './session-line.js';
import { renderToolsLine } from './tools-line.js';
import { renderAgentsLine } from './agents-line.js';
import { renderTodosLine } from './todos-line.js';
import {
  renderIdentityLine,
  renderProjectLine,
  renderGitFilesLine,
  renderEnvironmentLine,
  renderUsageLine,
  renderMemoryLine,
  renderSessionStatsLine,
} from './lines/index.js';
import { dim, RESET } from './colors.js';
import { getTerminalWidth, getWidthCandidates } from '../utils/terminal.js';
import { renderPetArea, petBlankRow, PET_MIN_AREA } from './pet.js';
import type { PetLevel, PetStateName } from '../state/pet-state.js';

const ANSI_ESCAPE_PATTERN = /^(?:\x1b\[[0-9;]*m|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\))/;
const ANSI_ESCAPE_GLOBAL = /(?:\x1b\[[0-9;]*m|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\))/g;
const GRAPHEME_SEGMENTER = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null;

function stripAnsi(str: string): string {
  return str.replace(ANSI_ESCAPE_GLOBAL, '');
}

function splitAnsiTokens(str: string): Array<{ type: 'ansi' | 'text'; value: string }> {
  const tokens: Array<{ type: 'ansi' | 'text'; value: string }> = [];
  let i = 0;

  while (i < str.length) {
    const ansiMatch = ANSI_ESCAPE_PATTERN.exec(str.slice(i));
    if (ansiMatch) {
      tokens.push({ type: 'ansi', value: ansiMatch[0] });
      i += ansiMatch[0].length;
      continue;
    }

    let j = i;
    while (j < str.length) {
      const nextAnsi = ANSI_ESCAPE_PATTERN.exec(str.slice(j));
      if (nextAnsi) {
        break;
      }
      j += 1;
    }
    tokens.push({ type: 'text', value: str.slice(i, j) });
    i = j;
  }

  return tokens;
}

function segmentGraphemes(text: string): string[] {
  if (!text) {
    return [];
  }
  if (!GRAPHEME_SEGMENTER) {
    return Array.from(text);
  }
  return Array.from(GRAPHEME_SEGMENTER.segment(text), segment => segment.segment);
}

function isWideCodePoint(codePoint: number): boolean {
  return codePoint >= 0x1100 && (
    codePoint <= 0x115F ||
    codePoint === 0x2329 ||
    codePoint === 0x232A ||
    (codePoint >= 0x2E80 && codePoint <= 0xA4CF && codePoint !== 0x303F) ||
    (codePoint >= 0xAC00 && codePoint <= 0xD7A3) ||
    (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||
    (codePoint >= 0xFE10 && codePoint <= 0xFE19) ||
    (codePoint >= 0xFE30 && codePoint <= 0xFE6F) ||
    (codePoint >= 0xFF00 && codePoint <= 0xFF60) ||
    (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) ||
    (codePoint >= 0x1F300 && codePoint <= 0x1FAFF) ||
    (codePoint >= 0x20000 && codePoint <= 0x3FFFD)
  );
}

function graphemeWidth(grapheme: string): number {
  if (!grapheme || /^\p{Control}$/u.test(grapheme)) {
    return 0;
  }

  if (/\p{Extended_Pictographic}/u.test(grapheme)) {
    return 2;
  }

  let hasVisibleBase = false;
  let width = 0;
  for (const char of Array.from(grapheme)) {
    if (/^\p{Mark}$/u.test(char) || char === '\u200D' || char === '\uFE0F') {
      continue;
    }
    hasVisibleBase = true;
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined && isWideCodePoint(codePoint)) {
      width = Math.max(width, 2);
    } else {
      width = Math.max(width, 1);
    }
  }

  return hasVisibleBase ? width : 0;
}

function visualLength(str: string): number {
  let width = 0;
  for (const token of splitAnsiTokens(str)) {
    if (token.type === 'ansi') {
      continue;
    }
    for (const grapheme of segmentGraphemes(token.value)) {
      width += graphemeWidth(grapheme);
    }
  }
  return width;
}

function sliceVisible(str: string, maxVisible: number): string {
  if (maxVisible <= 0) {
    return '';
  }

  let result = '';
  let visibleWidth = 0;
  let done = false;
  let i = 0;

  while (i < str.length && !done) {
    const ansiMatch = ANSI_ESCAPE_PATTERN.exec(str.slice(i));
    if (ansiMatch) {
      result += ansiMatch[0];
      i += ansiMatch[0].length;
      continue;
    }

    let j = i;
    while (j < str.length) {
      const nextAnsi = ANSI_ESCAPE_PATTERN.exec(str.slice(j));
      if (nextAnsi) {
        break;
      }
      j += 1;
    }

    const plainChunk = str.slice(i, j);
    for (const grapheme of segmentGraphemes(plainChunk)) {
      const graphemeCellWidth = graphemeWidth(grapheme);
      if (visibleWidth + graphemeCellWidth > maxVisible) {
        done = true;
        break;
      }
      result += grapheme;
      visibleWidth += graphemeCellWidth;
    }

    i = j;
  }

  return result;
}

function truncateToWidth(str: string, maxWidth: number): string {
  if (maxWidth <= 0 || visualLength(str) <= maxWidth) {
    return str;
  }

  const suffix = maxWidth >= 3 ? '...' : '.'.repeat(maxWidth);
  const keep = Math.max(0, maxWidth - suffix.length);
  return `${sliceVisible(str, keep)}${suffix}${RESET}`;
}

function splitLineBySeparators(line: string): { segments: string[]; separators: string[] } {
  const segments: string[] = [];
  const separators: string[] = [];
  let currentStart = 0;
  let i = 0;

  while (i < line.length) {
    const ansiMatch = ANSI_ESCAPE_PATTERN.exec(line.slice(i));
    if (ansiMatch) {
      i += ansiMatch[0].length;
      continue;
    }

    const separator = line.startsWith(' | ', i)
      ? ' | '
      : (line.startsWith(' │ ', i) ? ' │ ' : null);

    if (separator) {
      segments.push(line.slice(currentStart, i));
      separators.push(separator);
      i += separator.length;
      currentStart = i;
      continue;
    }

    i += 1;
  }

  segments.push(line.slice(currentStart));
  return { segments, separators };
}

function splitWrapParts(line: string): Array<{ separator: string; segment: string }> {
  const { segments, separators } = splitLineBySeparators(line);
  if (segments.length === 0) {
    return [];
  }

  let parts: Array<{ separator: string; segment: string }> = [{
    separator: '',
    segment: segments[0],
  }];
  for (let segmentIndex = 1; segmentIndex < segments.length; segmentIndex += 1) {
    parts.push({
      separator: separators[segmentIndex - 1] ?? ' | ',
      segment: segments[segmentIndex],
    });
  }

  const firstVisible = stripAnsi(parts[0].segment).trimStart();
  const firstHasOpeningBracket = firstVisible.startsWith('[');
  const firstHasClosingBracket = stripAnsi(parts[0].segment).includes(']');
  if (firstHasOpeningBracket && !firstHasClosingBracket && parts.length > 1) {
    let mergedSegment = parts[0].segment;
    let consumeIndex = 1;
    while (consumeIndex < parts.length) {
      const nextPart = parts[consumeIndex];
      mergedSegment += `${nextPart.separator}${nextPart.segment}`;
      consumeIndex += 1;
      if (stripAnsi(nextPart.segment).includes(']')) {
        break;
      }
    }
    parts = [
      { separator: '', segment: mergedSegment },
      ...parts.slice(consumeIndex),
    ];
  }

  return parts;
}

function wrapLineToWidth(line: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || visualLength(line) <= maxWidth) {
    return [line];
  }

  const parts = splitWrapParts(line);
  if (parts.length <= 1) {
    return [truncateToWidth(line, maxWidth)];
  }

  const wrapped: string[] = [];
  let current = parts[0].segment;

  for (const part of parts.slice(1)) {
    const candidate = `${current}${part.separator}${part.segment}`;
    if (visualLength(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    wrapped.push(truncateToWidth(current, maxWidth));
    current = part.segment;
  }

  if (current) {
    wrapped.push(truncateToWidth(current, maxWidth));
  }

  return wrapped;
}

function makeSeparator(length: number): string {
  return dim('─'.repeat(Math.max(length, 1)));
}

const ACTIVITY_ELEMENTS = new Set<HudElement>(['tools', 'agents', 'todos']);
const COMBINABLE_ELEMENTS = new Set<HudElement>(['project', 'context', 'usage']);

function collectActivityLines(ctx: RenderContext): string[] {
  const activityLines: string[] = [];
  const display = ctx.config?.display;

  if (display?.showTools !== false) {
    const toolsLine = renderToolsLine(ctx);
    if (toolsLine) {
      activityLines.push(toolsLine);
    }
  }

  if (display?.showAgents !== false) {
    const agentsLine = renderAgentsLine(ctx);
    if (agentsLine) {
      activityLines.push(agentsLine);
    }
  }

  if (display?.showTodos !== false) {
    const todosLine = renderTodosLine(ctx);
    if (todosLine) {
      activityLines.push(todosLine);
    }
  }

  return activityLines;
}

function renderElementLine(ctx: RenderContext, element: HudElement): string | null {
  const display = ctx.config?.display;

  switch (element) {
    case 'project':
      return renderProjectLine(ctx);
    case 'context':
      return renderIdentityLine(ctx);
    case 'usage':
      return renderUsageLine(ctx);
    case 'session':
      return renderSessionStatsLine(ctx);
    case 'memory':
      return renderMemoryLine(ctx);
    case 'environment':
      return renderEnvironmentLine(ctx);
    case 'tools':
      return display?.showTools === false ? null : renderToolsLine(ctx);
    case 'agents':
      return display?.showAgents === false ? null : renderAgentsLine(ctx);
    case 'todos':
      return display?.showTodos === false ? null : renderTodosLine(ctx);
  }
}

function renderCompact(ctx: RenderContext): string[] {
  const lines: string[] = [];

  const sessionLine = renderSessionLine(ctx);
  if (sessionLine) {
    lines.push(sessionLine);
  }

  return lines;
}

function renderExpanded(ctx: RenderContext, terminalWidth: number | null = null): Array<{ line: string; isActivity: boolean }> {
  const elementOrder = ctx.config?.elementOrder ?? DEFAULT_ELEMENT_ORDER;
  const seen = new Set<HudElement>();
  const lines: Array<{ line: string; isActivity: boolean }> = [];

  for (let index = 0; index < elementOrder.length; index += 1) {
    const element = elementOrder[index];
    if (seen.has(element)) {
      continue;
    }

    if (COMBINABLE_ELEMENTS.has(element)) {
      let runEnd = index;
      while (
        runEnd < elementOrder.length
        && COMBINABLE_ELEMENTS.has(elementOrder[runEnd])
        && !seen.has(elementOrder[runEnd])
      ) {
        seen.add(elementOrder[runEnd]);
        runEnd += 1;
      }

      const segments = elementOrder
        .slice(index, runEnd)
        .map(e => renderElementLine(ctx, e))
        .filter((l): l is string => Boolean(l));

      let current = '';
      for (const segment of segments) {
        if (!current) {
          current = segment;
          continue;
        }
        const candidate = `${current} │ ${segment}`;
        if (!terminalWidth || visualLength(candidate) <= terminalWidth) {
          current = candidate;
        } else {
          lines.push({ line: current, isActivity: false });
          current = segment;
        }
      }
      if (current) {
        lines.push({ line: current, isActivity: false });
      }

      index = runEnd - 1;
      continue;
    }

    seen.add(element);

    const line = renderElementLine(ctx, element);
    if (!line) {
      continue;
    }

    lines.push({
      line,
      isActivity: ACTIVITY_ELEMENTS.has(element),
    });
  }

  const gitFilesLine = renderGitFilesLine(ctx, terminalWidth);
  if (gitFilesLine) {
    lines.push({ line: gitFilesLine, isActivity: false });
  }

  return lines;
}

export function render(ctx: RenderContext): void {
  const lineLayout = ctx.config?.lineLayout ?? 'expanded';
  const showSeparators = ctx.config?.showSeparators ?? false;
  const fullWidth = ctx.config?.terminalWidth ?? getTerminalWidth();

  const petCfg = ctx.config?.pet;
  const petPosition = petCfg?.position ?? 'right';
  const petMinWidth = petCfg?.minWidth ?? 80;
  const petActive = Boolean(
    ctx.pet
    && petCfg?.enabled
    && (petPosition === 'right'
      ? fullWidth > 0 && fullWidth >= petMinWidth
      : (!fullWidth || fullWidth >= petMinWidth)),
  );
  const petAnchorWidth = petPosition === 'right' && fullWidth
    ? Math.max(0, fullWidth - (petCfg?.rightMargin ?? 8))
    : fullWidth;

  const petArea = petActive
    ? Math.max(
      PET_MIN_AREA,
      Math.min(petCfg?.roamWidth ?? 26, petAnchorWidth ? petAnchorWidth - 60 : PET_MIN_AREA),
    )
    : 0;
  const petRows = petActive && ctx.pet
    ? renderPetArea(
      ctx.pet.state as PetStateName,
      ctx.pet.level as PetLevel,
      Date.now(),
      petArea,
      petPosition,
      petCfg?.style ?? 'cat',
    )
    : null;
  if (petRows) {
    petRows.unshift(petBlankRow(petArea));
  }

  ctx.terminalWidth = petRows && petAnchorWidth
    ? Math.max(20, petAnchorWidth - petArea)
    : fullWidth;
  const terminalWidth = ctx.terminalWidth;

  let lines: string[];

  if (lineLayout === 'expanded') {
    const renderedLines = renderExpanded(ctx, terminalWidth);
    lines = renderedLines.map(({ line }) => line);

    if (showSeparators) {
      const firstActivityIndex = renderedLines.findIndex(({ isActivity }) => isActivity);
      if (firstActivityIndex > 0) {
        const separatorBaseWidth = Math.max(
          ...renderedLines
            .slice(0, firstActivityIndex)
            .map(({ line }) => visualLength(line)),
          20
        );
        const separatorWidth = terminalWidth
          ? Math.min(separatorBaseWidth, terminalWidth)
          : separatorBaseWidth;
        lines.splice(firstActivityIndex, 0, makeSeparator(separatorWidth));
      }
    }
  } else {
    const headerLines = renderCompact(ctx);
    const activityLines = collectActivityLines(ctx);
    lines = [...headerLines];

    if (showSeparators && activityLines.length > 0) {
      const maxWidth = Math.max(...headerLines.map(visualLength), 20);
      const separatorWidth = terminalWidth ? Math.min(maxWidth, terminalWidth) : maxWidth;
      lines.push(makeSeparator(separatorWidth));
    }

    lines.push(...activityLines);
  }

  const physicalLines = lines.flatMap(line => line.split('\n'));
  const visibleLines = physicalLines.flatMap(line => wrapLineToWidth(line, terminalWidth));

  if (petRows) {
    while (visibleLines.length < petRows.length) {
      visibleLines.push('');
    }
  }

  if (petCfg?.debug) {
    const c = getWidthCandidates();
    visibleLines.push(dim(
      `pet dbg full=${fullWidth} anchor=${petAnchorWidth} content=${terminalWidth}`
      + ` env=${c.env ?? '-'} tty=${c.controlling ?? '-'} stdout=${c.stdout ?? '-'}`
      + ` stderr=${c.stderr ?? '-'} active=${petActive ? 'y' : 'n'}`
      + ` state=${ctx.pet?.state ?? '-'}/${ctx.pet?.level ?? '-'}`,
    ));
  }

  for (let i = 0; i < visibleLines.length; i++) {
    if (!petRows) {
      console.log(`${RESET}${visibleLines[i]}`);
    } else if (petPosition === 'left') {
      const prefix = (i < petRows.length ? petRows[i] : petBlankRow(petArea)) + ' ';
      console.log(`${RESET}${prefix}${visibleLines[i]}`);
    } else if (i < petRows.length) {
      const content = truncateToWidth(visibleLines[i], terminalWidth);
      const pad = ' '.repeat(Math.max(0, terminalWidth - visualLength(content)));
      console.log(`${RESET}${content}${pad}${petRows[i]}`);
    } else {
      console.log(`${RESET}${visibleLines[i]}`);
    }
  }
}
