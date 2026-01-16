/**
 * Structured error types for ChadGI.
 *
 * Provides custom error classes with error codes for consistent error handling
 * across all command modules.
 */

/**
 * Base error class for all ChadGI errors
 */
export class ChadGIError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ChadGIError';
    this.code = code;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ChadGIError);
    }
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigError extends ChadGIError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown when a required config file is not found
 */
export class ConfigNotFoundError extends ChadGIError {
  public readonly path: string;

  constructor(path: string) {
    super(`Configuration file not found: ${path}`, 'CONFIG_NOT_FOUND');
    this.name = 'ConfigNotFoundError';
    this.path = path;
  }
}

/**
 * Error thrown when the .chadgi directory is not initialized
 */
export class NotInitializedError extends ChadGIError {
  constructor(directory: string = '.chadgi') {
    super(
      `${directory} directory not found. Run \`chadgi init\` to initialize ChadGI.`,
      'NOT_INITIALIZED'
    );
    this.name = 'NotInitializedError';
  }
}

/**
 * Error thrown for GitHub API or CLI related failures
 */
export class GitHubError extends ChadGIError {
  public readonly operation?: string;

  constructor(message: string, operation?: string) {
    super(message, 'GITHUB_ERROR');
    this.name = 'GitHubError';
    this.operation = operation;
  }
}

/**
 * Error thrown when GitHub authentication fails
 */
export class GitHubAuthError extends ChadGIError {
  constructor(message: string = 'GitHub authentication failed. Run `gh auth login` to authenticate.') {
    super(message, 'GITHUB_AUTH_ERROR');
    this.name = 'GitHubAuthError';
  }
}

/**
 * Error thrown when a GitHub project is not found
 */
export class ProjectNotFoundError extends ChadGIError {
  public readonly projectNumber: string;
  public readonly owner: string;

  constructor(projectNumber: string, owner: string) {
    super(
      `Could not find project #${projectNumber} for ${owner}`,
      'PROJECT_NOT_FOUND'
    );
    this.name = 'ProjectNotFoundError';
    this.projectNumber = projectNumber;
    this.owner = owner;
  }
}

/**
 * Error thrown for Git-related failures
 */
export class GitError extends ChadGIError {
  public readonly operation?: string;

  constructor(message: string, operation?: string) {
    super(message, 'GIT_ERROR');
    this.name = 'GitError';
    this.operation = operation;
  }
}

/**
 * Error thrown when user input validation fails
 */
export class ValidationError extends ChadGIError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Error thrown when a file operation fails
 */
export class FileError extends ChadGIError {
  public readonly path: string;
  public readonly operation: 'read' | 'write' | 'delete' | 'exists';

  constructor(message: string, path: string, operation: 'read' | 'write' | 'delete' | 'exists') {
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
  public readonly limit: number;
  public readonly current: number;
  public readonly type: 'task' | 'session';

  constructor(limit: number, current: number, type: 'task' | 'session') {
    super(
      `${type === 'task' ? 'Task' : 'Session'} budget exceeded: $${current.toFixed(4)} of $${limit.toFixed(2)} limit`,
      'BUDGET_EXCEEDED'
    );
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
  public readonly issueNumber: number;
  public readonly timeoutMs: number;

  constructor(issueNumber: number, timeoutMs: number) {
    super(
      `Task #${issueNumber} timed out after ${Math.round(timeoutMs / 1000)}s`,
      'TASK_TIMEOUT'
    );
    this.name = 'TaskTimeoutError';
    this.issueNumber = issueNumber;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when maximum iterations are reached
 */
export class MaxIterationsError extends ChadGIError {
  public readonly issueNumber: number;
  public readonly iterations: number;

  constructor(issueNumber: number, iterations: number) {
    super(
      `Task #${issueNumber} failed after ${iterations} iterations`,
      'MAX_ITERATIONS'
    );
    this.name = 'MaxIterationsError';
    this.issueNumber = issueNumber;
    this.iterations = iterations;
  }
}

/**
 * Determine if an error is a ChadGI error
 */
export function isChadGIError(error: unknown): error is ChadGIError {
  return error instanceof ChadGIError;
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): string {
  if (isChadGIError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
