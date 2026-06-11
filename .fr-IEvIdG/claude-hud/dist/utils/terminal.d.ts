export declare const UNKNOWN_TERMINAL_WIDTH = 100;
export interface WidthCandidates {
    stdout: number | null;
    env: number | null;
    stderr: number | null;
    controlling: number | null;
}
export declare function getWidthCandidates(): WidthCandidates;
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
export declare function getTerminalWidth(): number;
/** Returns a progress bar width scaled to terminal columns. Wide (>=100): 10, Medium (60-99): 6, Narrow (<60): 4. */
export declare function getAdaptiveBarWidth(cols?: number): number;
//# sourceMappingURL=terminal.d.ts.map