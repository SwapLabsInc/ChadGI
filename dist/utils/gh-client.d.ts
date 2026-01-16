/**
 * High-level GitHub operations abstraction layer.
 *
 * Provides a fluent, type-safe API for common GitHub operations via the `gh` CLI.
 * All methods use the existing retry logic from utils/github.ts internally.
 *
 * @example
 * ```typescript
 * import { gh } from './utils/gh-client.js';
 *
 * // Get issue details
 * const issue = await gh.issue.get(123, 'owner/repo');
 *
 * // Create an issue
 * const newIssue = await gh.issue.create({
 *   title: 'Bug fix',
 *   body: 'Description',
 *   labels: ['bug'],
 *   repo: 'owner/repo'
 * });
 *
 * // Get project items
 * const items = await gh.project.getItems(7, 'owner', { status: 'Ready' });
 *
 * // Create a PR
 * const pr = await gh.pr.create({
 *   title: 'Add feature',
 *   body: 'Description',
 *   base: 'main',
 *   head: 'feature-branch',
 *   repo: 'owner/repo'
 * });
 * ```
 */
import { type ExecWithRetryOptions } from './github.js';
import { type ErrorContext, type ErrorContextIdentifiers, type OperationType } from './errors.js';
/**
 * Error codes for GitHub client operations
 */
export type GhClientErrorCode = 'NOT_FOUND' | 'AUTH_ERROR' | 'RATE_LIMIT' | 'VALIDATION_ERROR' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'UNKNOWN';
/**
 * Custom error class for GitHub client operations with specific error codes
 */
export declare class GhClientError extends Error {
    /** Error code for classification */
    readonly code: GhClientErrorCode;
    /** Original error that caused this error */
    readonly cause?: Error;
    /** Operation context for enriched diagnostics */
    operationContext?: ErrorContext;
    constructor(message: string, code: GhClientErrorCode, cause?: Error, operationContext?: ErrorContext);
    /**
     * Serialize error to a plain object for JSON output.
     */
    toJSON(): Record<string, unknown>;
    /**
     * Create a GhClientError from a raw error with optional operation context.
     *
     * @param error - The original error
     * @param contextDescription - Human-readable context description
     * @param operationContext - Optional ErrorContext for enriched diagnostics
     */
    static fromError(error: unknown, contextDescription: string, operationContext?: ErrorContext): GhClientError;
    /**
     * Create a GhClientError with context for a GitHub API operation.
     *
     * Convenience method that creates an ErrorContext and wraps the error.
     *
     * @param error - The original error
     * @param operation - Operation type (e.g., 'github-issue', 'github-pr')
     * @param identifiers - Relevant identifiers (repo, issue number, etc.)
     * @param contextDescription - Human-readable context description
     * @param startTime - Operation start time (for duration calculation)
     */
    static fromErrorWithContext(error: unknown, operation: OperationType, identifiers: ErrorContextIdentifiers, contextDescription: string, startTime?: Date): GhClientError;
}
/**
 * Base options for all GitHub client operations
 */
export interface GhClientOptions extends ExecWithRetryOptions {
    /** Whether to suppress retry logging */
    silent?: boolean;
}
/**
 * GitHub user or actor
 */
export interface GitHubActor {
    login: string;
    name?: string;
    url?: string;
}
/**
 * GitHub label
 */
export interface GitHubLabel {
    name: string;
    color?: string;
    description?: string;
}
/**
 * Issue data returned from GitHub API
 */
export interface Issue {
    number: number;
    title: string;
    body: string;
    state: 'OPEN' | 'CLOSED';
    url: string;
    labels: GitHubLabel[];
    author?: GitHubActor;
    assignees?: GitHubActor[];
    createdAt?: string;
    updatedAt?: string;
    closedAt?: string;
}
/**
 * Options for creating a new issue
 */
export interface CreateIssueOptions {
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
    milestone?: number;
    repo: string;
}
/**
 * Options for updating an existing issue
 */
export interface UpdateIssueOptions {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    addLabels?: string[];
    removeLabels?: string[];
    addAssignees?: string[];
    removeAssignees?: string[];
}
/**
 * Options for listing issues
 */
