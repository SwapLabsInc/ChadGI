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
import { execGhWithRetry, execGhJsonWithRetry, safeExecGhJsonWithRetry, } from './github.js';
import { createErrorContext, } from './errors.js';
/**
 * Custom error class for GitHub client operations with specific error codes
 */
export class GhClientError extends Error {
    /** Error code for classification */
    code;
    /** Original error that caused this error */
    cause;
    /** Operation context for enriched diagnostics */
    operationContext;
    constructor(message, code, cause, operationContext) {
        super(message);
        this.name = 'GhClientError';
        this.code = code;
        this.cause = cause;
        this.operationContext = operationContext;
    }
    /**
     * Serialize error to a plain object for JSON output.
     */
    toJSON() {
        const result = {
            name: this.name,
            code: this.code,
            message: this.message,
        };
        if (this.operationContext) {
            result.context = {
                operation: this.operationContext.operation,
                identifiers: this.operationContext.identifiers,
                startedAt: this.operationContext.startedAt.toISOString(),
                durationMs: this.operationContext.durationMs,
                metadata: this.operationContext.metadata,
            };
        }
        return result;
    }
    /**
     * Create a GhClientError from a raw error with optional operation context.
     *
     * @param error - The original error
     * @param contextDescription - Human-readable context description
     * @param operationContext - Optional ErrorContext for enriched diagnostics
     */
    static fromError(error, contextDescription, operationContext) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Compute duration if context is provided
        let enrichedContext = operationContext;
        if (operationContext && operationContext.durationMs === undefined) {
            enrichedContext = {
                ...operationContext,
                durationMs: Date.now() - operationContext.startedAt.getTime(),
            };
        }
        // Classify the error
        if (/\b404\b|not found/i.test(errorMessage)) {
            return new GhClientError(`${contextDescription}: Resource not found`, 'NOT_FOUND', error instanceof Error ? error : undefined, enrichedContext);
        }
        if (/\b401\b|\b403\b|unauthorized|forbidden|bad credentials/i.test(errorMessage)) {
            return new GhClientError(`${contextDescription}: Authentication failed`, 'AUTH_ERROR', error instanceof Error ? error : undefined, enrichedContext);
        }
        if (/rate limit|too many requests/i.test(errorMessage)) {
            return new GhClientError(`${contextDescription}: Rate limit exceeded`, 'RATE_LIMIT', error instanceof Error ? error : undefined, enrichedContext);
        }
        if (/\b422\b|validation failed|unprocessable/i.test(errorMessage)) {
            return new GhClientError(`${contextDescription}: Validation error - ${errorMessage}`, 'VALIDATION_ERROR', error instanceof Error ? error : undefined, enrichedContext);
        }
        if (/\b50[234]\b|bad gateway|service unavailable|gateway timeout/i.test(errorMessage)) {
            return new GhClientError(`${contextDescription}: GitHub server error`, 'SERVER_ERROR', error instanceof Error ? error : undefined, enrichedContext);
        }
        if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|timeout|network/i.test(errorMessage)) {
            return new GhClientError(`${contextDescription}: Network error`, 'NETWORK_ERROR', error instanceof Error ? error : undefined, enrichedContext);
        }
        if (/JSON|parse|syntax/i.test(errorMessage)) {
            return new GhClientError(`${contextDescription}: Failed to parse response`, 'PARSE_ERROR', error instanceof Error ? error : undefined, enrichedContext);
        }
        return new GhClientError(`${contextDescription}: ${errorMessage}`, 'UNKNOWN', error instanceof Error ? error : undefined, enrichedContext);
    }
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
    static fromErrorWithContext(error, operation, identifiers, contextDescription, startTime) {
        const context = createErrorContext({
            operation,
            identifiers,
        });
        // Use provided start time if available
        if (startTime) {
            context.startedAt = startTime;
        }
        return GhClientError.fromError(error, contextDescription, context);
    }
}
// ============================================================================
// Issue Operations
// ============================================================================
/**
 * Issue-related GitHub operations
 */
