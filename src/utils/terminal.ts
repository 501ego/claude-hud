export const UNKNOWN_TERMINAL_WIDTH = 100

/**
 * Returns the current terminal column width.
 * Checks stdout, then stderr (reliable when stdout is piped), then $COLUMNS env var.
 */
export function getTerminalWidth(): number {
  const stdoutCols = process.stdout?.columns
  if (typeof stdoutCols === 'number' && Number.isFinite(stdoutCols) && stdoutCols > 0) {
    return Math.floor(stdoutCols)
  }

  // When running as a statusline subprocess, stdout is piped but stderr is
  // still connected to the real terminal — use it to get the actual width.
  const stderrCols = process.stderr?.columns
  if (typeof stderrCols === 'number' && Number.isFinite(stderrCols) && stderrCols > 0) {
    return Math.floor(stderrCols)
  }

  const envCols = Number.parseInt(process.env.COLUMNS ?? '', 10)
  if (Number.isFinite(envCols) && envCols > 0) {
    return envCols
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