export interface ListIssuesOptions {
    state?: 'open' | 'closed' | 'all';
    labels?: string[];
    assignee?: string;
    limit?: number;
}
/**
 * Pull request data returned from GitHub API
 */
export interface PullRequest {
    number: number;
    title: string;
    body: string;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
    url: string;
    headRefName: string;
    baseRefName: string;
    isDraft: boolean;
    mergeable?: string;
    author?: GitHubActor;
    labels?: GitHubLabel[];
    createdAt?: string;
    updatedAt?: string;
    mergedAt?: string;
}
/**
 * Options for creating a pull request
 */
export interface CreatePullRequestOptions {
    title: string;
    body?: string;
    base: string;
    head: string;
    draft?: boolean;
    repo: string;
}
/**
 * Merge strategies for pull requests
 */
export type MergeStrategy = 'merge' | 'squash' | 'rebase';
/**
 * Options for merging a pull request
 */
export interface MergePullRequestOptions {
    strategy?: MergeStrategy;
    deleteAfterMerge?: boolean;
    commitTitle?: string;
    commitBody?: string;
}
/**
 * Project item content (Issue or PR)
 */
export interface ProjectItemContent {
    type: 'Issue' | 'PullRequest' | 'DraftIssue';
    number?: number;
    title: string;
    url?: string;
}
/**
 * Project item from GitHub project board
 */
export interface ProjectItem {
    id: string;
    status: string;
    content?: ProjectItemContent;
}
/**
 * Filter options for project items
 */
export interface ProjectItemFilter {
    status?: string;
    type?: 'Issue' | 'PullRequest' | 'DraftIssue';
}
/**
 * Project field (single select, text, number, etc.)
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
 * Project data
 */
export interface Project {
    id: string;
    number: number;
    title: string;
    url?: string;
}
/**
 * Issue-related GitHub operations
 */
export declare const issueOperations: {
    /**
     * Get issue details by number
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param options - Client options
     * @returns Issue data or null if not found
     */
    get(number: number, repo: string, options?: GhClientOptions): Promise<Issue | null>;
    /**
     * Create a new issue
     *
     * @param options - Issue creation options
     * @param clientOptions - Client options
     * @returns Created issue data
     * @throws GhClientError if creation fails (with operation context)
     */
    create(options: CreateIssueOptions, clientOptions?: GhClientOptions): Promise<Issue>;
    /**
     * Update an existing issue
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param updates - Fields to update
     * @param clientOptions - Client options
     * @returns true if successful
     * @throws GhClientError if update fails (with operation context)
     */
    update(number: number, repo: string, updates: UpdateIssueOptions, clientOptions?: GhClientOptions): Promise<boolean>;
    /**
     * Add labels to an issue
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param labels - Labels to add
     * @param clientOptions - Client options
     * @returns true if successful
     */
    addLabels(number: number, repo: string, labels: string[], clientOptions?: GhClientOptions): Promise<boolean>;
    /**
     * Close an issue
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param clientOptions - Client options
     * @returns true if successful
     * @throws GhClientError if close fails (with operation context)
     */
    close(number: number, repo: string, clientOptions?: GhClientOptions): Promise<boolean>;
    /**
     * Reopen a closed issue
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param clientOptions - Client options
     * @returns true if successful
     */
    reopen(number: number, repo: string, clientOptions?: GhClientOptions): Promise<boolean>;
    /**
     * List issues in a repository
     *
     * @param repo - Repository in owner/repo format
     * @param options - Filter options
     * @param clientOptions - Client options
     * @returns Array of issues
     */
    list(repo: string, options?: ListIssuesOptions, clientOptions?: GhClientOptions): Promise<Issue[]>;
    /**
     * Check if an issue exists
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param clientOptions - Client options
     * @returns true if the issue exists
     */
    exists(number: number, repo: string, clientOptions?: GhClientOptions): Promise<boolean>;
};
/**
 * Pull request-related GitHub operations
 */