export const issueOperations = {
    /**
     * Get issue details by number
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param options - Client options
     * @returns Issue data or null if not found
     */
    async get(number, repo, options = {}) {
        const result = await safeExecGhJsonWithRetry(`issue view ${number} --repo "${repo}" --json number,title,body,state,url,labels,author,assignees,createdAt,updatedAt,closedAt`, { ...options, silent: options.silent ?? true });
        if (!result)
            return null;
        return {
            number: result.number,
            title: result.title,
            body: result.body || '',
            state: result.state.toUpperCase(),
            url: result.url,
            labels: result.labels.map((l) => ({
                name: l.name,
                color: l.color,
                description: l.description,
            })),
            author: result.author ? { login: result.author.login, name: result.author.name } : undefined,
            assignees: result.assignees?.map((a) => ({ login: a.login, name: a.name })),
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            closedAt: result.closedAt,
        };
    },
    /**
     * Create a new issue
     *
     * @param options - Issue creation options
     * @param clientOptions - Client options
     * @returns Created issue data
     * @throws GhClientError if creation fails (with operation context)
     */
    async create(options, clientOptions = {}) {
        const startTime = new Date();
        const args = [
            `issue create`,
            `--repo "${options.repo}"`,
            `--title "${escapeString(options.title)}"`,
        ];
        if (options.body) {
            args.push(`--body "${escapeString(options.body)}"`);
        }
        if (options.labels && options.labels.length > 0) {
            args.push(`--label "${options.labels.join(',')}"`);
        }
        if (options.assignees && options.assignees.length > 0) {
            args.push(`--assignee "${options.assignees.join(',')}"`);
        }
        if (options.milestone) {
            args.push(`--milestone ${options.milestone}`);
        }
        try {
            const result = await execGhJsonWithRetry(args.join(' ') + ' --json number,title,body,state,url', clientOptions);
            return {
                number: result.number,
                title: result.title,
                body: result.body || '',
                state: result.state.toUpperCase(),
                url: result.url,
                labels: options.labels?.map((name) => ({ name })) || [],
            };
        }
        catch (error) {
            throw GhClientError.fromErrorWithContext(error, 'github-issue', { repo: options.repo }, 'Failed to create issue', startTime);
        }
    },
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
    async update(number, repo, updates, clientOptions = {}) {
        const startTime = new Date();
        const args = [`issue edit ${number}`, `--repo "${repo}"`];
        if (updates.title) {
            args.push(`--title "${escapeString(updates.title)}"`);
        }
        if (updates.body !== undefined) {
            args.push(`--body "${escapeString(updates.body)}"`);
        }
        if (updates.addLabels && updates.addLabels.length > 0) {
            args.push(`--add-label "${updates.addLabels.join(',')}"`);
        }
        if (updates.removeLabels && updates.removeLabels.length > 0) {
            args.push(`--remove-label "${updates.removeLabels.join(',')}"`);
        }
        if (updates.addAssignees && updates.addAssignees.length > 0) {
            args.push(`--add-assignee "${updates.addAssignees.join(',')}"`);
        }
        if (updates.removeAssignees && updates.removeAssignees.length > 0) {
            args.push(`--remove-assignee "${updates.removeAssignees.join(',')}"`);
        }
        try {
            await execGhWithRetry(args.join(' '), clientOptions);
            return true;
        }
        catch (error) {
            throw GhClientError.fromErrorWithContext(error, 'github-issue', { issueNumber: number, repo }, `Failed to update issue #${number}`, startTime);
        }
    },
    /**
     * Add labels to an issue
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param labels - Labels to add
     * @param clientOptions - Client options
     * @returns true if successful
     */
    async addLabels(number, repo, labels, clientOptions = {}) {
        return this.update(number, repo, { addLabels: labels }, clientOptions);
    },
    /**
     * Close an issue
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param clientOptions - Client options
     * @returns true if successful
     * @throws GhClientError if close fails (with operation context)
     */
    async close(number, repo, clientOptions = {}) {
        const startTime = new Date();
        try {
            await execGhWithRetry(`issue close ${number} --repo "${repo}"`, clientOptions);
            return true;
        }
        catch (error) {
            throw GhClientError.fromErrorWithContext(error, 'github-issue', { issueNumber: number, repo }, `Failed to close issue #${number}`, startTime);
        }
    },
    /**
     * Reopen a closed issue
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param clientOptions - Client options
     * @returns true if successful
     */
    async reopen(number, repo, clientOptions = {}) {
        try {
            await execGhWithRetry(`issue reopen ${number} --repo "${repo}"`, clientOptions);
            return true;
        }
        catch (error) {
            throw GhClientError.fromError(error, `Failed to reopen issue #${number}`);
        }
    },
    /**
     * List issues in a repository
     *
     * @param repo - Repository in owner/repo format
     * @param options - Filter options
     * @param clientOptions - Client options
     * @returns Array of issues
     */
    async list(repo, options = {}, clientOptions = {}) {
        const args = [`issue list`, `--repo "${repo}"`];
        if (options.state) {
            args.push(`--state ${options.state}`);
        }
        if (options.labels && options.labels.length > 0) {
            args.push(`--label "${options.labels.join(',')}"`);
        }
        if (options.assignee) {
            args.push(`--assignee "${options.assignee}"`);
        }
        if (options.limit) {
            args.push(`--limit ${options.limit}`);
        }
        args.push('--json number,title,body,state,url,labels,author,assignees,createdAt,updatedAt');
        try {
            const result = await execGhJsonWithRetry(args.join(' '), { ...clientOptions, silent: clientOptions.silent ?? true });
            return result.map((issue) => ({
                number: issue.number,
                title: issue.title,
                body: issue.body || '',
                state: issue.state.toUpperCase(),
                url: issue.url,
                labels: issue.labels.map((l) => ({ name: l.name })),
                author: issue.author ? { login: issue.author.login } : undefined,
                assignees: issue.assignees?.map((a) => ({ login: a.login })),
                createdAt: issue.createdAt,
                updatedAt: issue.updatedAt,
            }));
        }
        catch (error) {
            throw GhClientError.fromError(error, 'Failed to list issues');
        }
    },
    /**
     * Check if an issue exists
     *
     * @param number - Issue number
     * @param repo - Repository in owner/repo format
     * @param clientOptions - Client options
     * @returns true if the issue exists
     */
    async exists(number, repo, clientOptions = {}) {
        const result = await this.get(number, repo, clientOptions);
        return result !== null;
    },
};
// ============================================================================
// Pull Request Operations
// ============================================================================
/**
 * Pull request-related GitHub operations
 */
