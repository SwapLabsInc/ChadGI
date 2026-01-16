/**
 * Unified JSON response wrapper for consistent machine-readable output.
 *
 * This module provides a standardized response format for all CLI commands
 * that support JSON output, making it easier for external tools and CI/CD
 * pipelines to parse ChadGI output programmatically.
 *
 * @example Success response:
 * ```json
 * {
 *   "success": true,
 *   "data": { ... },
 *   "meta": {
 *     "timestamp": "2026-01-15T10:30:00Z",
 *     "version": "1.0.5",
 *     "command": "queue",
 *     "runtime_ms": 123
 *   }
 * }
 * ```
 *
 * @example Error response:
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "CONFIG_NOT_FOUND",
 *     "message": "Configuration file not found"
 *   },
 *   "meta": { ... }
 * }
 * ```
 *
 * @example List response with pagination:
 * ```json
 * {
 *   "success": true,
 *   "data": { "items": [...] },
 *   "pagination": {
 *     "total": 100,
 *     "filtered": 50,
 *     "limit": 10,
 *     "offset": 0
 *   },
 *   "meta": { ... }
 * }
 * ```
 */

import { logSilentError, ErrorCategory } from './diagnostics.js';

// Get package version for meta information
let _packageVersion: string | null = null;

/**
 * Get the package version, caching it for subsequent calls.
 */
function getPackageVersion(): string {
  if (_packageVersion !== null) {
    return _packageVersion;
  }

  try {
    // Try to read from package.json at runtime
    // Using dynamic import to avoid bundling issues
    const { readFileSync } = require('fs');
    const { join, dirname } = require('path');

    // Find package.json relative to this file
    let searchDir = __dirname;
    for (let i = 0; i < 5; i++) {
      try {
        const pkgPath = join(searchDir, 'package.json');
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'chadgi') {
          _packageVersion = pkg.version as string;
          return _packageVersion;
        }
      } catch (e) {
        // Package.json not found at this level, continue searching up
        logSilentError(e, `reading package.json from ${searchDir}`, ErrorCategory.EXPECTED);
      }
      searchDir = dirname(searchDir);
    }
  } catch (e) {
    // Module resolution failed, use fallback version
    logSilentError(e, 'loading fs/path modules for version detection', ErrorCategory.EXPECTED);
  }

  _packageVersion = 'unknown';
  return _packageVersion;
}

/**
 * Metadata about the command execution.
 * Useful for debugging, logging, and analytics.
 */
export interface ResponseMeta {
  /** ISO timestamp when the response was generated */
  timestamp: string;
  /** ChadGI version */
  version: string;
  /** Command name that generated this response */
  command?: string;
  /** Execution time in milliseconds */
  runtime_ms?: number;
}

/**
 * Serialized error context for JSON output.
 * This is the JSON-safe version of ErrorContext from errors.ts.
 */
export interface SerializedErrorContext {
  /** Operation being performed (e.g., 'file-read', 'github-api', 'queue-fetch') */
  operation: string;
  /** Relevant identifiers for the operation */
  identifiers?: {
    filePath?: string;
    issueNumber?: number;
    prNumber?: number;
    taskId?: string;
    repo?: string;
    projectNumber?: number | string;
    sessionId?: string;
    endpoint?: string;
    command?: string;
  };
  /** ISO timestamp when the operation started */
  startedAt: string;
  /** Duration in milliseconds from start to error */
  durationMs?: number;
  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error information for failed responses.
 */
export interface ResponseError {
  /** Machine-readable error code (e.g., CONFIG_NOT_FOUND, GITHUB_AUTH_ERROR) */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional additional details */
  details?: Record<string, unknown>;
  /** Optional operation context for enriched diagnostics */
  context?: SerializedErrorContext;
}

/**
 * Pagination information for list responses.
 */
export interface ResponsePagination {
  /** Total number of items before filtering */
  total: number;
  /** Number of items after filtering (but before limit/offset) */
  filtered?: number;
  /** Maximum number of items returned */
  limit?: number;
  /** Number of items skipped */
  offset?: number;
}

/**
 * Unified JSON response wrapper.
 * All commands should use this format for consistent machine-readable output.
 *
 * @typeParam T - The type of the data payload
 */
export interface JsonResponse<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The response data (present on success) */
  data?: T;
  /** Error information (present on failure) */
  error?: ResponseError;
  /** Metadata about the command execution */
  meta?: ResponseMeta;
  /** Pagination information for list responses */
  pagination?: ResponsePagination;
}

