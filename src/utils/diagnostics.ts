/**
 * Diagnostic logging utilities for ChadGI.
 *
 * Provides structured logging for silent catch handlers to aid debugging
 * while maintaining intentional error suppression behavior.
 *
 * Usage:
 * - Replace bare `catch { }` blocks with `catch (e) { logSilentError(e, context, category) }`
 * - Errors are only logged when verbose mode is enabled
 * - An in-memory registry tracks all silent errors for diagnostic reporting
 *
 * Example:
 * ```ts
 * try {
 *   // Optional parsing that may fail
 *   const data = JSON.parse(content);
 * } catch (e) {
 *   // Parsing is optional, failure is expected for some inputs
 *   logSilentError(e, 'parsing optional config field', ErrorCategory.EXPECTED);
 * }
 * ```
 */

import { isVerbose } from './debug.js';
import { colors } from './colors.js';

// ============================================================================
// Error Categories
// ============================================================================

/**
 * Categories for silent errors to help with debugging and diagnostics.
 *
 * - EXPECTED: Known/acceptable failures (e.g., optional field missing, fallback path)
 * - RETRIABLE: Transient failures that may succeed on retry (e.g., rate limiting)
 * - TRANSIENT: Network/timing issues (e.g., connection timeout, DNS resolution)
 * - UNKNOWN: Unexpected failures needing investigation
 */
export enum ErrorCategory {
  /** Known/acceptable failures that are part of normal operation */
  EXPECTED = 'expected',
  /** Transient failures that may succeed on retry */
  RETRIABLE = 'retriable',
  /** Network/timing issues */
  TRANSIENT = 'transient',
  /** Unexpected failures needing investigation */
  UNKNOWN = 'unknown',
}

// ============================================================================
// Error Registry
// ============================================================================

/**
 * Entry in the silent error registry
 */
export interface SilentErrorEntry {
  /** When the error occurred */
  timestamp: Date;
  /** Error message or string representation */
  message: string;
  /** Context description of where/why the error occurred */
  context: string;
  /** Category of the error */
  category: ErrorCategory;
  /** Optional stack trace (only captured for UNKNOWN errors) */
  stack?: string;
}

/**
 * Summary of errors by category
 */
export interface ErrorSummary {
  /** Total number of silent errors logged */
  total: number;
  /** Count by category */
  byCategory: Record<ErrorCategory, number>;
  /** Recent errors (last N entries) */
  recentErrors: SilentErrorEntry[];
}

/**
 * In-memory registry for tracking silent errors during a session.
 * This allows diagnostic dumps and summaries without exposing errors
 * during normal operation.
 */
const errorRegistry: SilentErrorEntry[] = [];

/**
 * Maximum number of errors to keep in the registry to prevent memory issues
 */
const MAX_REGISTRY_SIZE = 1000;

/**
 * Number of recent errors to include in summary
 */
const RECENT_ERRORS_COUNT = 10;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Extract error message from unknown error value.
 *
 * @param error - The error value (may be Error, string, or any type)
 * @returns A string representation of the error
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Extract stack trace from error if available.
 *
 * @param error - The error value
 * @returns Stack trace string or undefined
 */
function extractStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return undefined;
}

/**
 * Log a silent error with context for diagnostic purposes.
 *
 * This function is designed to replace bare `catch { }` blocks to provide
 * visibility into intentionally suppressed errors when debugging is enabled.
 *
 * The error is:
 * 1. Logged to stderr (only when verbose mode is enabled)
 * 2. Registered in the in-memory error registry for diagnostic dumps
 *
 * @param error - The error object (can be Error, string, or any value)
 * @param context - Description of where/why the error occurred
 * @param category - Category of the error (default: UNKNOWN)
 *
 * @example
 * ```ts
 * // In a catch block where errors are intentionally suppressed
 * try {
 *   const labels = getIssueLabels(issueNumber, repo);
 * } catch (e) {
 *   // Label fetching is optional, proceed without labels
 *   logSilentError(e, 'fetching issue labels', ErrorCategory.EXPECTED);
 * }
 * ```
 */
export function logSilentError(
  error: unknown,
  context: string,
  category: ErrorCategory = ErrorCategory.UNKNOWN
): void {
  const message = extractErrorMessage(error);
  const entry: SilentErrorEntry = {
    timestamp: new Date(),
    message,
    context,
    category,
  };

  // Only capture stack for UNKNOWN errors (unexpected issues)
  if (category === ErrorCategory.UNKNOWN) {
    entry.stack = extractStack(error);
  }

  // Register the error for diagnostic summary
  registerError(entry);

  // Log to stderr only when verbose mode is enabled
  if (isVerbose()) {
    const categoryColor = getCategoryColor(category);
    const prefix = `${colors.dim}[silent-${category}]${colors.reset}`;
    const contextStr = `${categoryColor}${context}${colors.reset}`;
    const messageStr = `${colors.dim}${message}${colors.reset}`;

    process.stderr.write(`${prefix} ${contextStr}: ${messageStr}\n`);
  }
}

