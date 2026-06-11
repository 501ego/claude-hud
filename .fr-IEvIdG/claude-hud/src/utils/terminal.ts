import * as fs from 'node:fs'
import * as tty from 'node:tty'

export const UNKNOWN_TERMINAL_WIDTH = 100

function validCols(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null
}

/**
 * Query the controlling terminal directly (CONOUT$ on Windows, /dev/tty on
 * POSIX). This is the physical truth even when stdout/stderr are pipes or
 * belong to an intermediate pty of a different size — the common situation
 * for a statusline subprocess.
 */
function queryControllingTerminal(): number | null {
  const ttyPath = process.platform === 'win32' ? '\\\\.\\CONOUT$' : '/dev/tty'
  let fd: number | null = null
  try {
    fd = fs.openSync(ttyPath, 'w')
    if (!tty.isatty(fd)) {
      fs.closeSync(fd)
      return null
    }
    const stream = new tty.WriteStream(fd)
    const cols = validCols(stream.columns)
    stream.destroy()
    return cols
  } catch {
    if (fd !== null) {
      try { fs.closeSync(fd) } catch { void 0 }
    }
    return null
  }
}

export interface WidthCandidates {
  stdout: number | null
  env: number | null
  stderr: number | null
  controlling: number | null
}

export function getWidthCandidates(): WidthCandidates {
  return {
    stdout: validCols(process.stdout?.columns),
    env: validCols(Number.parseInt(process.env.COLUMNS ?? '', 10)),
    stderr: validCols(process.stderr?.columns),
    controlling: queryControllingTerminal(),
  }
}

/**
 * Returns the current terminal column width.
 *
 * A real stdout tty is authoritative (interactive case). For the statusline
 * case Claude Code captures stdio and communicates width via $COLUMNS
 * (v2.1.153+) — but that value can go stale across live terminal resizes,
 * while a direct controlling-terminal query (CONOUT$ / /dev/tty) is always
 * fresh. Neither source is reliable alone, so take the MINIMUM of the
 * available ones: overflowing the real width hides content behind Claude
 * Code's ellipsis truncation, while undershooting merely leaves a gap.
 */
export function getTerminalWidth(): number {
  const c = getWidthCandidates()
  if (c.stdout !== null) {
    return c.stdout
  }

  const pool = [c.env, c.controlling, c.stderr].filter((v): v is number => v !== null)
  if (pool.length > 0) {
    return Math.min(...pool)
  }

  return UNKNOWN_TERMINAL_WIDTH
}

/** Returns a progress bar width scaled to terminal columns. Wide (>=100): 10, Medium (60-99): 6, Narrow (<60): 4. */
export function getAdaptiveBarWidth(cols?: number): number {
  const width = cols ?? getTerminalWidth()
  if (width >= 100) return 10
  if (width >= 60) return 6
  return 4
}