export const prOperations = {
    /**
     * Get pull request details by number
     *
     * @param number - PR number
     * @param repo - Repository in owner/repo format
     * @param options - Client options
     * @returns Pull request data or null if not found
     */
    async get(number, repo, options = {}) {
        const result = await safeExecGhJsonWithRetry(`pr view ${number} --repo "${repo}" --json number,title,body,state,url,headRefName,baseRefName,isDraft,mergeable,author,labels,createdAt,updatedAt,mergedAt`, { ...options, silent: options.silent ?? true });
        if (!result)
            return null;
        return {
            number: result.number,
            title: result.title,
            body: result.body || '',
            state: result.state.toUpperCase(),
            url: result.url,
            headRefName: result.headRefName,
            baseRefName: result.baseRefName,
            isDraft: result.isDraft,
            mergeable: result.mergeable,
            author: result.author ? { login: result.author.login, name: result.author.name } : undefined,
            labels: result.labels?.map((l) => ({ name: l.name })),
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            mergedAt: result.mergedAt,
        };
    },
    /**
     * Create a new pull request
     *
     * @param options - PR creation options
     * @param clientOptions - Client options
     * @returns Created PR data
     * @throws GhClientError if creation fails
     */
    async create(options, clientOptions = {}) {
        const args = [
            `pr create`,
            `--repo "${options.repo}"`,
            `--title "${escapeString(options.title)}"`,
            `--base "${options.base}"`,
            `--head "${options.head}"`,
        ];
        if (options.body) {
            args.push(`--body "${escapeString(options.body)}"`);
        }
        if (options.draft) {
            args.push('--draft');
        }
        try {
            const result = await execGhJsonWithRetry(args.join(' ') + ' --json number,title,body,state,url,headRefName,baseRefName,isDraft', clientOptions);
            return {
                number: result.number,
                title: result.title,
                body: result.body || '',
                state: result.state.toUpperCase(),
                url: result.url,
                headRefName: result.headRefName,
                baseRefName: result.baseRefName,
                isDraft: result.isDraft,
            };
        }
        catch (error) {
            throw GhClientError.fromError(error, 'Failed to create pull request');
        }
    },
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
    async merge(number, repo, options = {}, clientOptions = {}) {
        const args = [`pr merge ${number}`, `--repo "${repo}"`];
        // Default to squash merge
        const strategy = options.strategy || 'squash';
        args.push(`--${strategy}`);
        if (options.deleteAfterMerge !== false) {
            args.push('--delete-branch');
        }
        if (options.commitTitle) {
            args.push(`--subject "${escapeString(options.commitTitle)}"`);
        }
        if (options.commitBody) {
            args.push(`--body "${escapeString(options.commitBody)}"`);
        }
        try {
            await execGhWithRetry(args.join(' '), clientOptions);
            return true;
        }
        catch (error) {
            throw GhClientError.fromError(error, `Failed to merge PR #${number}`);
        }
    },
    /**
     * Close a pull request without merging
     *
     * @param number - PR number
     * @param repo - Repository in owner/repo format
     * @param clientOptions - Client options
     * @returns true if successful
     */
    async close(number, repo, clientOptions = {}) {
        try {
            await execGhWithRetry(`pr close ${number} --repo "${repo}"`, clientOptions);
            return true;
        }
        catch (error) {
            throw GhClientError.fromError(error, `Failed to close PR #${number}`);
        }
    },
    /**
     * List pull requests in a repository
     *
     * @param repo - Repository in owner/repo format
     * @param options - Filter options
     * @param clientOptions - Client options
     * @returns Array of pull requests
     */
    async list(repo, options = {}, clientOptions = {}) {
        const args = [`pr list`, `--repo "${repo}"`];
        if (options.state) {
            args.push(`--state ${options.state}`);
        }
        if (options.limit) {
            args.push(`--limit ${options.limit}`);
        }
        if (options.base) {
            args.push(`--base "${options.base}"`);
        }
        args.push('--json number,title,body,state,url,headRefName,baseRefName,isDraft,author,labels,createdAt,updatedAt');
        try {
            const result = await execGhJsonWithRetry(args.join(' '), { ...clientOptions, silent: clientOptions.silent ?? true });
            return result.map((pr) => ({
                number: pr.number,
                title: pr.title,
                body: pr.body || '',
                state: pr.state.toUpperCase(),
                url: pr.url,
                headRefName: pr.headRefName,
                baseRefName: pr.baseRefName,
                isDraft: pr.isDraft,
                author: pr.author ? { login: pr.author.login } : undefined,
                labels: pr.labels?.map((l) => ({ name: l.name })),
                createdAt: pr.createdAt,
                updatedAt: pr.updatedAt,
            }));
        }
        catch (error) {
            throw GhClientError.fromError(error, 'Failed to list pull requests');
        }
    },
};
// ============================================================================
// Project Operations
// ============================================================================
/**
 * Project board-related GitHub operations
 */
