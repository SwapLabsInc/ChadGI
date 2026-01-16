/**
 * Atomic file write utilities for ChadGI.
 *
 * Provides crash-safe file writing operations using the write-to-temp-then-rename
 * pattern. This ensures that files are never left in a corrupted or partial state
 * even if the process is killed during a write operation.
 *
 * Also provides safe JSON parsing utilities with structured error logging for
 * debugging corrupted or malformed JSON files.
 */

import { writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { isVerbose } from './debug.js';
import type { DataSchema, ValidationResult } from './data-schema.js';
import { logSilentError, ErrorCategory } from './diagnostics.js';

/**
 * Default number of retry attempts for transient failures
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Default delay between retry attempts in milliseconds
 */
const DEFAULT_RETRY_DELAY_MS = 100;

/**
 * Options for safeWriteFile
 */
export interface SafeWriteOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 100) */
  retryDelayMs?: number;
}

/**
 * Generate a unique temporary file path in the same directory as the target.
 * Using the same directory ensures atomic rename will work (same filesystem).
 *
 * @param filePath - The target file path
 * @returns A unique temporary file path
 */
function getTempPath(filePath: string): string {
  const dir = dirname(filePath);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return join(dir, `.tmp.${process.pid}.${timestamp}.${random}`);
}

/**
 * Sleep for a specified number of milliseconds
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is a transient error that can be retried
 *
 * @param error - The error to check
 * @returns true if the error is transient
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    // EBUSY: resource busy, EAGAIN: try again, EMFILE: too many open files
    return code === 'EBUSY' || code === 'EAGAIN' || code === 'EMFILE';
  }
  return false;
}

/**
 * Atomically write content to a file using the write-to-temp-then-rename pattern.
 *
 * This ensures that the target file is never left in a corrupted state:
 * 1. Write content to a temporary file in the same directory
 * 2. Atomically rename the temp file to the target path
 * 3. Clean up temp file on failure
 *
 * @param filePath - The target file path (must be absolute)
 * @param content - The content to write
 * @throws Error if the write fails after cleanup
 *
 * @example
 * ```typescript
 * atomicWriteFile('/path/to/config.json', JSON.stringify(data));
 * ```
 */
export function atomicWriteFile(filePath: string, content: string): void {
  const tempPath = getTempPath(filePath);

  try {
    // Write to temporary file
    writeFileSync(tempPath, content, 'utf-8');

    // Atomically rename to target (this is atomic on POSIX systems)
    renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      // Cleanup errors are secondary - the original error takes priority
      logSilentError(cleanupError, `cleaning up temp file ${tempPath}`, ErrorCategory.EXPECTED);
    }

    // Re-throw the original error
    throw error;
  }
}

/**
 * Atomically write JSON data to a file with pretty-printing.
 *
 * This is a convenience wrapper around atomicWriteFile that handles JSON
 * serialization with proper formatting (2-space indentation).
 *
 * @param filePath - The target file path (must be absolute)
 * @param data - The data to serialize and write
 * @throws Error if serialization or write fails
 *
 * @example
 * ```typescript
 * atomicWriteJson('/path/to/progress.json', { status: 'running', task: 42 });
 * ```
 */
export function atomicWriteJson(filePath: string, data: unknown): void {
  const content = JSON.stringify(data, null, 2);
  atomicWriteFile(filePath, content);
}

/**
 * Safely write content to a file with automatic retry on transient failures.
 *
 * This function uses atomicWriteFile internally and adds retry logic for
 * handling transient filesystem errors like EBUSY (resource busy) or
 * EAGAIN (try again).
 *
 * @param filePath - The target file path (must be absolute)
 * @param content - The content to write
 * @param options - Optional retry configuration
 * @returns Promise that resolves when write succeeds
 * @throws Error if all retry attempts fail
 *
 * @example
 * ```typescript
 * await safeWriteFile('/path/to/file.txt', 'content', { maxRetries: 5 });
 * ```
 */
export async function safeWriteFile(
  filePath: string,
  content: string,
  options: SafeWriteOptions = {}
): Promise<void> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      atomicWriteFile(filePath, content);
      return; // Success!
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on transient errors
      if (!isTransientError(error) || attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying
      await sleep(retryDelayMs * attempt); // Exponential backoff
    }
  }

  // This should never be reached due to the throw above, but TypeScript needs it
  throw lastError ?? new Error('Unknown error during file write');
}

