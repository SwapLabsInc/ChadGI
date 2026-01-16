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

import { colors } from './colors.js';

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

/** Spinner frames for indeterminate mode */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

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
export class ProgressBar {
  private current = 0;
  private total: number;
  private width: number;
  private label: string;
  private showCount: boolean;
  private showPercent: boolean;
  private filledChar: string;
  private emptyChar: string;
  private stream: NodeJS.WriteStream;
  private isCompleted = false;
  private lastOutput = '';

  /**
   * Create a new progress bar.
   *
   * @param total - Total number of items to process
   * @param options - Configuration options
   */
  constructor(total: number, options: ProgressBarOptions = {}) {
    this.total = total;
    this.width = options.width ?? 30;
    this.label = options.label ?? '';
    this.showCount = options.showCount ?? true;
    this.showPercent = options.showPercent ?? true;
    this.filledChar = options.filledChar ?? '█';
    this.emptyChar = options.emptyChar ?? '░';
    this.stream = options.stream ?? process.stdout;
  }

  /**
   * Check if progress bar should be rendered.
   * Returns false in non-TTY environments (e.g., piped output, CI).
   */
  private shouldRender(): boolean {
    return this.stream.isTTY === true && !this.isCompleted;
  }

  /**
   * Clear the current line.
   */
  private clearLine(): void {
    if (!this.stream.isTTY) return;
    // Move cursor to beginning of line and clear to end
    this.stream.write('\r\x1b[K');
  }

  /**
   * Update the progress bar.
   *
   * @param current - Current progress value (0 to total)
   * @param item - Optional current item label to display
   */
  update(current: number, item?: string): void {
    if (!this.shouldRender()) return;

    this.current = Math.min(Math.max(0, current), this.total);

    const percent = this.total > 0 ? Math.round((this.current / this.total) * 100) : 0;
    const filled = this.total > 0 ? Math.round((this.current / this.total) * this.width) : 0;
    const empty = this.width - filled;

    const bar = this.filledChar.repeat(filled) + this.emptyChar.repeat(empty);

    let output = '';

    // Add label if provided
    if (this.label) {
      output += `${this.label} `;
    }

    // Add progress bar
    output += `[${bar}]`;

    // Add percentage
    if (this.showPercent) {
      output += ` ${percent}%`;
    }

    // Add count
    if (this.showCount) {
      output += ` (${this.current}/${this.total})`;
    }

    // Add current item
    if (item) {
      // Truncate item if it would make the line too long
      const maxItemLength = Math.max(20, (this.stream.columns || 80) - output.length - 3);
      const truncatedItem = item.length > maxItemLength
        ? item.substring(0, maxItemLength - 3) + '...'
        : item;
      output += ` ${colors.dim}${truncatedItem}${colors.reset}`;
    }

    // Only update if output changed
    if (output !== this.lastOutput) {
      this.clearLine();
      this.stream.write(output);
      this.lastOutput = output;
    }
  }

  /**
   * Increment the progress by a specified amount.
   *
   * @param amount - Amount to increment (default: 1)
   * @param item - Optional current item label to display
   */
  increment(amount: number = 1, item?: string): void {
    this.update(this.current + amount, item);
  }

  /**
   * Mark the progress bar as complete and move to next line.
   *
   * @param message - Optional completion message to display
   */
  complete(message?: string): void {
    if (this.isCompleted) return;
    this.isCompleted = true;

    if (!this.stream.isTTY) return;

    this.clearLine();

    if (message) {
      this.stream.write(`${colors.green}${message}${colors.reset}\n`);
    } else {
      // Show completed bar
      this.update(this.total);
      this.stream.write('\n');
    }
  }

  /**
   * Mark the progress bar as failed and display error message.
   *
   * @param message - Error message to display
   */
  fail(message?: string): void {
    if (this.isCompleted) return;
    this.isCompleted = true;

    if (!this.stream.isTTY) return;

    this.clearLine();

    if (message) {
      this.stream.write(`${colors.red}${message}${colors.reset}\n`);
    } else {
      this.stream.write(`${colors.red}Failed${colors.reset}\n`);
    }
  }

