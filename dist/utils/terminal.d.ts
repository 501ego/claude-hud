export declare const UNKNOWN_TERMINAL_WIDTH = 100;
/**
 * Returns the current terminal column width.
 * Checks stdout, then stderr (reliable when stdout is piped), then $COLUMNS env var.
 */
export declare function getTerminalWidth(): number;
/** Returns a progress bar width scaled to terminal columns. Wide (>=100): 10, Medium (60-99): 6, Narrow (<60): 4. */
export declare function getAdaptiveBarWidth(cols?: number): number;
//# sourceMappingURL=terminal.d.ts.map