/**
 * Shared terminal color definitions for consistent output formatting across ChadGI commands.
 *
 * Uses ANSI escape codes for terminal coloring.
 */
export declare const colors: {
    readonly reset: "\u001B[0m";
    readonly bold: "\u001B[1m";
    readonly dim: "\u001B[2m";
    readonly red: "\u001B[31m";
    readonly green: "\u001B[32m";
    readonly yellow: "\u001B[33m";
    readonly blue: "\u001B[34m";
    readonly purple: "\u001B[35m";
    readonly magenta: "\u001B[35m";
    readonly cyan: "\u001B[36m";
    readonly white: "\u001B[37m";
    readonly gray: "\u001B[90m";
    readonly bgRed: "\u001B[41m";
    readonly bgGreen: "\u001B[42m";
};
export type ColorName = keyof typeof colors;
//# sourceMappingURL=colors.d.ts.map