/**
 * Options for creating a JSON response.
 */
export interface CreateJsonResponseOptions<T = unknown> {
  /** The response data */
  data: T;
  /** Command name for metadata */
  command?: string;
  /** Execution start time (for calculating runtime_ms) */
  startTime?: number;
  /** Pagination information for list responses */
  pagination?: ResponsePagination;
  /** Additional metadata fields */
  meta?: Partial<ResponseMeta>;
}

/**
 * Options for creating a JSON error response.
 */
export interface CreateJsonErrorOptions {
  /** Machine-readable error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Optional additional error details */
  details?: Record<string, unknown>;
  /** Optional operation context for enriched diagnostics */
  context?: SerializedErrorContext;
  /** Command name for metadata */
  command?: string;
  /** Execution start time (for calculating runtime_ms) */
  startTime?: number;
  /** Additional metadata fields */
  meta?: Partial<ResponseMeta>;
}

/**
 * Create response metadata.
 *
 * @param options - Options for creating metadata
 * @returns Response metadata object
 */
export function createResponseMeta(options: {
  command?: string;
  startTime?: number;
  overrides?: Partial<ResponseMeta>;
}): ResponseMeta {
  const { command, startTime, overrides } = options;

  const meta: ResponseMeta = {
    timestamp: new Date().toISOString(),
    version: getPackageVersion(),
    ...overrides,
  };

  if (command) {
    meta.command = command;
  }

  if (startTime !== undefined) {
    meta.runtime_ms = Date.now() - startTime;
  }

  return meta;
}

/**
 * Create a successful JSON response.
 *
 * @param options - Options for creating the response
 * @returns A unified JSON response object
 *
 * @example Basic usage:
 * ```ts
 * const response = createJsonResponse({
 *   data: { tasks: [...] },
 *   command: 'queue',
 * });
 * ```
 *
 * @example With pagination:
 * ```ts
 * const response = createJsonResponse({
 *   data: { entries: filteredEntries },
 *   command: 'history',
 *   startTime,
 *   pagination: { total: 100, filtered: 50, limit: 10, offset: 0 },
 * });
 * ```
 */
export function createJsonResponse<T>(
  options: CreateJsonResponseOptions<T>
): JsonResponse<T> {
  const { data, command, startTime, pagination, meta: metaOverrides } = options;

  const response: JsonResponse<T> = {
    success: true,
    data,
    meta: createResponseMeta({
      command,
      startTime,
      overrides: metaOverrides,
    }),
  };

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
}

/**
 * Create an error JSON response.
 *
 * @param options - Options for creating the error response
 * @returns A unified JSON error response object
 *
 * @example Basic usage:
 * ```ts
 * const response = createJsonError({
 *   code: 'CONFIG_NOT_FOUND',
 *   message: 'Configuration file not found at /path/to/config.yaml',
 *   command: 'validate',
 * });
 * ```
 *
 * @example With details:
 * ```ts
 * const response = createJsonError({
 *   code: 'VALIDATION_FAILED',
 *   message: 'Multiple validation errors occurred',
 *   details: { errors: ['Missing repo', 'Invalid project number'] },
 *   command: 'validate',
 * });
 * ```
 */
export function createJsonError(options: CreateJsonErrorOptions): JsonResponse<never> {
  const { code, message, details, context, command, startTime, meta: metaOverrides } = options;

  const errorInfo: ResponseError = {
    code,
    message,
  };

  if (details) {
    errorInfo.details = details;
  }

  if (context) {
    errorInfo.context = context;
  }

  return {
    success: false,
    error: errorInfo,
    meta: createResponseMeta({
      command,
      startTime,
      overrides: metaOverrides,
    }),
  };
}

/**
 * Common error codes for ChadGI commands.
 * Use these codes for consistent error identification across commands.
 */
