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

import {
  execGhWithRetry,
  execGhJsonWithRetry,
  safeExecGhJsonWithRetry,
  type ExecWithRetryOptions,
} from './github.js';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for GitHub client operations
 */
export type GhClientErrorCode =
  | 'NOT_FOUND'
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN';

/**
 * Custom error class for GitHub client operations with specific error codes
 */
export class GhClientError extends Error {
  constructor(
    message: string,
    public readonly code: GhClientErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'GhClientError';
  }

  /**
   * Create a GhClientError from a raw error
   */
  static fromError(error: unknown, context: string): GhClientError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Classify the error
    if (/\b404\b|not found/i.test(errorMessage)) {
      return new GhClientError(
        `${context}: Resource not found`,
        'NOT_FOUND',
        error instanceof Error ? error : undefined
      );
    }
    if (/\b401\b|\b403\b|unauthorized|forbidden|bad credentials/i.test(errorMessage)) {
      return new GhClientError(
        `${context}: Authentication failed`,
        'AUTH_ERROR',
        error instanceof Error ? error : undefined
      );
    }
    if (/rate limit|too many requests/i.test(errorMessage)) {
      return new GhClientError(
        `${context}: Rate limit exceeded`,
        'RATE_LIMIT',
        error instanceof Error ? error : undefined
      );
    }
    if (/\b422\b|validation failed|unprocessable/i.test(errorMessage)) {
      return new GhClientError(
        `${context}: Validation error - ${errorMessage}`,
        'VALIDATION_ERROR',
        error instanceof Error ? error : undefined
      );
    }
    if (/\b50[234]\b|bad gateway|service unavailable|gateway timeout/i.test(errorMessage)) {
      return new GhClientError(
        `${context}: GitHub server error`,
        'SERVER_ERROR',
        error instanceof Error ? error : undefined
      );
    }
    if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|timeout|network/i.test(errorMessage)) {
      return new GhClientError(
        `${context}: Network error`,
        'NETWORK_ERROR',
        error instanceof Error ? error : undefined
      );
    }
    if (/JSON|parse|syntax/i.test(errorMessage)) {
      return new GhClientError(
        `${context}: Failed to parse response`,
        'PARSE_ERROR',
        error instanceof Error ? error : undefined
      );
    }

    return new GhClientError(
      `${context}: ${errorMessage}`,
      'UNKNOWN',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// Common Types
// ============================================================================

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

// ============================================================================
// Issue Types
// ============================================================================

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

// ============================================================================
// Pull Request Types
// ============================================================================

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

// ============================================================================
// Project Types
// ============================================================================

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
  options?: Array<{ id: string; name: string }>;
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
  async get(
    number: number,
    repo: string,
    options: GhClientOptions = {}
  ): Promise<Issue | null> {
    const result = await safeExecGhJsonWithRetry<{
      number: number;
      title: string;
      body: string;
      state: string;
      url: string;
      labels: Array<{ name: string; color?: string; description?: string }>;
      author?: { login: string; name?: string };
      assignees?: Array<{ login: string; name?: string }>;
      createdAt?: string;
      updatedAt?: string;
      closedAt?: string;
    }>(
      `issue view ${number} --repo "${repo}" --json number,title,body,state,url,labels,author,assignees,createdAt,updatedAt,closedAt`,
      { ...options, silent: options.silent ?? true }
    );

    if (!result) return null;

    return {
      number: result.number,
      title: result.title,
      body: result.body || '',
      state: result.state.toUpperCase() as Issue['state'],
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
   * @throws GhClientError if creation fails
   */
  async create(
    options: CreateIssueOptions,
    clientOptions: GhClientOptions = {}
  ): Promise<Issue> {
    const args: string[] = [
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
      const result = await execGhJsonWithRetry<{
        number: number;
        title: string;
        body: string;
        state: string;
        url: string;
      }>(args.join(' ') + ' --json number,title,body,state,url', clientOptions);

      return {
        number: result.number,
        title: result.title,
        body: result.body || '',
        state: result.state.toUpperCase() as Issue['state'],
        url: result.url,
        labels: options.labels?.map((name) => ({ name })) || [],
      };
    } catch (error) {
      throw GhClientError.fromError(error, 'Failed to create issue');
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
   * @throws GhClientError if update fails
   */
  async update(
    number: number,
    repo: string,
    updates: UpdateIssueOptions,
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
    const args: string[] = [`issue edit ${number}`, `--repo "${repo}"`];

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
    } catch (error) {
      throw GhClientError.fromError(error, `Failed to update issue #${number}`);
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
  async addLabels(
    number: number,
    repo: string,
    labels: string[],
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
    return this.update(number, repo, { addLabels: labels }, clientOptions);
  },

  /**
   * Close an issue
   *
   * @param number - Issue number
   * @param repo - Repository in owner/repo format
   * @param clientOptions - Client options
   * @returns true if successful
   */
  async close(
    number: number,
    repo: string,
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
    try {
      await execGhWithRetry(
        `issue close ${number} --repo "${repo}"`,
        clientOptions
      );
      return true;
    } catch (error) {
      throw GhClientError.fromError(error, `Failed to close issue #${number}`);
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
  async reopen(
    number: number,
    repo: string,
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
    try {
      await execGhWithRetry(
        `issue reopen ${number} --repo "${repo}"`,
        clientOptions
      );
      return true;
    } catch (error) {
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
  async list(
    repo: string,
    options: ListIssuesOptions = {},
    clientOptions: GhClientOptions = {}
  ): Promise<Issue[]> {
    const args: string[] = [`issue list`, `--repo "${repo}"`];

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
      const result = await execGhJsonWithRetry<
        Array<{
          number: number;
          title: string;
          body: string;
          state: string;
          url: string;
          labels: Array<{ name: string }>;
          author?: { login: string };
          assignees?: Array<{ login: string }>;
          createdAt?: string;
          updatedAt?: string;
        }>
      >(args.join(' '), { ...clientOptions, silent: clientOptions.silent ?? true });

      return result.map((issue) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state.toUpperCase() as Issue['state'],
        url: issue.url,
        labels: issue.labels.map((l) => ({ name: l.name })),
        author: issue.author ? { login: issue.author.login } : undefined,
        assignees: issue.assignees?.map((a) => ({ login: a.login })),
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      }));
    } catch (error) {
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
  async exists(
    number: number,
    repo: string,
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
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
  async get(
    number: number,
    repo: string,
    options: GhClientOptions = {}
  ): Promise<PullRequest | null> {
    const result = await safeExecGhJsonWithRetry<{
      number: number;
      title: string;
      body: string;
      state: string;
      url: string;
      headRefName: string;
      baseRefName: string;
      isDraft: boolean;
      mergeable?: string;
      author?: { login: string; name?: string };
      labels?: Array<{ name: string }>;
      createdAt?: string;
      updatedAt?: string;
      mergedAt?: string;
    }>(
      `pr view ${number} --repo "${repo}" --json number,title,body,state,url,headRefName,baseRefName,isDraft,mergeable,author,labels,createdAt,updatedAt,mergedAt`,
      { ...options, silent: options.silent ?? true }
    );

    if (!result) return null;

    return {
      number: result.number,
      title: result.title,
      body: result.body || '',
      state: result.state.toUpperCase() as PullRequest['state'],
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
  async create(
    options: CreatePullRequestOptions,
    clientOptions: GhClientOptions = {}
  ): Promise<PullRequest> {
    const args: string[] = [
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
      const result = await execGhJsonWithRetry<{
        number: number;
        title: string;
        body: string;
        state: string;
        url: string;
        headRefName: string;
        baseRefName: string;
        isDraft: boolean;
      }>(args.join(' ') + ' --json number,title,body,state,url,headRefName,baseRefName,isDraft', clientOptions);

      return {
        number: result.number,
        title: result.title,
        body: result.body || '',
        state: result.state.toUpperCase() as PullRequest['state'],
        url: result.url,
        headRefName: result.headRefName,
        baseRefName: result.baseRefName,
        isDraft: result.isDraft,
      };
    } catch (error) {
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
  async merge(
    number: number,
    repo: string,
    options: MergePullRequestOptions = {},
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
    const args: string[] = [`pr merge ${number}`, `--repo "${repo}"`];

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
    } catch (error) {
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
  async close(
    number: number,
    repo: string,
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
    try {
      await execGhWithRetry(
        `pr close ${number} --repo "${repo}"`,
        clientOptions
      );
      return true;
    } catch (error) {
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
  async list(
    repo: string,
    options: { state?: 'open' | 'closed' | 'merged' | 'all'; limit?: number; base?: string } = {},
    clientOptions: GhClientOptions = {}
  ): Promise<PullRequest[]> {
    const args: string[] = [`pr list`, `--repo "${repo}"`];

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
      const result = await execGhJsonWithRetry<
        Array<{
          number: number;
          title: string;
          body: string;
          state: string;
          url: string;
          headRefName: string;
          baseRefName: string;
          isDraft: boolean;
          author?: { login: string };
          labels?: Array<{ name: string }>;
          createdAt?: string;
          updatedAt?: string;
        }>
      >(args.join(' '), { ...clientOptions, silent: clientOptions.silent ?? true });

      return result.map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.state.toUpperCase() as PullRequest['state'],
        url: pr.url,
        headRefName: pr.headRefName,
        baseRefName: pr.baseRefName,
        isDraft: pr.isDraft,
        author: pr.author ? { login: pr.author.login } : undefined,
        labels: pr.labels?.map((l) => ({ name: l.name })),
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
      }));
    } catch (error) {
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
  async getItems(
    projectNumber: number | string,
    owner: string,
    filter?: ProjectItemFilter,
    clientOptions: GhClientOptions = {}
  ): Promise<ProjectItem[]> {
    try {
      const result = await execGhJsonWithRetry<{
        items: Array<{
          id: string;
          status: string;
          content?: {
            type: string;
            number?: number;
            title: string;
            url?: string;
          };
        }>;
      }>(
        `project item-list ${projectNumber} --owner "${owner}" --format json --limit 100`,
        { ...clientOptions, silent: clientOptions.silent ?? true }
      );

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
              type: item.content.type as ProjectItemContent['type'],
              number: item.content.number,
              title: item.content.title,
              url: item.content.url,
            }
          : undefined,
      }));
    } catch (error) {
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
  async moveItem(
    projectId: string,
    itemId: string,
    fieldId: string,
    optionId: string,
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
    try {
      await execGhWithRetry(
        `project item-edit --project-id "${projectId}" --id "${itemId}" --field-id "${fieldId}" --single-select-option-id "${optionId}"`,
        clientOptions
      );
      return true;
    } catch (error) {
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
  async getFields(
    projectNumber: number | string,
    owner: string,
    clientOptions: GhClientOptions = {}
  ): Promise<ProjectField[]> {
    try {
      const result = await execGhJsonWithRetry<{
        fields: Array<{
          id: string;
          name: string;
          options?: Array<{ id: string; name: string }>;
        }>;
      }>(
        `project field-list ${projectNumber} --owner "${owner}" --format json`,
        { ...clientOptions, silent: clientOptions.silent ?? true }
      );

      return (result.fields || []).map((field) => ({
        id: field.id,
        name: field.name,
        options: field.options,
      }));
    } catch (error) {
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
  async getStatusField(
    projectNumber: number | string,
    owner: string,
    clientOptions: GhClientOptions = {}
  ): Promise<ProjectField | null> {
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
  async list(
    owner: string,
    clientOptions: GhClientOptions = {}
  ): Promise<Project[]> {
    try {
      const result = await execGhJsonWithRetry<{
        projects: Array<{
          id: string;
          number: number;
          title: string;
          url?: string;
        }>;
      }>(
        `project list --owner "${owner}" --format json`,
        { ...clientOptions, silent: clientOptions.silent ?? true }
      );

      return (result.projects || []).map((p) => ({
        id: p.id,
        number: p.number,
        title: p.title,
        url: p.url,
      }));
    } catch (error) {
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
  async addItem(
    projectNumber: number | string,
    owner: string,
    issueUrl: string,
    clientOptions: GhClientOptions = {}
  ): Promise<boolean> {
    try {
      await execGhWithRetry(
        `project item-add ${projectNumber} --owner "${owner}" --url "${issueUrl}"`,
        clientOptions
      );
      return true;
    } catch (error) {
      throw GhClientError.fromError(error, 'Failed to add item to project');
    }
  },
};

// ============================================================================
// Rate Limit Operations
// ============================================================================

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
export const apiOperations = {
  /**
   * Get current rate limit status
   *
   * @param clientOptions - Client options
   * @returns Rate limit information
   */
  async getRateLimit(clientOptions: GhClientOptions = {}): Promise<RateLimitInfo> {
    try {
      const result = await execGhJsonWithRetry<{
        resources: {
          core: { limit: number; remaining: number; reset: number; used: number };
          graphql: { limit: number; remaining: number; reset: number; used: number };
        };
      }>('api rate_limit', { ...clientOptions, silent: clientOptions.silent ?? true });

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
    } catch (error) {
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
  async call<T>(
    endpoint: string,
    clientOptions: GhClientOptions = {}
  ): Promise<T> {
    try {
      return await execGhJsonWithRetry<T>(
        `api ${endpoint}`,
        { ...clientOptions, silent: clientOptions.silent ?? true }
      );
    } catch (error) {
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
function escapeString(str: string): string {
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
