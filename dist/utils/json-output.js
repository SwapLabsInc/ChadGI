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
let _packageVersion = null;
/**
 * Get the package version, caching it for subsequent calls.
 */
function getPackageVersion() {
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
                    _packageVersion = pkg.version;
                    return _packageVersion;
                }
            }
            catch (e) {
                // Package.json not found at this level, continue searching up
                logSilentError(e, `reading package.json from ${searchDir}`, ErrorCategory.EXPECTED);
            }
            searchDir = dirname(searchDir);
        }
    }
    catch (e) {
        // Module resolution failed, use fallback version
        logSilentError(e, 'loading fs/path modules for version detection', ErrorCategory.EXPECTED);
    }
    _packageVersion = 'unknown';
    return _packageVersion;
}
/**
 * Create response metadata.
 *
 * @param options - Options for creating metadata
 * @returns Response metadata object
 */
export function createResponseMeta(options) {
    const { command, startTime, overrides } = options;
    const meta = {
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
export function createJsonResponse(options) {
    const { data, command, startTime, pagination, meta: metaOverrides } = options;
    const response = {
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
export function createJsonError(options) {
    const { code, message, details, context, command, startTime, meta: metaOverrides } = options;
    const errorInfo = {
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
};
/**
 * Type guard to check if a value is a JsonResponse.
 */
export function isJsonResponse(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const obj = value;
    return typeof obj.success === 'boolean';
}
/**
 * Type guard to check if a JsonResponse represents an error.
 */
export function isJsonErrorResponse(response) {
    return !response.success && response.error !== undefined;
}
/**
 * Type guard to check if a JsonResponse represents success.
 */
export function isJsonSuccessResponse(response) {
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
export function wrapLegacyResponse(legacyData, options = {}) {
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
export function outputJsonResponse(response, pretty = true) {
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
export function outputJsonData(data, options = {}) {
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
export function createJsonErrorFromError(error, options = {}) {
    // Extract error code
    let code = 'UNKNOWN_ERROR';
    let message = 'An unknown error occurred';
    let context;
    // Check if it's a ChadGIError (has code property)
    if (error && typeof error === 'object' && 'code' in error) {
        const chadError = error;
        code = chadError.code;
        message = chadError.message || message;
        // Extract context if present
        if (chadError.context) {
            context = {
                operation: chadError.context.operation,
                identifiers: chadError.context.identifiers,
                startedAt: chadError.context.startedAt instanceof Date
                    ? chadError.context.startedAt.toISOString()
                    : String(chadError.context.startedAt),
                durationMs: chadError.context.durationMs,
                metadata: chadError.context.metadata,
            };
        }
    }
    else if (error instanceof Error) {
        message = error.message;
    }
    else if (error !== null && error !== undefined) {
        message = String(error);
    }
    return createJsonError({
        code,
        message,
        context,
        ...options,
    });
}
//# sourceMappingURL=json-output.js.map