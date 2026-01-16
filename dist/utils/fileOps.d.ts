/**
 * Atomic file write utilities for ChadGI.
 *
 * Provides crash-safe file writing operations using the write-to-temp-then-rename
 * pattern. This ensures that files are never left in a corrupted or partial state
 * even if the process is killed during a write operation.
 */
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
//# sourceMappingURL=fileOps.d.ts.map