export const projectOperations = {
    /**
     * Get all items from a project board
     *
     * @param projectNumber - The project number
     * @param owner - The project owner (user or org)
     * @param filter - Optional filter for items
     * @param clientOptions - Client options
     * @returns Array of project items
     */
    async getItems(projectNumber, owner, filter, clientOptions = {}) {
        try {
            const result = await execGhJsonWithRetry(`project item-list ${projectNumber} --owner "${owner}" --format json --limit 100`, { ...clientOptions, silent: clientOptions.silent ?? true });
            let items = result.items || [];
            // Apply filters
            if (filter?.status) {
                items = items.filter((item) => item.status === filter.status);
            }
            if (filter?.type) {
                items = items.filter((item) => item.content?.type === filter.type);
            }
            return items.map((item) => ({
                id: item.id,
                status: item.status,
                content: item.content
                    ? {
                        type: item.content.type,
                        number: item.content.number,
                        title: item.content.title,
                        url: item.content.url,
                    }
                    : undefined,
            }));
        }
        catch (error) {
            throw GhClientError.fromError(error, `Failed to get project items for project #${projectNumber}`);
        }
    },
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
    async moveItem(projectId, itemId, fieldId, optionId, clientOptions = {}) {
        try {
            await execGhWithRetry(`project item-edit --project-id "${projectId}" --id "${itemId}" --field-id "${fieldId}" --single-select-option-id "${optionId}"`, clientOptions);
            return true;
        }
        catch (error) {
            throw GhClientError.fromError(error, 'Failed to move project item');
        }
    },
    /**
     * Get project fields including status field with options
     *
     * @param projectNumber - The project number
     * @param owner - The project owner
     * @param clientOptions - Client options
     * @returns Array of project fields
     */
    async getFields(projectNumber, owner, clientOptions = {}) {
        try {
            const result = await execGhJsonWithRetry(`project field-list ${projectNumber} --owner "${owner}" --format json`, { ...clientOptions, silent: clientOptions.silent ?? true });
            return (result.fields || []).map((field) => ({
                id: field.id,
                name: field.name,
                options: field.options,
            }));
        }
        catch (error) {
            throw GhClientError.fromError(error, `Failed to get fields for project #${projectNumber}`);
        }
    },
    /**
     * Get status field with column options
     *
     * @param projectNumber - The project number
     * @param owner - The project owner
     * @param clientOptions - Client options
     * @returns Status field or null if not found
     */
    async getStatusField(projectNumber, owner, clientOptions = {}) {
        const fields = await this.getFields(projectNumber, owner, clientOptions);
        return fields.find((f) => f.name === 'Status') || null;
    },
    /**
     * List all projects for an owner
     *
     * @param owner - The owner (user or org)
     * @param clientOptions - Client options
     * @returns Array of projects
     */
    async list(owner, clientOptions = {}) {
        try {
            const result = await execGhJsonWithRetry(`project list --owner "${owner}" --format json`, { ...clientOptions, silent: clientOptions.silent ?? true });
            return (result.projects || []).map((p) => ({
                id: p.id,
                number: p.number,
                title: p.title,
                url: p.url,
            }));
        }
        catch (error) {
            throw GhClientError.fromError(error, `Failed to list projects for ${owner}`);
        }
    },
    /**
     * Add an issue to a project
     *
     * @param projectNumber - The project number
     * @param owner - The project owner
     * @param issueUrl - The URL of the issue to add
     * @param clientOptions - Client options
     * @returns true if successful
     */
    async addItem(projectNumber, owner, issueUrl, clientOptions = {}) {
        try {
            await execGhWithRetry(`project item-add ${projectNumber} --owner "${owner}" --url "${issueUrl}"`, clientOptions);
            return true;
        }
        catch (error) {
            throw GhClientError.fromError(error, 'Failed to add item to project');
        }
    },
};
/**
 * API and rate limit operations
 */
