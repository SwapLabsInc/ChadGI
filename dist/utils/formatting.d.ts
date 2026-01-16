/**
 * Formatting utilities for ChadGI.
 *
 * Provides functions for formatting dates, durations, costs, and other values
 * for consistent display across all command modules.
 */
/**
 * Format a duration in seconds to a human-readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string like "1h 23m 45s", "23m 45s", or "45s"
 */
export declare function formatDuration(seconds: number): string;
/**
 * Format a duration in milliseconds to a human-readable string
 *
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted string like "1h 23m 45s", "23m 45s", or "45s"
 */
export declare function formatDurationMs(milliseconds: number): string;
/**
 * Format an ISO date string to a localized date-time string
 *
 * @param isoDate - ISO date string
 * @returns Formatted date string like "Jan 15, 2026, 10:30 AM"
 */
export declare function formatDate(isoDate: string): string;
/**
 * Format an ISO date string to a short date string (no time)
 *
 * @param isoDate - ISO date string
 * @returns Formatted date string like "Jan 15, 2026"
 */
export declare function formatShortDate(isoDate: string): string;
/**
 * Format an ISO date string to a relative time string
 *
 * @param isoDate - ISO date string
 * @returns Relative time string like "2 hours ago" or "in 5 minutes"
 */
export declare function formatRelativeTime(isoDate: string): string;
/**
 * Format a cost value in USD
 *
 * @param cost - Cost in USD
 * @param precision - Number of decimal places (default 4)
 * @returns Formatted cost string like "$1.2345"
 */
export declare function formatCost(cost: number, precision?: number): string;
/**
 * Format a byte count to human-readable size
 *
 * @param bytes - Number of bytes
 * @returns Formatted string like "1.5 MB" or "256 KB"
 */
export declare function formatBytes(bytes: number): string;
/**
 * Format a percentage value
 *
 * @param value - The value (0-100 or 0-1)
 * @param isDecimal - Whether the value is a decimal (0-1) or percentage (0-100)
 * @returns Formatted string like "75%"
 */
export declare function formatPercent(value: number, isDecimal?: boolean): string;
/**
 * Format a number with thousands separator
 *
 * @param num - The number to format
 * @returns Formatted string like "1,234,567"
 */
export declare function formatNumber(num: number): string;
/**
 * Truncate a string to a maximum length with ellipsis
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length (default 60)
 * @param suffix - Suffix to add when truncated (default "...")
 * @returns Truncated string
 */
export declare function truncate(str: string, maxLength?: number, suffix?: string): string;
/**
 * Pad a string to a fixed width
 *
 * @param str - The string to pad
 * @param width - Target width
 * @param align - Alignment ('left', 'right', or 'center')
 * @param char - Character to use for padding (default space)
 * @returns Padded string
 */
export declare function pad(str: string, width: number, align?: 'left' | 'right' | 'center', char?: string): string;
/**
 * Parse a relative time string (e.g., "7d", "2w", "1m", "24h") to a Date
 *
 * @param since - Relative time string or ISO date string
 * @returns Date object or null if parsing fails
 */
export declare function parseSince(since: string): Date | null;
/**
 * Create a horizontal line of a given character and length
 *
 * @param length - Length of the line (default 78)
 * @param char - Character to use (default Unicode box drawing character)
 * @returns The horizontal line string
 */
export declare function horizontalLine(length?: number, char?: string): string;
//# sourceMappingURL=formatting.d.ts.map