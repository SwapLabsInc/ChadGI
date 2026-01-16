/**
 * Structured error types for ChadGI.
 *
 * Provides custom error classes with error codes for consistent error handling
 * across all command modules.
 */
/**
 * Common operation types for context attachment.
 * Using a union type allows for extensibility while providing intellisense.
 */
export type OperationType = 'file-read' | 'file-write' | 'file-delete' | 'github-api' | 'github-issue' | 'github-pr' | 'github-project' | 'queue-fetch' | 'queue-process' | 'config-load' | 'config-parse' | 'shell-exec' | 'lock-acquire' | 'lock-release' | string;
/**
 * Relevant identifiers for the operation being performed.
 * All fields are optional since different operations need different identifiers.
 */
export interface ErrorContextIdentifiers {
    /** File path for file operations */
    filePath?: string;
    /** GitHub issue number */
    issueNumber?: number;
    /** GitHub PR number */
    prNumber?: number;
    /** Task ID for queue operations */
    taskId?: string;
    /** Repository in owner/repo format */
    repo?: string;
    /** GitHub project number */
    projectNumber?: number | string;
    /** Session ID for lock operations */
    sessionId?: string;
    /** API endpoint for GitHub API calls */
    endpoint?: string;
    /** Shell command that was executed */
    command?: string;
}
/**
 * Context information attached to errors for enriched diagnostics.
 *
 * This provides operational metadata that helps with debugging:
 * - What operation was being performed
 * - What resources were involved
 * - When the operation started
 * - Any additional context-specific metadata
 */
export interface ErrorContext {
    /** Operation being performed (e.g., 'file-read', 'github-api', 'queue-fetch') */
    operation: OperationType;
    /** Relevant identifiers for the operation */
    identifiers?: ErrorContextIdentifiers;
    /** Timestamp when the operation started */
    startedAt: Date;
    /** Duration in milliseconds from start to error (computed when context is attached) */
    durationMs?: number;
    /** Additional context metadata (should be sanitized of sensitive data) */
    metadata?: Record<string, unknown>;
}
/**
 * Base error class for all ChadGI errors
 */
export declare class ChadGIError extends Error {
    readonly code: string;
    /** Optional operation context for enriched diagnostics */
    context?: ErrorContext;
    constructor(message: string, code: string, context?: ErrorContext);
    /**
     * Serialize error to a plain object for JSON output.
     * Includes context information if present.
     */
    toJSON(): Record<string, unknown>;
}
/**
 * Error thrown when configuration is invalid or missing
 */
export declare class ConfigError extends ChadGIError {
    constructor(message: string);
}
/**
 * Error thrown when a required config file is not found
 */
export declare class ConfigNotFoundError extends ChadGIError {
    readonly path: string;
    constructor(path: string);
}
/**
 * Error thrown when the .chadgi directory is not initialized
 */
export declare class NotInitializedError extends ChadGIError {
    constructor(directory?: string);
}
/**
 * Error thrown for GitHub API or CLI related failures
 */
export declare class GitHubError extends ChadGIError {
    readonly operation?: string;
    constructor(message: string, operation?: string);
}
/**
 * Error thrown when GitHub authentication fails
 */
export declare class GitHubAuthError extends ChadGIError {
    constructor(message?: string);
}
/**
 * Error thrown when a GitHub project is not found
 */
export declare class ProjectNotFoundError extends ChadGIError {
    readonly projectNumber: string;
    readonly owner: string;
    constructor(projectNumber: string, owner: string);
}
/**
 * Error thrown for Git-related failures
 */
export declare class GitError extends ChadGIError {
    readonly operation?: string;
    constructor(message: string, operation?: string);
}
/**
 * Error thrown when user input validation fails
 */
export declare class ValidationError extends ChadGIError {
    readonly field?: string;
    constructor(message: string, field?: string);
}
/**
 * Error thrown when a file operation fails
 */
export declare class FileError extends ChadGIError {
    readonly path: string;
    readonly operation: 'read' | 'write' | 'delete' | 'exists';
    constructor(message: string, path: string, operation: 'read' | 'write' | 'delete' | 'exists');
}
/**
 * Error thrown when budget limits are exceeded
 */
export declare class BudgetExceededError extends ChadGIError {
    readonly limit: number;
    readonly current: number;
    readonly type: 'task' | 'session';
    constructor(limit: number, current: number, type: 'task' | 'session');
}
/**
 * Error thrown when a task times out
 */