export const ErrorCodes = {
  // Configuration errors
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  NOT_INITIALIZED: 'NOT_INITIALIZED',

  // GitHub errors
  GITHUB_AUTH_ERROR: 'GITHUB_AUTH_ERROR',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  ISSUE_NOT_FOUND: 'ISSUE_NOT_FOUND',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',

  // Runtime errors
  COMMAND_FAILED: 'COMMAND_FAILED',
  TIMEOUT: 'TIMEOUT',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',

  // File/lock errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  LOCK_HELD: 'LOCK_HELD',

  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Type guard to check if a value is a JsonResponse.
 */
export function isJsonResponse(value: unknown): value is JsonResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.success === 'boolean';
}

/**
 * Type guard to check if a JsonResponse represents an error.
 */
export function isJsonErrorResponse(response: JsonResponse): response is JsonResponse<never> {
  return !response.success && response.error !== undefined;
}

/**
 * Type guard to check if a JsonResponse represents success.
 */
export function isJsonSuccessResponse<T>(response: JsonResponse<T>): response is JsonResponse<T> & { data: T } {
  return response.success && response.data !== undefined;
}

/**
 * Convert a legacy response format to the unified format.
 * Useful for migrating existing commands to the new format.
 *
 * @param legacyData - The legacy response data
 * @param options - Options for the conversion
 * @returns A unified JSON response
 */
export function wrapLegacyResponse<T>(
  legacyData: T,
  options: {
    command?: string;
    startTime?: number;
    pagination?: ResponsePagination;
  } = {}
): JsonResponse<T> {
  return createJsonResponse({
    data: legacyData,
    ...options,
  });
}

/**
 * Format and output a JSON response to stdout.
 * Includes proper pretty-printing for readability.
 *
 * @param response - The JSON response to output
 * @param pretty - Whether to pretty-print (default: true)
 */
export function outputJsonResponse<T>(response: JsonResponse<T>, pretty = true): void {
  const output = pretty ? JSON.stringify(response, null, 2) : JSON.stringify(response);
  console.log(output);
}

/**
 * Create a JSON response directly from data and output it.
 * Convenience function for simple command outputs.
 *
 * @param data - The data to wrap and output
 * @param options - Options for creating the response
 */
export function outputJsonData<T>(
  data: T,
  options: Omit<CreateJsonResponseOptions<T>, 'data'> = {}
): void {
  const response = createJsonResponse({ ...options, data });
  outputJsonResponse(response);
}

/**
 * Create a JSON error response from any error, including ChadGIError with context.
 *
 * This is a convenience function that extracts error information and context
 * from various error types and creates a unified JSON error response.
 *
 * @param error - The error to convert (can be Error, ChadGIError, or any value)
 * @param options - Additional options for the error response
 * @returns A unified JSON error response
 *
 * @example
 * ```ts
 * try {
 *   await someOperation();
 * } catch (error) {
 *   const response = createJsonErrorFromError(error, { command: 'my-command' });
 *   outputJsonResponse(response);
 * }
 * ```
 */
export function createJsonErrorFromError(
  error: unknown,
  options: {
    command?: string;
    startTime?: number;
    meta?: Partial<ResponseMeta>;
  } = {}
): JsonResponse<never> {
  // Extract error code
  let code = 'UNKNOWN_ERROR';
  let message = 'An unknown error occurred';
  let context: SerializedErrorContext | undefined;

  // Check if it's a ChadGIError (has code property)
  if (error && typeof error === 'object' && 'code' in error) {
    const chadError = error as { code: string; message?: string; context?: { operation: string; identifiers?: unknown; startedAt: Date; durationMs?: number; metadata?: unknown } };
    code = chadError.code;
    message = chadError.message || message;

    // Extract context if present
    if (chadError.context) {
      context = {
        operation: chadError.context.operation,
        identifiers: chadError.context.identifiers as SerializedErrorContext['identifiers'],
        startedAt: chadError.context.startedAt instanceof Date
          ? chadError.context.startedAt.toISOString()
          : String(chadError.context.startedAt),
        durationMs: chadError.context.durationMs,
        metadata: chadError.context.metadata as Record<string, unknown>,
      };
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error !== null && error !== undefined) {
    message = String(error);
  }

  return createJsonError({
    code,
    message,
    context,
    ...options,
  });
}
