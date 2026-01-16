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
export function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    else {
        return `${secs}s`;
    }
}
/**
 * Format a duration in milliseconds to a human-readable string
 *
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted string like "1h 23m 45s", "23m 45s", or "45s"
 */
export function formatDurationMs(milliseconds) {
    return formatDuration(Math.round(milliseconds / 1000));
}
/**
 * Format an ISO date string to a localized date-time string
 *
 * @param isoDate - ISO date string
 * @returns Formatted date string like "Jan 15, 2026, 10:30 AM"
 */
export function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
/**
 * Format an ISO date string to a short date string (no time)
 *
 * @param isoDate - ISO date string
 * @returns Formatted date string like "Jan 15, 2026"
 */
export function formatShortDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
/**
 * Format an ISO date string to a relative time string
 *
 * @param isoDate - ISO date string
 * @returns Relative time string like "2 hours ago" or "in 5 minutes"
 */
export function formatRelativeTime(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const isFuture = diffMs < 0;
    const abs = (n) => Math.abs(n);
    if (abs(diffDays) > 0) {
        return isFuture ? `in ${abs(diffDays)} day${abs(diffDays) !== 1 ? 's' : ''}` : `${abs(diffDays)} day${abs(diffDays) !== 1 ? 's' : ''} ago`;
    }
    else if (abs(diffHours) > 0) {
        return isFuture ? `in ${abs(diffHours)} hour${abs(diffHours) !== 1 ? 's' : ''}` : `${abs(diffHours)} hour${abs(diffHours) !== 1 ? 's' : ''} ago`;
    }
    else if (abs(diffMins) > 0) {
        return isFuture ? `in ${abs(diffMins)} minute${abs(diffMins) !== 1 ? 's' : ''}` : `${abs(diffMins)} minute${abs(diffMins) !== 1 ? 's' : ''} ago`;
    }
    else {
        return isFuture ? 'in a moment' : 'just now';
    }
}
/**
 * Format a cost value in USD
 *
 * @param cost - Cost in USD
 * @param precision - Number of decimal places (default 4)
 * @returns Formatted cost string like "$1.2345"
 */
export function formatCost(cost, precision = 4) {
    return `$${cost.toFixed(precision)}`;
}
/**
 * Format a byte count to human-readable size
 *
 * @param bytes - Number of bytes
 * @returns Formatted string like "1.5 MB" or "256 KB"
 */
export function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}
/**
 * Format a percentage value
 *
 * @param value - The value (0-100 or 0-1)
 * @param isDecimal - Whether the value is a decimal (0-1) or percentage (0-100)
 * @returns Formatted string like "75%"
 */
export function formatPercent(value, isDecimal = false) {
    const percentage = isDecimal ? value * 100 : value;
    return `${percentage.toFixed(0)}%`;
}
/**
 * Format a number with thousands separator
 *
 * @param num - The number to format
 * @returns Formatted string like "1,234,567"
 */
export function formatNumber(num) {
    return num.toLocaleString('en-US');
}
/**
 * Truncate a string to a maximum length with ellipsis
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length (default 60)
 * @param suffix - Suffix to add when truncated (default "...")
 * @returns Truncated string
 */
export function truncate(str, maxLength = 60, suffix = '...') {
    if (str.length <= maxLength) {
        return str;
    }
    return str.substring(0, maxLength - suffix.length) + suffix;
}
/**
 * Pad a string to a fixed width
 *
 * @param str - The string to pad
 * @param width - Target width
 * @param align - Alignment ('left', 'right', or 'center')
 * @param char - Character to use for padding (default space)
 * @returns Padded string
 */
export function pad(str, width, align = 'left', char = ' ') {
    if (str.length >= width) {
        return str;
    }
    const padding = width - str.length;
    switch (align) {
        case 'right':
            return char.repeat(padding) + str;
        case 'center': {
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return char.repeat(leftPad) + str + char.repeat(rightPad);
        }
        case 'left':
        default:
            return str + char.repeat(padding);
    }
}
/**
 * Parse a relative time string (e.g., "7d", "2w", "1m", "24h") to a Date
 *
 * @param since - Relative time string or ISO date string
 * @returns Date object or null if parsing fails
 */
export function parseSince(since) {
    if (!since)
        return null;
    // Try relative format first (e.g., "7d", "2w", "1m")
    const relativeMatch = since.match(/^(\d+)([dwmhDWMH])$/);
    if (relativeMatch) {
        const value = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();
        const now = new Date();
        switch (unit) {
            case 'h':
                now.setHours(now.getHours() - value);
                break;
            case 'd':
                now.setDate(now.getDate() - value);
                break;
            case 'w':
                now.setDate(now.getDate() - value * 7);
                break;
            case 'm':
                now.setMonth(now.getMonth() - value);
                break;
            default:
                return null;
        }
        return now;
    }
    // Try ISO date format (e.g., "2024-01-01")
    const dateMatch = since.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateMatch) {
        const parsed = new Date(since);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    // Try full ISO datetime format
    const parsed = new Date(since);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    return null;
}
/**
 * Create a horizontal line of a given character and length
 *
 * @param length - Length of the line (default 78)
 * @param char - Character to use (default Unicode box drawing character)
 * @returns The horizontal line string
 */
export function horizontalLine(length = 78, char = '─') {
    return char.repeat(length);
}
//# sourceMappingURL=formatting.js.map