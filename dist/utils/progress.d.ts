/**
 * Progress bar utility for ChadGI.
 *
 * Provides a terminal progress bar with percentage display, spinner for indeterminate mode,
 * and support for showing the current item being processed.
 *
 * Features:
 * - Displays progress bar with percentage: [████████░░░░░░░░░░░░] 40% (4/10)
 * - Shows current item being processed
 * - Updates in-place (single line) using terminal escape sequences
 * - Supports indeterminate mode (spinner) for unknown totals
 * - Respects --json flag (disabled when JSON output is enabled)
 * - Cleans up properly (clears line on completion/error)
 */
/** Progress bar options */
export interface ProgressBarOptions {
    /** Label to display before the progress bar */
    label?: string;
    /** Width of the progress bar in characters (default: 30) */
    width?: number;
    /** Whether to show the current/total count (default: true) */
    showCount?: boolean;
    /** Whether to show percentage (default: true) */
    showPercent?: boolean;
    /** Character for filled portion of the bar (default: '█') */
    filledChar?: string;
    /** Character for empty portion of the bar (default: '░') */
    emptyChar?: string;
    /** Stream to write to (default: process.stdout) */
    stream?: NodeJS.WriteStream;
}
/**
 * Progress bar class for displaying progress of long-running operations.
 *
 * @example
 * ```typescript
 * const progress = new ProgressBar(10, { label: 'Processing' });
 * for (let i = 0; i < 10; i++) {
 *   progress.update(i + 1, `item-${i}`);
 *   await doWork();
 * }
 * progress.complete();
 * ```
 */
export declare class ProgressBar {
    private current;
    private total;
    private width;
    private label;
    private showCount;
    private showPercent;
    private filledChar;
    private emptyChar;
    private stream;
    private isCompleted;
    private lastOutput;
    /**
     * Create a new progress bar.
     *
     * @param total - Total number of items to process
     * @param options - Configuration options
     */
    constructor(total: number, options?: ProgressBarOptions);
    /**
     * Check if progress bar should be rendered.
     * Returns false in non-TTY environments (e.g., piped output, CI).
     */
    private shouldRender;
    /**
     * Clear the current line.
     */
    private clearLine;
    /**
     * Update the progress bar.
     *
     * @param current - Current progress value (0 to total)
     * @param item - Optional current item label to display
     */
    update(current: number, item?: string): void;
    /**
     * Increment the progress by a specified amount.
     *
     * @param amount - Amount to increment (default: 1)
     * @param item - Optional current item label to display
     */
    increment(amount?: number, item?: string): void;
    /**
     * Mark the progress bar as complete and move to next line.
     *
     * @param message - Optional completion message to display
     */
    complete(message?: string): void;
    /**
     * Mark the progress bar as failed and display error message.
     *
     * @param message - Error message to display
     */
    fail(message?: string): void;
    /**
     * Get current progress value.
     */
    getCurrent(): number;
    /**
     * Get total value.
     */
    getTotal(): number;
    /**
     * Check if progress bar has been completed.
     */
    isDone(): boolean;
}
/**
 * Spinner class for indeterminate progress (when total is unknown).
 *
 * @example
 * ```typescript
 * const spinner = new Spinner('Loading');
 * spinner.start();
 * await doWork();
 * spinner.stop('Done!');
 * ```
 */
export declare class Spinner {
    private frame;
    private label;
    private stream;
    private intervalId;
    private isRunning;
    private interval;
    /**
     * Create a new spinner.
     *
     * @param label - Label to display next to the spinner
     * @param options - Configuration options
     */
    constructor(label?: string, options?: {
        stream?: NodeJS.WriteStream;
        interval?: number;
    });
    /**
     * Check if spinner should be rendered.
     */
    private shouldRender;
    /**
     * Clear the current line.
     */
    private clearLine;
    /**
     * Render the current spinner frame.
     */
    private render;
    /**
     * Start the spinner animation.
     *
     * @param label - Optional new label to display
     */
    start(label?: string): void;
    /**
     * Update the spinner label without stopping.
     *
     * @param label - New label to display
     */
    update(label: string): void;
    /**
     * Stop the spinner and optionally display a completion message.
     *
     * @param message - Optional message to display (replaces spinner)
     * @param isSuccess - Whether to show as success (green) or plain text
     */
    stop(message?: string, isSuccess?: boolean): void;
    /**
     * Stop the spinner and display an error message.
     *
     * @param message - Error message to display
     */
    fail(message?: string): void;
    /**
     * Check if spinner is currently running.
     */
    isActive(): boolean;
}
/**
 * Create a progress bar only if the stream is a TTY and JSON mode is not enabled.
 * Returns null if progress bar should not be displayed.
 *
 * @param total - Total number of items
 * @param options - Progress bar options
 * @param jsonMode - Whether JSON output mode is enabled
 * @returns ProgressBar instance or null
 */
export declare function createProgressBar(total: number, options?: ProgressBarOptions, jsonMode?: boolean): ProgressBar | null;
/**
 * Create a spinner only if the stream is a TTY and JSON mode is not enabled.
 * Returns null if spinner should not be displayed.
 *
 * @param label - Label to display
 * @param options - Spinner options
 * @param jsonMode - Whether JSON output mode is enabled
 * @returns Spinner instance or null
 */
export declare function createSpinner(label?: string, options?: {
    stream?: NodeJS.WriteStream;
    interval?: number;
}, jsonMode?: boolean): Spinner | null;
//# sourceMappingURL=progress.d.ts.map