export const apiOperations = {
    /**
     * Get current rate limit status
     *
     * @param clientOptions - Client options
     * @returns Rate limit information
     */
    async getRateLimit(clientOptions = {}) {
        try {
            const result = await execGhJsonWithRetry('api rate_limit', { ...clientOptions, silent: clientOptions.silent ?? true });
            return {
                core: {
                    limit: result.resources.core.limit,
                    remaining: result.resources.core.remaining,
                    reset: new Date(result.resources.core.reset * 1000),
                    used: result.resources.core.used,
                },
                graphql: {
                    limit: result.resources.graphql.limit,
                    remaining: result.resources.graphql.remaining,
                    reset: new Date(result.resources.graphql.reset * 1000),
                    used: result.resources.graphql.used,
                },
            };
        }
        catch (error) {
            throw GhClientError.fromError(error, 'Failed to get rate limit');
        }
    },
    /**
     * Make a raw API call
     *
     * @param endpoint - API endpoint (e.g., '/repos/owner/repo')
     * @param clientOptions - Client options
     * @returns API response
     */
    async call(endpoint, clientOptions = {}) {
        try {
            return await execGhJsonWithRetry(`api ${endpoint}`, { ...clientOptions, silent: clientOptions.silent ?? true });
        }
        catch (error) {
            throw GhClientError.fromError(error, `API call failed: ${endpoint}`);
        }
    },
};
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Escape special characters in strings for shell commands
 */
function escapeString(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`');
}
// ============================================================================
// Main Export
// ============================================================================
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
export const gh = {
    issue: issueOperations,
    pr: prOperations,
    project: projectOperations,
    api: apiOperations,
};
// Note: issueOperations, prOperations, projectOperations, and apiOperations
// are already exported via the `gh` object above. Use `gh.issue`, `gh.pr`, etc.
//# sourceMappingURL=gh-client.js.map