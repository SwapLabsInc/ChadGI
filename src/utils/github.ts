/**
 * GitHub CLI wrapper functions for ChadGI.
 *
 * Provides common GitHub operations using the `gh` CLI tool.
 */

import { execSync } from 'child_process';

const DEFAULT_TIMEOUT = 10000;

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
export function execGh(command: string, options: ExecOptions = {}): string {
  const { timeout = DEFAULT_TIMEOUT } = options;

  return execSync(`gh ${command}`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout,
  });
}

/**
 * Execute a gh CLI command and return parsed JSON
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The parsed JSON response
 * @throws Error if the command fails or JSON parsing fails
 */
export function execGhJson<T = unknown>(command: string, options: ExecOptions = {}): T {
  const output = execGh(command, options);
  return JSON.parse(output) as T;
}

/**
 * Safely execute a gh CLI command, returning null on failure
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The command output or null on failure
 */
export function safeExecGh(command: string, options: ExecOptions = {}): string | null {
  try {
    return execGh(command, options);
  } catch {
    return null;
  }
}

/**
 * Safely execute a gh CLI command and return parsed JSON, returning null on failure
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The parsed JSON response or null on failure
 */
export function safeExecGhJson<T = unknown>(command: string, options: ExecOptions = {}): T | null {
  try {
    return execGhJson<T>(command, options);
  } catch {
    return null;
  }
}

// ============================================================================
// Issue Operations
// ============================================================================

/**
 * Issue data returned from GitHub API
 */
export interface IssueData {
  number: number;
  title: string;
  body?: string;
  state: string;
  url: string;
  labels: Array<{ name: string }>;
}

/**
 * Fetch issue details from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns Issue data or null if not found
 */
export function fetchIssue(issueNumber: number, repo: string): IssueData | null {
  return safeExecGhJson<IssueData>(
    `issue view ${issueNumber} --repo "${repo}" --json number,title,body,state,url,labels`
  );
}

/**
 * Fetch issue title from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns The issue title or null if not found
 */
export function fetchIssueTitle(issueNumber: number, repo: string): string | null {
  const data = safeExecGhJson<{ title: string }>(
    `issue view ${issueNumber} --repo "${repo}" --json title`
  );
  return data?.title || null;
}

/**
 * Fetch issue body from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns The issue body or null if not found
 */
export function fetchIssueBody(issueNumber: number, repo: string): string | null {
  const data = safeExecGhJson<{ body: string }>(
    `issue view ${issueNumber} --repo "${repo}" --json body`
  );
  return data?.body || null;
}

/**
 * Fetch issue labels from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns Array of label names (lowercase) or empty array
 */
export function fetchIssueLabels(issueNumber: number, repo: string): string[] {
  try {
    const output = execGh(
      `issue view ${issueNumber} --repo "${repo}" --json labels -q '.labels[].name'`
    );
    return output
      .trim()
      .split('\n')
      .filter((l) => l)
      .map((l) => l.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Check if an issue exists in GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns true if the issue exists
 */
export function issueExists(issueNumber: number, repo: string): boolean {
  const result = safeExecGhJson<{ number: number }>(
    `issue view ${issueNumber} --repo "${repo}" --json number`
  );
  return result !== null;
}

/**
 * Add a label to an issue
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @param label - The label to add
 * @returns true if successful
 */
export function addIssueLabel(issueNumber: number, repo: string, label: string): boolean {
  return safeExecGh(`issue edit ${issueNumber} --repo "${repo}" --add-label "${label}"`) !== null;
}

// ============================================================================
// Pull Request Operations
// ============================================================================

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
export function fetchPrUrl(issueNumber: number, repo: string): string | null {
  // Try searching by keywords that link to the issue
  const keywords = ['fixes', 'closes', 'resolves'];
  for (const keyword of keywords) {
    const prs = safeExecGhJson<Array<{ url: string }>>(
      `pr list --repo "${repo}" --state merged --search "${keyword} #${issueNumber}" --json url --limit 1`
    );
    if (prs && prs.length > 0) {
      return prs[0].url;
    }
  }

  // Try searching by branch pattern
  const branchPrs = safeExecGhJson<Array<{ url: string }>>(
    `pr list --repo "${repo}" --state merged --search "head:feature/issue-${issueNumber}" --json url --limit 1`
  );
  if (branchPrs && branchPrs.length > 0) {
    return branchPrs[0].url;
  }

  return null;
}

/**
 * List open PRs for a repository
 *
 * @param repo - Repository in owner/repo format
 * @returns Array of PR data or empty array
 */
export function listOpenPrs(repo: string): PullRequestData[] {
  return safeExecGhJson<PullRequestData[]>(
    `pr list --repo "${repo}" --state open --json number,title,url,state,headRefName`
  ) || [];
}

// ============================================================================
// Project Board Operations
// ============================================================================

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
export function fetchProjectItems(
  projectNumber: string,
  owner: string,
  limit: number = 100
): ProjectItemsResponse | null {
  return safeExecGhJson<ProjectItemsResponse>(
    `project item-list ${projectNumber} --owner "${owner}" --format json --limit ${limit}`
  );
}

/**
 * Project field data
 */
export interface ProjectField {
  id: string;
  name: string;
  options?: Array<{ id: string; name: string }>;
}

/**
 * Fetch project fields
 *
 * @param projectNumber - The project number
 * @param owner - The project owner
 * @returns Array of fields or null on failure
 */
export function fetchProjectFields(
  projectNumber: string,
  owner: string
): { fields: ProjectField[] } | null {
  return safeExecGhJson<{ fields: ProjectField[] }>(
    `project field-list ${projectNumber} --owner "${owner}" --format json`
  );
}

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
export function fetchProjects(owner: string): { projects: ProjectData[] } | null {
  return safeExecGhJson<{ projects: ProjectData[] }>(
    `project list --owner "${owner}" --format json`
  );
}

/**
 * Move a project item to a different status
 *
 * @param projectId - The project ID
 * @param itemId - The item ID
 * @param fieldId - The status field ID
 * @param optionId - The status option ID
 * @returns true if successful
 */
export function moveProjectItem(
  projectId: string,
  itemId: string,
  fieldId: string,
  optionId: string
): boolean {
  return (
    safeExecGh(
      `project item-edit --project-id "${projectId}" --id "${itemId}" --field-id "${fieldId}" --single-select-option-id "${optionId}"`
    ) !== null
  );
}

/**
 * Add an issue to a project
 *
 * @param projectNumber - The project number
 * @param owner - The project owner
 * @param issueUrl - The issue URL to add
 * @returns true if successful
 */
export function addIssueToProject(
  projectNumber: string,
  owner: string,
  issueUrl: string
): boolean {
  return (
    safeExecGh(
      `project item-add ${projectNumber} --owner "${owner}" --url "${issueUrl}"`
    ) !== null
  );
}

// ============================================================================
// Rate Limit Operations
// ============================================================================

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
export function fetchRateLimit(): RateLimitResponse | null {
  return safeExecGhJson<RateLimitResponse>('api rate_limit');
}