export declare const prOperations: {
    /**
     * Get pull request details by number
     *
     * @param number - PR number
     * @param repo - Repository in owner/repo format
     * @param options - Client options
     * @returns Pull request data or null if not found
     */
    get(number: number, repo: string, options?: GhClientOptions): Promise<PullRequest | null>;
    /**
     * Create a new pull request
     *
     * @param options - PR creation options
     * @param clientOptions - Client options
     * @returns Created PR data
     * @throws GhClientError if creation fails
     */
    create(options: CreatePullRequestOptions, clientOptions?: GhClientOptions): Promise<PullRequest>;
    /**
     * Merge a pull request
     *
     * @param number - PR number
     * @param repo - Repository in owner/repo format
     * @param options - Merge options
     * @param clientOptions - Client options
     * @returns true if successful
     * @throws GhClientError if merge fails
     */
    merge(number: number, repo: string, options?: MergePullRequestOptions, clientOptions?: GhClientOptions): Promise<boolean>;
    /**
     * Close a pull request without merging
     *
     * @param number - PR number
     * @param repo - Repository in owner/repo format
     * @param clientOptions - Client options
     * @returns true if successful
     */
    close(number: number, repo: string, clientOptions?: GhClientOptions): Promise<boolean>;
    /**
     * List pull requests in a repository
     *
     * @param repo - Repository in owner/repo format
     * @param options - Filter options
     * @param clientOptions - Client options
     * @returns Array of pull requests
     */
    list(repo: string, options?: {
        state?: "open" | "closed" | "merged" | "all";
        limit?: number;
        base?: string;
    }, clientOptions?: GhClientOptions): Promise<PullRequest[]>;
};
/**
 * Project board-related GitHub operations
 */
export declare const projectOperations: {
    /**
     * Get all items from a project board
     *
     * @param projectNumber - The project number
     * @param owner - The project owner (user or org)
     * @param filter - Optional filter for items
     * @param clientOptions - Client options
     * @returns Array of project items
     */
    getItems(projectNumber: number | string, owner: string, filter?: ProjectItemFilter, clientOptions?: GhClientOptions): Promise<ProjectItem[]>;
    /**
     * Move a project item to a different status column
     *
     * @param projectId - The project ID (not number)
     * @param itemId - The item ID
     * @param fieldId - The status field ID
     * @param optionId - The status option ID
     * @param clientOptions - Client options
     * @returns true if successful
     */
    moveItem(projectId: string, itemId: string, fieldId: string, optionId: string, clientOptions?: GhClientOptions): Promise<boolean>;
    /**
     * Get project fields including status field with options
     *
     * @param projectNumber - The project number
     * @param owner - The project owner
     * @param clientOptions - Client options
     * @returns Array of project fields
     */
    getFields(projectNumber: number | string, owner: string, clientOptions?: GhClientOptions): Promise<ProjectField[]>;
    /**
     * Get status field with column options
     *
     * @param projectNumber - The project number
     * @param owner - The project owner
     * @param clientOptions - Client options
     * @returns Status field or null if not found
     */
    getStatusField(projectNumber: number | string, owner: string, clientOptions?: GhClientOptions): Promise<ProjectField | null>;
    /**
     * List all projects for an owner
     *
     * @param owner - The owner (user or org)
     * @param clientOptions - Client options
     * @returns Array of projects
     */
    list(owner: string, clientOptions?: GhClientOptions): Promise<Project[]>;
    /**
     * Add an issue to a project
     *
     * @param projectNumber - The project number
     * @param owner - The project owner
     * @param issueUrl - The URL of the issue to add
     * @param clientOptions - Client options
     * @returns true if successful
     */
    addItem(projectNumber: number | string, owner: string, issueUrl: string, clientOptions?: GhClientOptions): Promise<boolean>;
};
/**
 * Rate limit data from GitHub API
 */
export interface RateLimitInfo {
    core: {
        limit: number;
        remaining: number;
        reset: Date;
        used: number;
    };
    graphql: {
        limit: number;
        remaining: number;
        reset: Date;
        used: number;
    };
}
/**
 * API and rate limit operations
 */