/**
 * Safely write JSON data to a file with automatic retry on transient failures.
 *
 * This is a convenience wrapper around safeWriteFile that handles JSON
 * serialization with proper formatting.
 *
 * @param filePath - The target file path (must be absolute)
 * @param data - The data to serialize and write
 * @param options - Optional retry configuration
 * @returns Promise that resolves when write succeeds
 * @throws Error if all retry attempts fail
 *
 * @example
 * ```typescript
 * await safeWriteJson('/path/to/config.json', { key: 'value' });
 * ```
 */
export async function safeWriteJson(
  filePath: string,
  data: unknown,
  options: SafeWriteOptions = {}
): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await safeWriteFile(filePath, content, options);
}

// ============================================================================
// Safe JSON Parsing
// ============================================================================

/**
 * Maximum length for content preview in error messages (protects against exposing secrets)
 */
const CONTENT_PREVIEW_LENGTH = 100;

/**
 * Result of a successful JSON parse operation
 */
export interface SafeParseSuccess<T> {
  success: true;
  data: T;
}

/**
 * Result of a failed JSON parse operation
 */
export interface SafeParseFailure {
  success: false;
  error: string;
}

/**
 * Result type for safeParseJson - either success with data or failure with error
 */
export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

/**
 * Options for safeParseJson
 */
export interface SafeParseJsonOptions<T> {
  /** File path for error context (included in error messages) */
  filePath?: string;
  /** Optional fallback value to return on parse error (logs error but returns fallback) */
  fallback?: T;
}

/**
 * Extract position information from JSON parse error message
 *
 * @param errorMessage - The error message from JSON.parse
 * @returns Object with line, column, and position if found
 */
function extractJsonErrorPosition(errorMessage: string): { position?: number; line?: number; column?: number } {
  // Try to extract position from error like "Unexpected token at position 142"
  const positionMatch = errorMessage.match(/position\s+(\d+)/i);
  if (positionMatch) {
    return { position: parseInt(positionMatch[1], 10) };
  }

  // Try to extract line/column from error like "at line 5 column 12"
  const lineColMatch = errorMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    return {
      line: parseInt(lineColMatch[1], 10),
      column: parseInt(lineColMatch[2], 10),
    };
  }

  return {};
}

/**
 * Create a safe content preview that won't expose sensitive data
 *
 * @param content - The raw content string
 * @returns A truncated preview safe for logging
 */
function createContentPreview(content: string): string {
  if (!content || content.length === 0) {
    return '<empty>';
  }

  // Check for binary content (non-printable characters)
  const printableRatio = content.substring(0, Math.min(200, content.length))
    .split('')
    .filter(c => {
      const code = c.charCodeAt(0);
      // Allow printable ASCII and common whitespace
      return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13;
    }).length / Math.min(200, content.length);

  if (printableRatio < 0.8) {
    return '<binary content>';
  }

  // Truncate and indicate if truncated
  const preview = content.substring(0, CONTENT_PREVIEW_LENGTH);
  const truncated = content.length > CONTENT_PREVIEW_LENGTH;

  // Replace newlines for cleaner single-line output
  const cleaned = preview.replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  return truncated ? `${cleaned}...` : cleaned;
}

/**
 * Log a JSON parse error to stderr with context
 *
 * @param error - The parse error
 * @param content - The content that failed to parse
 * @param options - Options containing file path and other context
 */
function logJsonParseError(
  error: Error,
  content: string,
  options: SafeParseJsonOptions<unknown>
): void {
  const { filePath } = options;
  const verbose = isVerbose();

  // Build error message components
  const errorMsg = error.message;
  const positionInfo = extractJsonErrorPosition(errorMsg);
  const preview = createContentPreview(content);

  // Basic error message to stderr
  const fileContext = filePath ? ` in ${filePath}` : '';
  process.stderr.write(`[WARN] JSON parse error${fileContext}: ${errorMsg}\n`);

  // Additional details in verbose/debug mode
  if (verbose) {
    if (positionInfo.position !== undefined) {
      process.stderr.write(`[DEBUG]   Position: ${positionInfo.position}\n`);
    }
    if (positionInfo.line !== undefined && positionInfo.column !== undefined) {
      process.stderr.write(`[DEBUG]   Line: ${positionInfo.line}, Column: ${positionInfo.column}\n`);
    }
    process.stderr.write(`[DEBUG]   Content preview: ${preview}\n`);
    process.stderr.write(`[DEBUG]   Content length: ${content.length} bytes\n`);
  }
}

