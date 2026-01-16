/**
 * Structured error types for ChadGI.
 *
 * Provides custom error classes with error codes for consistent error handling
 * across all command modules.
 */

// ============================================================================
// Operation Context Types
// ============================================================================

/**
 * Common operation types for context attachment.
 * Using a union type allows for extensibility while providing intellisense.
 */
export type OperationType =
  | 'file-read'
  | 'file-write'
  | 'file-delete'
  | 'github-api'
  | 'github-issue'
  | 'github-pr'
  | 'github-project'
  | 'queue-fetch'
  | 'queue-process'
  | 'config-load'
  | 'config-parse'
  | 'shell-exec'
  | 'lock-acquire'
  | 'lock-release'
  | string; // Allow custom operation types

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

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for all ChadGI errors
 */
export class ChadGIError extends Error {
  public readonly code: string;
  /** Optional operation context for enriched diagnostics */
  public context?: ErrorContext;

  constructor(message: string, code: string, context?: ErrorContext) {
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
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
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

// ============================================================================
// Context Attachment Utilities
// ============================================================================

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
export function createErrorContext(options: CreateContextOptions): ErrorContext {
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
export function attachContext(error: unknown, context: ErrorContext): ChadGIError {
  // Compute duration from context start time
  const enrichedContext: ErrorContext = {
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
export function hasErrorContext(error: unknown): error is ChadGIError & { context: ErrorContext } {
  return isChadGIError(error) && error.context !== undefined;
}

/**
 * Get error context from an error, if present.
 */
export function getErrorContext(error: unknown): ErrorContext | undefined {
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
export function withContext<T>(
  operation: OperationType,
  identifiers: ErrorContextIdentifiers | undefined,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const context = createErrorContext({
    operation,
    identifiers,
    metadata,
  });

  try {
    return fn();
  } catch (error) {
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
export async function withContextAsync<T>(
  operation: OperationType,
  identifiers: ErrorContextIdentifiers | undefined,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const context = createErrorContext({
    operation,
    identifiers,
    metadata,
  });

  try {
    return await fn();
  } catch (error) {
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
export function serializeError(error: unknown): Record<string, unknown> {
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
