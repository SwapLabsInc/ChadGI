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
import type { DataSchema, ValidationResult } from './data-schema.js';
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
export declare function atomicWriteFile(filePath: string, content: string): void;
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
export declare function atomicWriteJson(filePath: string, data: unknown): void;
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
export declare function safeWriteFile(filePath: string, content: string, options?: SafeWriteOptions): Promise<void>;
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
export declare function safeWriteJson(filePath: string, data: unknown, options?: SafeWriteOptions): Promise<void>;
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
export declare function safeParseJson<T>(content: string, options?: SafeParseJsonOptions<T>): SafeParseResult<T>;
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
export declare function safeParseAndValidate<T>(content: string, validateFn: <U>(data: unknown, schema: DataSchema, opts?: {
    recover?: boolean;
    filePath?: string;
}) => ValidationResult<U>, schema: DataSchema, options?: {
    filePath?: string;
    recover?: boolean;
}): T | null;
/**
 * Read a file with automatic error context attachment.
 *
 * Wraps fs.readFileSync with error context that includes:
 * - Operation type ('file-read')
 * - File path
 * - Timing information
 *
 * @param filePath - The file path to read
 * @param encoding - File encoding (default: 'utf-8')
 * @returns File contents as string
 * @throws ChadGIError with context if read fails
 *
 * @example
 * ```typescript
 * const content = readFileWithContext('/path/to/config.json');
 * ```
 */
export declare function readFileWithContext(filePath: string, encoding?: BufferEncoding): string;
/**
 * Write a file atomically with automatic error context attachment.
 *
 * Combines atomic write safety with error context enrichment.
 *
 * @param filePath - The target file path
 * @param content - The content to write
 * @throws ChadGIError with context if write fails
 *
 * @example
 * ```typescript
 * writeFileWithContext('/path/to/config.json', JSON.stringify(data));
 * ```
 */
export declare function writeFileWithContext(filePath: string, content: string): void;
/**
 * Write JSON data atomically with automatic error context attachment.
 *
 * @param filePath - The target file path
 * @param data - The data to serialize and write
 * @throws ChadGIError with context if write fails
 *
 * @example
 * ```typescript
 * writeJsonWithContext('/path/to/progress.json', { status: 'running' });
 * ```
 */
export declare function writeJsonWithContext(filePath: string, data: unknown): void;
/**
 * Safely write a file with retries and error context attachment.
 *
 * @param filePath - The target file path
 * @param content - The content to write
 * @param options - Write options (retries, delay)
 * @returns Promise that resolves when write succeeds
 * @throws ChadGIError with context if all retries fail
 *
 * @example
 * ```typescript
 * await safeWriteFileWithContext('/path/to/file.txt', content, { maxRetries: 5 });
 * ```
 */
export declare function safeWriteFileWithContext(filePath: string, content: string, options?: SafeWriteOptions): Promise<void>;
/**
 * Safely write JSON with retries and error context attachment.
 *
 * @param filePath - The target file path
 * @param data - The data to serialize and write
 * @param options - Write options (retries, delay)
 * @returns Promise that resolves when write succeeds
 * @throws ChadGIError with context if all retries fail
 *
 * @example
 * ```typescript
 * await safeWriteJsonWithContext('/path/to/config.json', { key: 'value' });
 * ```
 */
export declare function safeWriteJsonWithContext(filePath: string, data: unknown, options?: SafeWriteOptions): Promise<void>;
/**
 * Check if a file exists with error context on failure.
 *
 * Note: This function doesn't throw on "file not found" - it returns false.
 * It only throws (with context) on unexpected errors like permission issues.
 *
 * @param filePath - The file path to check
 * @returns true if file exists, false otherwise
 */
export declare function existsWithContext(filePath: string): boolean;
/**
 * Delete a file with error context attachment.
 *
 * @param filePath - The file path to delete
 * @throws ChadGIError with context if delete fails (and file exists)
 *
 * @example
 * ```typescript
 * deleteFileWithContext('/path/to/temp-file.txt');
 * ```
 */
export declare function deleteFileWithContext(filePath: string): void;
//# sourceMappingURL=fileOps.d.ts.map