/**
 * Safely parse JSON content with structured error logging and optional schema validation.
 *
 * Unlike JSON.parse which throws on invalid input, this function:
 * - Returns a typed result object indicating success or failure
 * - Logs parse errors to stderr with context (file path, error position, content preview)
 * - Shows additional details when --verbose/--debug flag is set
 * - Protects against exposing sensitive data in error logs
 * - Optionally returns a fallback value instead of a failure result
 * - Optionally validates parsed data against a schema with bounds checking
 * - Supports recovery of invalid fields using default values
 *
 * @param content - The JSON string to parse
 * @param options - Options for error logging, validation, and fallback behavior
 * @returns A result object with either { success: true, data: T } or { success: false, error: string }
 *
 * @example
 * ```typescript
 * // Basic usage with result checking
 * const result = safeParseJson<Config>(content, { filePath: '/path/to/config.json' });
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 *
 * // With fallback value - always returns data
 * const result = safeParseJson<Config[]>(content, {
 *   filePath: '/path/to/stats.json',
 *   fallback: [],
 * });
 * // result.success is always true when fallback is provided
 * // If parse fails, result.data is the fallback value
 *
 * // With schema validation
 * import { SESSION_STATS_SCHEMA } from './data-schema.js';
 * const result = safeParseJson<SessionStats>(content, {
 *   filePath: '/path/to/stats.json',
 *   schema: SESSION_STATS_SCHEMA,
 *   recover: true,
 * });
 * ```
 */
export function safeParseJson<T>(
  content: string,
  options: SafeParseJsonOptions<T> = {}
): SafeParseResult<T> {
  try {
    const data = JSON.parse(content) as T;
    return { success: true, data };
  } catch (error) {
    const parseError = error instanceof Error ? error : new Error(String(error));

    // Log the error with context
    logJsonParseError(parseError, content, options);

    // If fallback is provided, return success with fallback value
    if ('fallback' in options && options.fallback !== undefined) {
      return { success: true, data: options.fallback };
    }

    return { success: false, error: parseError.message };
  }
}

/**
 * Parse and validate JSON content against a schema with recovery support.
 *
 * This is a convenience wrapper that combines JSON parsing with schema validation.
 * It's designed for loading persisted data structures that need bounds checking.
 *
 * Note: This function requires validateSchema to be passed in to avoid circular
 * dependency issues in ES modules. Use the version from data.ts which has
 * proper imports configured.
 *
 * @param content - The JSON string to parse
 * @param validateFn - The validateSchema function from data-schema module
 * @param schema - The schema to validate against
 * @param options - Options for validation and error handling
 * @returns Validated data or null on failure
 *
 * @example
 * ```typescript
 * import { validateSchema, TASK_LOCK_DATA_SCHEMA } from './data-schema.js';
 * const lockData = safeParseAndValidate<TaskLockData>(
 *   content,
 *   validateSchema,
 *   TASK_LOCK_DATA_SCHEMA,
 *   { filePath: lockPath }
 * );
 * if (lockData) {
 *   // Use validated lock data
 * }
 * ```
 */
export function safeParseAndValidate<T>(
  content: string,
  validateFn: <U>(data: unknown, schema: DataSchema, opts?: { recover?: boolean; filePath?: string }) => ValidationResult<U>,
  schema: DataSchema,
  options: {
    filePath?: string;
    recover?: boolean;
  } = {}
): T | null {
  const parseResult = safeParseJson<unknown>(content, {
    filePath: options.filePath,
  });

  if (!parseResult.success) {
    return null;
  }

  const validation = validateFn<T>(parseResult.data, schema, {
    recover: options.recover !== false,
    filePath: options.filePath,
  });

  if (!validation.valid) {
    const errorMessages = validation.errors
      .filter(e => !e.recovered)
      .map(e => `${e.path}: ${e.message}`)
      .join('; ');

    const fileContext = options.filePath ? ` in ${options.filePath}` : '';
    process.stderr.write(`[WARN] Schema validation failed for ${schema.name}${fileContext}: ${errorMessages}\n`);

    return null;
  }

  return validation.data ?? null;
}