/**
 * Get the color code for a category (for terminal output).
 *
 * @param category - The error category
 * @returns ANSI color code string
 */
function getCategoryColor(category: ErrorCategory): string {
  switch (category) {
    case ErrorCategory.EXPECTED:
      return colors.dim;
    case ErrorCategory.RETRIABLE:
      return colors.yellow;
    case ErrorCategory.TRANSIENT:
      return colors.cyan;
    case ErrorCategory.UNKNOWN:
      return colors.red;
    default:
      return colors.reset;
  }
}

// ============================================================================
// Registry Management
// ============================================================================

/**
 * Register an error entry in the in-memory registry.
 *
 * @param entry - The error entry to register
 */
function registerError(entry: SilentErrorEntry): void {
  errorRegistry.push(entry);

  // Prevent unbounded growth
  if (errorRegistry.length > MAX_REGISTRY_SIZE) {
    // Remove oldest entries when limit is exceeded
    errorRegistry.splice(0, errorRegistry.length - MAX_REGISTRY_SIZE);
  }
}

/**
 * Get a summary of all silent errors logged during the session.
 *
 * This is useful for diagnostic dumps and debugging summaries.
 *
 * @returns Summary of errors by category with recent entries
 *
 * @example
 * ```ts
 * const summary = getSilentErrorSummary();
 * if (summary.total > 0) {
 *   console.log(`${summary.total} silent errors occurred`);
 *   console.log(`Unknown errors: ${summary.byCategory.unknown}`);
 * }
 * ```
 */
export function getSilentErrorSummary(): ErrorSummary {
  const byCategory: Record<ErrorCategory, number> = {
    [ErrorCategory.EXPECTED]: 0,
    [ErrorCategory.RETRIABLE]: 0,
    [ErrorCategory.TRANSIENT]: 0,
    [ErrorCategory.UNKNOWN]: 0,
  };

  for (const entry of errorRegistry) {
    byCategory[entry.category]++;
  }

  return {
    total: errorRegistry.length,
    byCategory,
    recentErrors: errorRegistry.slice(-RECENT_ERRORS_COUNT),
  };
}

/**
 * Get all errors in the registry.
 *
 * Use with caution as this returns all entries which could be large.
 * Prefer getSilentErrorSummary() for diagnostic output.
 *
 * @returns Copy of all error entries in the registry
 */
export function getAllSilentErrors(): SilentErrorEntry[] {
  return [...errorRegistry];
}

/**
 * Clear all errors from the registry.
 *
 * Useful for resetting between test runs or sessions.
 */
export function clearSilentErrors(): void {
  errorRegistry.length = 0;
}

/**
 * Get the count of errors by category.
 *
 * @param category - The category to count (optional, counts all if not specified)
 * @returns Number of errors matching the category
 */
export function getSilentErrorCount(category?: ErrorCategory): number {
  if (category === undefined) {
    return errorRegistry.length;
  }
  return errorRegistry.filter((e) => e.category === category).length;
}

/**
 * Check if any unknown (unexpected) errors have been logged.
 *
 * This is useful for detecting potential bugs that are being silently suppressed.
 *
 * @returns true if any UNKNOWN category errors exist
 */
export function hasUnknownErrors(): boolean {
  return errorRegistry.some((e) => e.category === ErrorCategory.UNKNOWN);
}

/**
 * Format the error summary for display.
 *
 * @param summary - The error summary to format
 * @returns Formatted string suitable for console output
 */
export function formatErrorSummary(summary: ErrorSummary): string {
  if (summary.total === 0) {
    return 'No silent errors logged.';
  }

  const lines: string[] = [];
  lines.push(`Silent Error Summary (${summary.total} total):`);
  lines.push(`  Expected:  ${summary.byCategory[ErrorCategory.EXPECTED]}`);
  lines.push(`  Retriable: ${summary.byCategory[ErrorCategory.RETRIABLE]}`);
  lines.push(`  Transient: ${summary.byCategory[ErrorCategory.TRANSIENT]}`);
  lines.push(`  Unknown:   ${summary.byCategory[ErrorCategory.UNKNOWN]}`);

  if (summary.recentErrors.length > 0) {
    lines.push('');
    lines.push('Recent errors:');
    for (const entry of summary.recentErrors) {
      const time = entry.timestamp.toISOString().split('T')[1].split('.')[0];
      lines.push(`  [${time}] [${entry.category}] ${entry.context}: ${entry.message}`);
    }
  }

  return lines.join('\n');
}
