/**
 * Structured error types for ChadGI.
 *
 * Provides custom error classes with error codes for consistent error handling
 * across all command modules.
 */
/**
 * Base error class for all ChadGI errors
 */
export declare class ChadGIError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
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
//# sourceMappingURL=errors.d.ts.map