export declare const apiOperations: {
    /**
     * Get current rate limit status
     *
     * @param clientOptions - Client options
     * @returns Rate limit information
     */
    getRateLimit(clientOptions?: GhClientOptions): Promise<RateLimitInfo>;
    /**
     * Make a raw API call
     *
     * @param endpoint - API endpoint (e.g., '/repos/owner/repo')
     * @param clientOptions - Client options
     * @returns API response
     */
    call<T>(endpoint: string, clientOptions?: GhClientOptions): Promise<T>;
};
/**
 * High-level GitHub client with fluent API
 *
 * @example
 * ```typescript
 * import { gh } from './utils/gh-client.js';
 *
 * // Issue operations
 * const issue = await gh.issue.get(123, 'owner/repo');
 * await gh.issue.create({ title: 'Bug', repo: 'owner/repo' });
 *
 * // PR operations
 * const pr = await gh.pr.get(456, 'owner/repo');
 * await gh.pr.merge(456, 'owner/repo', { strategy: 'squash' });
 *
 * // Project operations
 * const items = await gh.project.getItems(7, 'owner');
 *
 * // API operations
 * const rateLimit = await gh.api.getRateLimit();
 * ```
 */
export declare const gh: {
    issue: {
        /**
         * Get issue details by number
         *
         * @param number - Issue number
         * @param repo - Repository in owner/repo format
         * @param options - Client options
         * @returns Issue data or null if not found
         */
        get(number: number, repo: string, options?: GhClientOptions): Promise<Issue | null>;
        /**
         * Create a new issue
         *
         * @param options - Issue creation options
         * @param clientOptions - Client options
         * @returns Created issue data
         * @throws GhClientError if creation fails (with operation context)
         */
        create(options: CreateIssueOptions, clientOptions?: GhClientOptions): Promise<Issue>;
        /**
         * Update an existing issue
         *
         * @param number - Issue number
         * @param repo - Repository in owner/repo format
         * @param updates - Fields to update
         * @param clientOptions - Client options
         * @returns true if successful
         * @throws GhClientError if update fails (with operation context)
         */
        update(number: number, repo: string, updates: UpdateIssueOptions, clientOptions?: GhClientOptions): Promise<boolean>;
        /**
         * Add labels to an issue
         *
         * @param number - Issue number
         * @param repo - Repository in owner/repo format
         * @param labels - Labels to add
         * @param clientOptions - Client options
         * @returns true if successful
         */
        addLabels(number: number, repo: string, labels: string[], clientOptions?: GhClientOptions): Promise<boolean>;
        /**
         * Close an issue
         *
         * @param number - Issue number
         * @param repo - Repository in owner/repo format
         * @param clientOptions - Client options
         * @returns true if successful
         * @throws GhClientError if close fails (with operation context)
         */
        close(number: number, repo: string, clientOptions?: GhClientOptions): Promise<boolean>;
        /**
         * Reopen a closed issue
         *
         * @param number - Issue number
         * @param repo - Repository in owner/repo format
         * @param clientOptions - Client options
         * @returns true if successful
         */
        reopen(number: number, repo: string, clientOptions?: GhClientOptions): Promise<boolean>;
        /**
         * List issues in a repository
         *
         * @param repo - Repository in owner/repo format
         * @param options - Filter options
         * @param clientOptions - Client options
         * @returns Array of issues
         */
        list(repo: string, options?: ListIssuesOptions, clientOptions?: GhClientOptions): Promise<Issue[]>;
        /**
         * Check if an issue exists
         *
         * @param number - Issue number
         * @param repo - Repository in owner/repo format
         * @param clientOptions - Client options
         * @returns true if the issue exists
         */
        exists(number: number, repo: string, clientOptions?: GhClientOptions): Promise<boolean>;
    };
    pr: {
        /**
         * Get pull request details by number
         *
         * @param number - PR number
         * @param repo - Repository in owner/repo format
         * @param options - Client options
         * @returns Pull request data or null if not found
         */
        get(number: number, repo: string, options?: GhClientOptions): Promise<PullRequest | null>;
        /**
         * Create a new pull request
         *
         * @param options - PR creation options
         * @param clientOptions - Client options
         * @returns Created PR data
         * @throws GhClientError if creation fails
         */
        create(options: CreatePullRequestOptions, clientOptions?: GhClientOptions): Promise<PullRequest>;
        /**
         * Merge a pull request
         *
         * @param number - PR number
         * @param repo - Repository in owner/repo format
         * @param options - Merge options
         * @param clientOptions - Client options
         * @returns true if successful
         * @throws GhClientError if merge fails
         */
        merge(number: number, repo: string, options?: MergePullRequestOptions, clientOptions?: GhClientOptions): Promise<boolean>;
        /**
         * Close a pull request without merging
         *
         * @param number - PR number
         * @param repo - Repository in owner/repo format
         * @param clientOptions - Client options
         * @returns true if successful
         */
        close(number: number, repo: string, clientOptions?: GhClientOptions): Promise<boolean>;
        /**
         * List pull requests in a repository
         *
         * @param repo - Repository in owner/repo format
         * @param options - Filter options
         * @param clientOptions - Client options
         * @returns Array of pull requests
         */
        list(repo: string, options?: {
            state?: "open" | "closed" | "merged" | "all";
            limit?: number;
            base?: string;
        }, clientOptions?: GhClientOptions): Promise<PullRequest[]>;
    };
    project: {
        /**
         * Get all items from a project board
         *
         * @param projectNumber - The project number
         * @param owner - The project owner (user or org)
         * @param filter - Optional filter for items
         * @param clientOptions - Client options
         * @returns Array of project items
         */
        getItems(projectNumber: number | string, owner: string, filter?: ProjectItemFilter, clientOptions?: GhClientOptions): Promise<ProjectItem[]>;
        /**
         * Move a project item to a different status column
         *
         * @param projectId - The project ID (not number)
         * @param itemId - The item ID
         * @param fieldId - The status field ID
         * @param optionId - The status option ID
         * @param clientOptions - Client options
         * @returns true if successful
         */
        moveItem(projectId: string, itemId: string, fieldId: string, optionId: string, clientOptions?: GhClientOptions): Promise<boolean>;
        /**
         * Get project fields including status field with options
         *
         * @param projectNumber - The project number
         * @param owner - The project owner
         * @param clientOptions - Client options
         * @returns Array of project fields
         */
        getFields(projectNumber: number | string, owner: string, clientOptions?: GhClientOptions): Promise<ProjectField[]>;
        /**
         * Get status field with column options
         *
         * @param projectNumber - The project number
         * @param owner - The project owner
         * @param clientOptions - Client options
         * @returns Status field or null if not found
         */
        getStatusField(projectNumber: number | string, owner: string, clientOptions?: GhClientOptions): Promise<ProjectField | null>;
        /**
         * List all projects for an owner
         *
         * @param owner - The owner (user or org)
         * @param clientOptions - Client options
         * @returns Array of projects
         */
        list(owner: string, clientOptions?: GhClientOptions): Promise<Project[]>;
        /**
         * Add an issue to a project
         *
         * @param projectNumber - The project number
         * @param owner - The project owner
         * @param issueUrl - The URL of the issue to add
         * @param clientOptions - Client options
         * @returns true if successful
         */
        addItem(projectNumber: number | string, owner: string, issueUrl: string, clientOptions?: GhClientOptions): Promise<boolean>;
    };
    api: {
        /**
         * Get current rate limit status
         *
         * @param clientOptions - Client options
         * @returns Rate limit information
         */
        getRateLimit(clientOptions?: GhClientOptions): Promise<RateLimitInfo>;
        /**
         * Make a raw API call
         *
         * @param endpoint - API endpoint (e.g., '/repos/owner/repo')
         * @param clientOptions - Client options
         * @returns API response
         */
        call<T>(endpoint: string, clientOptions?: GhClientOptions): Promise<T>;
    };
};
//# sourceMappingURL=gh-client.d.ts.map