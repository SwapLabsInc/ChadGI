/**
 * Atomic file write utilities for ChadGI.
 *
 * Provides crash-safe file writing operations using the write-to-temp-then-rename
 * pattern. This ensures that files are never left in a corrupted or partial state
 * even if the process is killed during a write operation.
 */

import { writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';

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
    } catch {
      // Ignore cleanup errors - the original error is more important
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
