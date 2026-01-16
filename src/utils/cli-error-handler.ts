/**
 * Centralized CLI error handler for ChadGI commands.
 *
 * Provides a wrapper function to reduce boilerplate error handling across all
 * CLI command action handlers, with proper error type detection, exit codes,
 * and optional JSON output support.
 */

import { colors } from './colors.js';
import {
  getErrorCode,
  getErrorMessage,
  ValidationError,
} from './errors.js';

/**
 * Exit codes for different error types.
 * Following common Unix conventions:
 * - 1: General errors
 * - 2: Validation/usage errors
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  VALIDATION_ERROR: 2,
} as const;

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
 * Helper to check if options object has json property set to true.
 */
function hasJsonMode(options: unknown): boolean {
  return (
    typeof options === 'object' &&
    options !== null &&
    'json' in options &&
    (options as { json?: boolean }).json === true
  );
}

/**
 * Determines the appropriate exit code based on error type.
 *
 * @param error - The error to analyze
 * @returns Exit code (1 for general errors, 2 for validation errors)
 */
export function getExitCode(error: unknown): ExitCode {
  if (error instanceof ValidationError) {
    return EXIT_CODES.VALIDATION_ERROR;
  }
  return EXIT_CODES.GENERAL_ERROR;
}

/**
 * Formats an error for console output with color.
 *
 * @param error - The error to format
 * @returns Formatted error string with color codes
 */
export function formatError(error: unknown): string {
  const message = getErrorMessage(error);
  return `${colors.red}Error:${colors.reset} ${message}`;
}

/**
 * Formats an error as JSON for structured output.
 *
 * @param error - The error to format
 * @returns JSON error object
 */
export function formatErrorJson(error: unknown): JsonErrorOutput {
  return {
    error: true,
    code: getErrorCode(error),
    message: getErrorMessage(error),
  };
}

/**
 * Handles a command error by outputting appropriately and exiting.
 *
 * @param error - The error to handle
 * @param jsonMode - Whether to output JSON format
 */
export function handleCommandError(
  error: unknown,
  jsonMode: boolean = false
): never {
  const exitCode = getExitCode(error);

  if (jsonMode) {
    console.log(JSON.stringify(formatErrorJson(error), null, 2));
  } else {
    console.error(formatError(error));
  }

  process.exit(exitCode);
}

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
export function wrapCommand<T>(
  fn: (options?: T) => Promise<unknown>
): (options?: T) => Promise<void> {
  return async (options?: T): Promise<void> => {
    try {
      await fn(options);
    } catch (error) {
      const jsonMode = hasJsonMode(options);
      handleCommandError(error, jsonMode);
    }
  };
}

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
export function wrapCommandWithArg<A, T>(
  fn: (arg: A, options?: T) => Promise<unknown>
): (arg: A, options?: T) => Promise<void> {
  return async (arg: A, options?: T): Promise<void> => {
    try {
      await fn(arg, options);
    } catch (error) {
      const jsonMode = hasJsonMode(options);
      handleCommandError(error, jsonMode);
    }
  };
}

/**
 * Wraps a command function that receives two arguments before options.
 *
 * @param fn - The command function to wrap (receives two args then options)
 * @returns Wrapped function safe for use as CLI action handler
 */
export function wrapCommandWithTwoArgs<A, B, T>(
  fn: (arg1: A, arg2: B, options?: T) => Promise<unknown>
): (arg1: A, arg2: B, options?: T) => Promise<void> {
  return async (arg1: A, arg2: B, options?: T): Promise<void> => {
    try {
      await fn(arg1, arg2, options);
    } catch (error) {
      const jsonMode = hasJsonMode(options);
      handleCommandError(error, jsonMode);
    }
  };
}
