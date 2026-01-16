/**
 * GitHub CLI wrapper functions for ChadGI.
 *
 * Provides common GitHub operations using the `gh` CLI tool.
 * Includes retry logic with exponential backoff for transient failures.
 */
/**
 * Default retry configuration values
 */
export declare const RETRY_DEFAULTS: {
    readonly maxAttempts: 3;
    readonly baseDelayMs: 1000;
    readonly maxDelayMs: 30000;
    readonly jitterMs: 500;
};
/**
 * Options for retry behavior
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts?: number;
    /** Base delay in milliseconds for exponential backoff (default: 1000) */
    baseDelayMs?: number;
    /** Maximum delay in milliseconds (default: 30000) */
    maxDelayMs?: number;
    /** Maximum jitter in milliseconds to add randomness (default: 500) */
    jitterMs?: number;
    /** Callback for logging retry attempts */
    onRetry?: (attempt: number, maxAttempts: number, error: Error, delayMs: number) => void;
}
/**
 * Error classification result
 */
export interface ErrorClassification {
    /** Whether the error is recoverable (transient) */
    recoverable: boolean;
    /** The type of error */
    type: 'rate_limit' | 'server_error' | 'network_error' | 'auth_error' | 'not_found' | 'validation' | 'unknown';
    /** Optional retry-after value in milliseconds for rate limits */
    retryAfterMs?: number;
}
/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Calculate delay with exponential backoff and jitter
 *
 * @param attempt - Current attempt number (1-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @param jitterMs - Maximum jitter to add
 * @returns Calculated delay in milliseconds
 */
export declare function calculateBackoffDelay(attempt: number, baseDelayMs?: number, maxDelayMs?: number, jitterMs?: number): number;
/**
 * Classify an error as recoverable or non-recoverable
 *
 * @param error - The error to classify
 * @returns Classification result with error type and recoverability
 */
export declare function classifyError(error: unknown): ErrorClassification;
/**
 * Check if an error is recoverable (transient)
 *
 * @param error - The error to check
 * @returns true if the error is recoverable
 */
export declare function isRecoverableError(error: unknown): boolean;
/**
 * Execute options for GitHub CLI commands
 */
export interface ExecOptions {
    timeout?: number;
    silent?: boolean;
}
/**
 * Execute a gh CLI command and return the output
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The command output as a string
 * @throws Error if the command fails
 */
export declare function execGh(command: string, options?: ExecOptions): string;
/**
 * Execute a gh CLI command and return parsed JSON
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The parsed JSON response
 * @throws Error if the command fails or JSON parsing fails
 */
export declare function execGhJson<T = unknown>(command: string, options?: ExecOptions): T;
/**
 * Safely execute a gh CLI command, returning null on failure
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The command output or null on failure
 */
export declare function safeExecGh(command: string, options?: ExecOptions): string | null;
/**
 * Safely execute a gh CLI command and return parsed JSON, returning null on failure
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The parsed JSON response or null on failure
 */
export declare function safeExecGhJson<T = unknown>(command: string, options?: ExecOptions): T | null;
/**
 * Combined options for exec with retry support
 */
export interface ExecWithRetryOptions extends ExecOptions, RetryOptions {
}
/**
 * Execute a gh CLI command with automatic retry for transient failures
 *
 * This function provides resilience against:
 * - Rate limiting (with optional retry-after header support)
 * - Server errors (502, 503, 504)
 * - Network errors (timeout, connection reset, etc.)
 *
 * Non-recoverable errors (401, 403, 404, 422) are thrown immediately without retry.
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution and retry options
 * @returns The command output as a string
 * @throws Error if the command fails after all retries or encounters non-recoverable error
 */
export declare function execGhWithRetry(command: string, options?: ExecWithRetryOptions): Promise<string>;
/**
 * Execute a gh CLI command with retry and return parsed JSON
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution and retry options
 * @returns The parsed JSON response
 * @throws Error if the command fails after all retries or JSON parsing fails
 */
export declare function execGhJsonWithRetry<T = unknown>(command: string, options?: ExecWithRetryOptions): Promise<T>;
/**
 * Safely execute a gh CLI command with retry, returning null on permanent failure
 *
 * This function:
 * - Retries transient errors (rate limits, server errors, network errors)
 * - Returns null for non-recoverable errors (auth, not found, validation)
 * - Returns null if all retry attempts are exhausted
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution and retry options
 * @returns The command output or null on failure
 */
export declare function safeExecGhWithRetry(command: string, options?: ExecWithRetryOptions): Promise<string | null>;
/**
 * Safely execute a gh CLI command with retry and return parsed JSON, returning null on failure
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution and retry options
 * @returns The parsed JSON response or null on failure
 */
export declare function safeExecGhJsonWithRetry<T = unknown>(command: string, options?: ExecWithRetryOptions): Promise<T | null>;
/**
 * Issue data returned from GitHub API
 */
export interface IssueData {
    number: number;
    title: string;
    body?: string;
    state: string;
    url: string;
    labels: Array<{
        name: string;
    }>;
}
/**
 * Fetch issue details from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns Issue data or null if not found
 */
export declare function fetchIssue(issueNumber: number, repo: string): IssueData | null;
/**
 * Fetch issue title from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns The issue title or null if not found
 */
export declare function fetchIssueTitle(issueNumber: number, repo: string): string | null;
/**
 * Fetch issue body from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns The issue body or null if not found
 */
export declare function fetchIssueBody(issueNumber: number, repo: string): string | null;
/**
 * Fetch issue labels from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns Array of label names (lowercase) or empty array
 */
export declare function fetchIssueLabels(issueNumber: number, repo: string): string[];
/**
 * Check if an issue exists in GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns true if the issue exists
 */
export declare function issueExists(issueNumber: number, repo: string): boolean;
/**
 * Add a label to an issue
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @param label - The label to add
 * @returns true if successful
 */
export declare function addIssueLabel(issueNumber: number, repo: string, label: string): boolean;
/**
 * PR data returned from GitHub API
 */
export interface PullRequestData {
    number: number;
    title: string;
    url: string;
    state: string;
    headRefName: string;
}
/**
 * Search for a PR by issue number
 *
 * @param issueNumber - The issue number to search for
 * @param repo - Repository in owner/repo format
 * @returns The PR URL or null if not found
 */
export declare function fetchPrUrl(issueNumber: number, repo: string): string | null;
/**
 * List open PRs for a repository
 *
 * @param repo - Repository in owner/repo format
 * @returns Array of PR data or empty array
 */
export declare function listOpenPrs(repo: string): PullRequestData[];
/**
 * Project item from GitHub project board
 */
export interface ProjectItem {
    id: string;
    status: string;
    content?: {
        type: string;
        number: number;
        title: string;
        url: string;
    };
}
/**
 * Project items list response
 */
export interface ProjectItemsResponse {
    items: ProjectItem[];
}
/**
 * Fetch items from a GitHub project board
 *
 * @param projectNumber - The project number
 * @param owner - The project owner (user or org)
 * @param limit - Maximum items to fetch (default 100)
 * @returns The items response or null on failure
 */
export declare function fetchProjectItems(projectNumber: string, owner: string, limit?: number): ProjectItemsResponse | null;
/**
 * Project field data
 */
export interface ProjectField {
    id: string;
    name: string;
    options?: Array<{
        id: string;
        name: string;
    }>;
}
/**
 * Fetch project fields
 *
 * @param projectNumber - The project number
 * @param owner - The project owner
 * @returns Array of fields or null on failure
 */
export declare function fetchProjectFields(projectNumber: string, owner: string): {
    fields: ProjectField[];
} | null;
/**
 * Project data
 */
export interface ProjectData {
    id: string;
    number: number;
    title: string;
}
/**
 * Fetch projects for an owner
 *
 * @param owner - The project owner
 * @returns Array of projects or null on failure
 */
export declare function fetchProjects(owner: string): {
    projects: ProjectData[];
} | null;
/**
 * Move a project item to a different status
 *
 * @param projectId - The project ID
 * @param itemId - The item ID
 * @param fieldId - The status field ID
 * @param optionId - The status option ID
 * @returns true if successful
 */
export declare function moveProjectItem(projectId: string, itemId: string, fieldId: string, optionId: string): boolean;
/**
 * Add an issue to a project
 *
 * @param projectNumber - The project number
 * @param owner - The project owner
 * @param issueUrl - The issue URL to add
 * @returns true if successful
 */
export declare function addIssueToProject(projectNumber: string, owner: string, issueUrl: string): boolean;
/**
 * GitHub API rate limit data
 */
export interface RateLimitResponse {
    resources: {
        core: {
            limit: number;
            remaining: number;
            reset: number;
            used: number;
        };
        graphql: {
            limit: number;
            remaining: number;
            reset: number;
            used: number;
        };
    };
}
/**
 * Fetch GitHub API rate limit status
 *
 * @returns Rate limit data or null on failure
 */
export declare function fetchRateLimit(): RateLimitResponse | null;
//# sourceMappingURL=github.d.ts.map