export declare class TaskTimeoutError extends ChadGIError {
    readonly issueNumber: number;
    readonly timeoutMs: number;
    constructor(issueNumber: number, timeoutMs: number);
}
/**
 * Error thrown when maximum iterations are reached
 */
export declare class MaxIterationsError extends ChadGIError {
    readonly issueNumber: number;
    readonly iterations: number;
    constructor(issueNumber: number, iterations: number);
}
/**
 * Determine if an error is a ChadGI error
 */
export declare function isChadGIError(error: unknown): error is ChadGIError;
/**
 * Get error code from any error
 */
export declare function getErrorCode(error: unknown): string;
/**
 * Get user-friendly error message
 */
export declare function getErrorMessage(error: unknown): string;
/**
 * Options for creating an error context.
 */
export interface CreateContextOptions {
    /** Operation being performed */
    operation: OperationType;
    /** Relevant identifiers for the operation */
    identifiers?: ErrorContextIdentifiers;
    /** Additional metadata (will be sanitized) */
    metadata?: Record<string, unknown>;
}
/**
 * Create an ErrorContext with the current timestamp.
 *
 * @param options - Context creation options
 * @returns A new ErrorContext object
 *
 * @example
 * ```typescript
 * const ctx = createErrorContext({
 *   operation: 'file-read',
 *   identifiers: { filePath: '/path/to/file.json' }
 * });
 * ```
 */
export declare function createErrorContext(options: CreateContextOptions): ErrorContext;
/**
 * Attach context to an error, enriching it with operational metadata.
 *
 * If the error is a ChadGIError, the context is attached directly.
 * If it's a generic Error, a new ChadGIError is created wrapping it.
 * If it's neither, the value is converted to a string message.
 *
 * The context's durationMs is computed from startedAt to now.
 *
 * @param error - The error to enrich
 * @param context - The context to attach
 * @returns The enriched error (may be the same object if ChadGIError)
 *
 * @example
 * ```typescript
 * try {
 *   await readFile(path);
 * } catch (error) {
 *   throw attachContext(error, context);
 * }
 * ```
 */
export declare function attachContext(error: unknown, context: ErrorContext): ChadGIError;
/**
 * Check if an error has context attached.
 */
export declare function hasErrorContext(error: unknown): error is ChadGIError & {
    context: ErrorContext;
};
/**
 * Get error context from an error, if present.
 */
export declare function getErrorContext(error: unknown): ErrorContext | undefined;
/**
 * Wrap a synchronous operation with automatic context attachment on failure.
 *
 * This is a higher-order function that creates an ErrorContext before executing
 * the operation, and automatically attaches it to any thrown error.
 *
 * @param operation - The operation type
 * @param identifiers - Relevant identifiers for the operation
 * @param fn - The function to execute
 * @param metadata - Optional additional metadata
 * @returns The result of fn()
 * @throws ChadGIError with context attached if fn() throws
 *
 * @example
 * ```typescript
 * const data = withContext(
 *   'file-read',
 *   { filePath: '/path/to/config.json' },
 *   () => readFileSync('/path/to/config.json', 'utf-8')
 * );
 * ```
 */
export declare function withContext<T>(operation: OperationType, identifiers: ErrorContextIdentifiers | undefined, fn: () => T, metadata?: Record<string, unknown>): T;
/**
 * Wrap an asynchronous operation with automatic context attachment on failure.
 *
 * This is the async version of withContext, suitable for Promise-returning operations.
 *
 * @param operation - The operation type
 * @param identifiers - Relevant identifiers for the operation
 * @param fn - The async function to execute
 * @param metadata - Optional additional metadata
 * @returns Promise resolving to the result of fn()
 * @throws ChadGIError with context attached if fn() rejects
 *
 * @example
 * ```typescript
 * const issue = await withContextAsync(
 *   'github-issue',
 *   { issueNumber: 42, repo: 'owner/repo' },
 *   () => gh.issue.get(42, 'owner/repo')
 * );
 * ```
 */
export declare function withContextAsync<T>(operation: OperationType, identifiers: ErrorContextIdentifiers | undefined, fn: () => Promise<T>, metadata?: Record<string, unknown>): Promise<T>;
/**
 * Serialize an error with context to a plain object suitable for JSON output.
 *
 * This handles both ChadGIError (using toJSON) and generic errors.
 *
 * @param error - The error to serialize
 * @returns Plain object representation of the error
 */
export declare function serializeError(error: unknown): Record<string, unknown>;
//# sourceMappingURL=errors.d.ts.map