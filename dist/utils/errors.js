/**
 * Structured error types for ChadGI.
 *
 * Provides custom error classes with error codes for consistent error handling
 * across all command modules.
 */
// ============================================================================
// Error Classes
// ============================================================================
/**
 * Base error class for all ChadGI errors
 */
export class ChadGIError extends Error {
    code;
    /** Optional operation context for enriched diagnostics */
    context;
    constructor(message, code, context) {
        super(message);
        this.name = 'ChadGIError';
        this.code = code;
        this.context = context;
        // Maintains proper stack trace in V8
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ChadGIError);
        }
    }
    /**
     * Serialize error to a plain object for JSON output.
     * Includes context information if present.
     */
    toJSON() {
        const result = {
            name: this.name,
            code: this.code,
            message: this.message,
        };
        if (this.context) {
            result.context = {
                operation: this.context.operation,
                identifiers: this.context.identifiers,
                startedAt: this.context.startedAt.toISOString(),
                durationMs: this.context.durationMs,
                metadata: this.context.metadata,
            };
        }
        return result;
    }
}
/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigError extends ChadGIError {
    constructor(message) {
        super(message, 'CONFIG_ERROR');
        this.name = 'ConfigError';
    }
}
/**
 * Error thrown when a required config file is not found
 */
export class ConfigNotFoundError extends ChadGIError {
    path;
    constructor(path) {
        super(`Configuration file not found: ${path}`, 'CONFIG_NOT_FOUND');
        this.name = 'ConfigNotFoundError';
        this.path = path;
    }
}
/**
 * Error thrown when the .chadgi directory is not initialized
 */
export class NotInitializedError extends ChadGIError {
    constructor(directory = '.chadgi') {
        super(`${directory} directory not found. Run \`chadgi init\` to initialize ChadGI.`, 'NOT_INITIALIZED');
        this.name = 'NotInitializedError';
    }
}
/**
 * Error thrown for GitHub API or CLI related failures
 */
export class GitHubError extends ChadGIError {
    operation;
    constructor(message, operation) {
        super(message, 'GITHUB_ERROR');
        this.name = 'GitHubError';
        this.operation = operation;
    }
}
/**
 * Error thrown when GitHub authentication fails
 */
export class GitHubAuthError extends ChadGIError {
    constructor(message = 'GitHub authentication failed. Run `gh auth login` to authenticate.') {
        super(message, 'GITHUB_AUTH_ERROR');
        this.name = 'GitHubAuthError';
    }
}
/**
 * Error thrown when a GitHub project is not found
 */
export class ProjectNotFoundError extends ChadGIError {
    projectNumber;
    owner;
    constructor(projectNumber, owner) {
        super(`Could not find project #${projectNumber} for ${owner}`, 'PROJECT_NOT_FOUND');
        this.name = 'ProjectNotFoundError';
        this.projectNumber = projectNumber;
        this.owner = owner;
    }
}
/**
 * Error thrown for Git-related failures
 */
export class GitError extends ChadGIError {
    operation;
    constructor(message, operation) {
        super(message, 'GIT_ERROR');
        this.name = 'GitError';
        this.operation = operation;
    }
}
/**
 * Error thrown when user input validation fails
 */
export class ValidationError extends ChadGIError {
    field;
    constructor(message, field) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.field = field;
    }
}
/**
 * Error thrown when a file operation fails
 */
export class FileError extends ChadGIError {
    path;
    operation;
    constructor(message, path, operation) {
        super(message, 'FILE_ERROR');
        this.name = 'FileError';
        this.path = path;
        this.operation = operation;
    }
}
/**
 * Error thrown when budget limits are exceeded
 */
export class BudgetExceededError extends ChadGIError {
    limit;
    current;
    type;
    constructor(limit, current, type) {
        super(`${type === 'task' ? 'Task' : 'Session'} budget exceeded: $${current.toFixed(4)} of $${limit.toFixed(2)} limit`, 'BUDGET_EXCEEDED');
        this.name = 'BudgetExceededError';
        this.limit = limit;
        this.current = current;
        this.type = type;
    }
}
/**
 * Error thrown when a task times out
 */
export class TaskTimeoutError extends ChadGIError {
    issueNumber;
    timeoutMs;
    constructor(issueNumber, timeoutMs) {
        super(`Task #${issueNumber} timed out after ${Math.round(timeoutMs / 1000)}s`, 'TASK_TIMEOUT');
        this.name = 'TaskTimeoutError';
        this.issueNumber = issueNumber;
        this.timeoutMs = timeoutMs;
    }
}
/**
 * Error thrown when maximum iterations are reached
 */
export class MaxIterationsError extends ChadGIError {
    issueNumber;
    iterations;
    constructor(issueNumber, iterations) {
        super(`Task #${issueNumber} failed after ${iterations} iterations`, 'MAX_ITERATIONS');
        this.name = 'MaxIterationsError';
        this.issueNumber = issueNumber;
        this.iterations = iterations;
    }
}
/**
 * Determine if an error is a ChadGI error
 */
export function isChadGIError(error) {
    return error instanceof ChadGIError;
}
/**
 * Get error code from any error
 */
export function getErrorCode(error) {
    if (isChadGIError(error)) {
        return error.code;
    }
    return 'UNKNOWN_ERROR';
}
/**
 * Get user-friendly error message
 */
export function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
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
export function createErrorContext(options) {
    return {
        operation: options.operation,
        identifiers: options.identifiers,
        startedAt: new Date(),
        metadata: options.metadata,
    };
}
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
export function attachContext(error, context) {
    // Compute duration from context start time
    const enrichedContext = {
        ...context,
        durationMs: Date.now() - context.startedAt.getTime(),
    };
    // If already a ChadGIError, attach context and return
    if (isChadGIError(error)) {
        error.context = enrichedContext;
        return error;
    }
    // If it's a generic Error, wrap it in a ChadGIError
    if (error instanceof Error) {
        const wrapped = new ChadGIError(error.message, 'UNKNOWN_ERROR', enrichedContext);
        wrapped.stack = error.stack;
        return wrapped;
    }
    // For non-Error values, create a new ChadGIError
    return new ChadGIError(String(error), 'UNKNOWN_ERROR', enrichedContext);
}
/**
 * Check if an error has context attached.
 */
export function hasErrorContext(error) {
    return isChadGIError(error) && error.context !== undefined;
}
/**
 * Get error context from an error, if present.
 */
export function getErrorContext(error) {
    if (isChadGIError(error)) {
        return error.context;
    }
    return undefined;
}
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
export function withContext(operation, identifiers, fn, metadata) {
    const context = createErrorContext({
        operation,
        identifiers,
        metadata,
    });
    try {
        return fn();
    }
    catch (error) {
        throw attachContext(error, context);
    }
}
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
export async function withContextAsync(operation, identifiers, fn, metadata) {
    const context = createErrorContext({
        operation,
        identifiers,
        metadata,
    });
    try {
        return await fn();
    }
    catch (error) {
        throw attachContext(error, context);
    }
}
/**
 * Serialize an error with context to a plain object suitable for JSON output.
 *
 * This handles both ChadGIError (using toJSON) and generic errors.
 *
 * @param error - The error to serialize
 * @returns Plain object representation of the error
 */
export function serializeError(error) {
    if (isChadGIError(error)) {
        return error.toJSON();
    }
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            code: 'UNKNOWN_ERROR',
        };
    }
    return {
        name: 'Error',
        message: String(error),
        code: 'UNKNOWN_ERROR',
    };
}
//# sourceMappingURL=errors.js.map