  /**
   * Get current progress value.
   */
  getCurrent(): number {
    return this.current;
  }

  /**
   * Get total value.
   */
  getTotal(): number {
    return this.total;
  }

  /**
   * Check if progress bar has been completed.
   */
  isDone(): boolean {
    return this.isCompleted;
  }
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
export class Spinner {
  private frame = 0;
  private label: string;
  private stream: NodeJS.WriteStream;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private interval: number;

  /**
   * Create a new spinner.
   *
   * @param label - Label to display next to the spinner
   * @param options - Configuration options
   */
  constructor(label: string = '', options: { stream?: NodeJS.WriteStream; interval?: number } = {}) {
    this.label = label;
    this.stream = options.stream ?? process.stdout;
    this.interval = options.interval ?? 80;
  }

  /**
   * Check if spinner should be rendered.
   */
  private shouldRender(): boolean {
    return this.stream.isTTY === true;
  }

  /**
   * Clear the current line.
   */
  private clearLine(): void {
    if (!this.stream.isTTY) return;
    this.stream.write('\r\x1b[K');
  }

  /**
   * Render the current spinner frame.
   */
  private render(): void {
    if (!this.shouldRender()) return;

    const spinnerChar = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
    this.clearLine();
    this.stream.write(`${colors.cyan}${spinnerChar}${colors.reset} ${this.label}`);
    this.frame++;
  }

  /**
   * Start the spinner animation.
   *
   * @param label - Optional new label to display
   */
  start(label?: string): void {
    if (this.isRunning) return;

    if (label !== undefined) {
      this.label = label;
    }

    if (!this.shouldRender()) {
      // In non-TTY mode, just print the label once
      if (this.label) {
        this.stream.write(`${this.label}...\n`);
      }
      return;
    }

    this.isRunning = true;
    this.frame = 0;
    this.render();

    this.intervalId = setInterval(() => {
      this.render();
    }, this.interval);
  }

  /**
   * Update the spinner label without stopping.
   *
   * @param label - New label to display
   */
  update(label: string): void {
    this.label = label;
    if (this.isRunning && this.shouldRender()) {
      this.render();
    }
  }

  /**
   * Stop the spinner and optionally display a completion message.
   *
   * @param message - Optional message to display (replaces spinner)
   * @param isSuccess - Whether to show as success (green) or plain text
   */
  stop(message?: string, isSuccess: boolean = true): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (!this.shouldRender()) return;

    this.clearLine();

    if (message) {
      const color = isSuccess ? colors.green : colors.reset;
      this.stream.write(`${color}${message}${colors.reset}\n`);
    }
  }

  /**
   * Stop the spinner and display an error message.
   *
   * @param message - Error message to display
   */
  fail(message?: string): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (!this.shouldRender()) return;

    this.clearLine();

    if (message) {
      this.stream.write(`${colors.red}${message}${colors.reset}\n`);
    } else {
      this.stream.write(`${colors.red}Failed${colors.reset}\n`);
    }
  }

  /**
   * Check if spinner is currently running.
   */
  isActive(): boolean {
    return this.isRunning;
  }
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
export function createProgressBar(
  total: number,
  options: ProgressBarOptions = {},
  jsonMode: boolean = false
): ProgressBar | null {
  const stream = options.stream ?? process.stdout;

  // Don't create progress bar in JSON mode or non-TTY environments
  if (jsonMode || !stream.isTTY) {
    return null;
  }

  return new ProgressBar(total, options);
}

/**
 * Create a spinner only if the stream is a TTY and JSON mode is not enabled.
 * Returns null if spinner should not be displayed.
 *
 * @param label - Label to display
 * @param options - Spinner options
 * @param jsonMode - Whether JSON output mode is enabled
 * @returns Spinner instance or null
 */
export function createSpinner(
  label: string = '',
  options: { stream?: NodeJS.WriteStream; interval?: number } = {},
  jsonMode: boolean = false
): Spinner | null {
  const stream = options.stream ?? process.stdout;

  // Don't create spinner in JSON mode or non-TTY environments
  if (jsonMode || !stream.isTTY) {
    return null;
  }

  return new Spinner(label, options);
}
