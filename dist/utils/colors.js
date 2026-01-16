/**
 * Shared terminal color definitions for consistent output formatting across ChadGI commands.
 *
 * Uses ANSI escape codes for terminal coloring.
 */
export const colors = {
    // Reset
    reset: '\x1b[0m',
    // Text styles
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    // Colors
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    purple: '\x1b[35m',
    magenta: '\x1b[35m', // alias for purple
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
};
//# sourceMappingURL=colors.js.map