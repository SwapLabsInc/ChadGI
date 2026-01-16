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
/**
 * Categories for silent errors to help with debugging and diagnostics.
 *
 * - EXPECTED: Known/acceptable failures (e.g., optional field missing, fallback path)
 * - RETRIABLE: Transient failures that may succeed on retry (e.g., rate limiting)
 * - TRANSIENT: Network/timing issues (e.g., connection timeout, DNS resolution)
 * - UNKNOWN: Unexpected failures needing investigation
 */
export declare enum ErrorCategory {
    /** Known/acceptable failures that are part of normal operation */
    EXPECTED = "expected",
    /** Transient failures that may succeed on retry */
    RETRIABLE = "retriable",
    /** Network/timing issues */
    TRANSIENT = "transient",
    /** Unexpected failures needing investigation */
    UNKNOWN = "unknown"
}
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
export declare function logSilentError(error: unknown, context: string, category?: ErrorCategory): void;
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
export declare function getSilentErrorSummary(): ErrorSummary;
/**
 * Get all errors in the registry.
 *
 * Use with caution as this returns all entries which could be large.
 * Prefer getSilentErrorSummary() for diagnostic output.
 *
 * @returns Copy of all error entries in the registry
 */
export declare function getAllSilentErrors(): SilentErrorEntry[];
/**
 * Clear all errors from the registry.
 *
 * Useful for resetting between test runs or sessions.
 */
export declare function clearSilentErrors(): void;
/**
 * Get the count of errors by category.
 *
 * @param category - The category to count (optional, counts all if not specified)
 * @returns Number of errors matching the category
 */
export declare function getSilentErrorCount(category?: ErrorCategory): number;
/**
 * Check if any unknown (unexpected) errors have been logged.
 *
 * This is useful for detecting potential bugs that are being silently suppressed.
 *
 * @returns true if any UNKNOWN category errors exist
 */
export declare function hasUnknownErrors(): boolean;
/**
 * Format the error summary for display.
 *
 * @param summary - The error summary to format
 * @returns Formatted string suitable for console output
 */
export declare function formatErrorSummary(summary: ErrorSummary): string;
//# sourceMappingURL=diagnostics.d.ts.map