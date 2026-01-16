/**
 * Centralized CLI error handler for ChadGI commands.
 *
 * Provides a wrapper function to reduce boilerplate error handling across all
 * CLI command action handlers, with proper error type detection, exit codes,
 * and optional JSON output support.
 */
/**
 * Exit codes for different error types.
 * Following common Unix conventions:
 * - 1: General errors
 * - 2: Validation/usage errors
 */
export declare const EXIT_CODES: {
    readonly SUCCESS: 0;
    readonly GENERAL_ERROR: 1;
    readonly VALIDATION_ERROR: 2;
};
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
/**
 * Error output format for JSON mode.
 */
export interface JsonErrorOutput {
    error: true;
    code: string;
    message: string;
}
/**
 * Determines the appropriate exit code based on error type.
 *
 * @param error - The error to analyze
 * @returns Exit code (1 for general errors, 2 for validation errors)
 */
export declare function getExitCode(error: unknown): ExitCode;
/**
 * Formats an error for console output with color.
 *
 * @param error - The error to format
 * @returns Formatted error string with color codes
 */
export declare function formatError(error: unknown): string;
/**
 * Formats an error as JSON for structured output.
 *
 * @param error - The error to format
 * @returns JSON error object
 */
export declare function formatErrorJson(error: unknown): JsonErrorOutput;
/**
 * Handles a command error by outputting appropriately and exiting.
 *
 * @param error - The error to handle
 * @param jsonMode - Whether to output JSON format
 */
export declare function handleCommandError(error: unknown, jsonMode?: boolean): never;
/**
 * Wraps a command function with centralized error handling.
 *
 * This wrapper:
 * - Catches any errors thrown by the command
 * - Detects ChadGI custom errors and extracts error codes
 * - Returns appropriate exit codes (1 for general, 2 for validation)
 * - Formats errors with colors for terminal output
 * - Supports JSON output mode when options.json is true
 *
 * @param fn - The command function to wrap
 * @returns Wrapped function safe for use as CLI action handler
 *
 * @example
 * ```ts
 * // Before (repeated 40+ times)
 * .action(async (options) => {
 *   try {
 *     await init(options);
 *   } catch (error) {
 *     console.error('Error:', (error as Error).message);
 *     process.exit(1);
 *   }
 * });
 *
 * // After
 * .action(wrapCommand(init));
 * ```
 */
export declare function wrapCommand<T>(fn: (options?: T) => Promise<unknown>): (options?: T) => Promise<void>;
/**
 * Wraps a command function that receives arguments before options.
 *
 * Some Commander commands receive positional arguments before the options object.
 * This wrapper handles those cases.
 *
 * @param fn - The command function to wrap (receives arg then options)
 * @returns Wrapped function safe for use as CLI action handler
 *
 * @example
 * ```ts
 * // For commands like: chadgi diff <issue-number>
 * .action(wrapCommandWithArg(async (issueNumber, options) => {
 *   await diff(issueNumber, options);
 * }));
 * ```
 */
export declare function wrapCommandWithArg<A, T>(fn: (arg: A, options?: T) => Promise<unknown>): (arg: A, options?: T) => Promise<void>;
/**
 * Wraps a command function that receives two arguments before options.
 *
 * @param fn - The command function to wrap (receives two args then options)
 * @returns Wrapped function safe for use as CLI action handler
 */
export declare function wrapCommandWithTwoArgs<A, B, T>(fn: (arg1: A, arg2: B, options?: T) => Promise<unknown>): (arg1: A, arg2: B, options?: T) => Promise<void>;
//# sourceMappingURL=cli-error-handler.d.ts.map