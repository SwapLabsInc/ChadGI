/**
 * GitHub CLI wrapper functions for ChadGI.
 *
 * Provides common GitHub operations using the `gh` CLI tool.
 * Includes retry logic with exponential backoff for transient failures.
 */
import { execSync } from 'child_process';
const DEFAULT_TIMEOUT = 10000;
// ============================================================================
// Retry Configuration
// ============================================================================
/**
 * Default retry configuration values
 */
export const RETRY_DEFAULTS = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterMs: 500,
};
// ============================================================================
// Error Patterns for Classification
// ============================================================================
/**
 * Patterns that indicate recoverable (transient) errors
 */
const RECOVERABLE_PATTERNS = [
    // Rate limiting
    /rate limit/i,
    /too many requests/i,
    /API rate limit exceeded/i,
    /secondary rate limit/i,
    // Server errors (5xx)
    /\b502\b/,
    /\b503\b/,
    /\b504\b/,
    /bad gateway/i,
    /service unavailable/i,
    /gateway timeout/i,
    // Network errors
    /ETIMEDOUT/,
    /ECONNRESET/,
    /ECONNREFUSED/,
    /ENOTFOUND/,
    /ENETUNREACH/,
    /socket hang up/i,
    /network error/i,
    /connection reset/i,
    /timeout/i,
];
/**
 * Patterns that indicate non-recoverable errors
 */
const NON_RECOVERABLE_PATTERNS = [
    // Authentication errors
    { pattern: /\b401\b/, type: 'auth_error' },
    { pattern: /\b403\b/, type: 'auth_error' },
    { pattern: /unauthorized/i, type: 'auth_error' },
    { pattern: /authentication failed/i, type: 'auth_error' },
    { pattern: /bad credentials/i, type: 'auth_error' },
    // Not found errors
    { pattern: /\b404\b/, type: 'not_found' },
    { pattern: /not found/i, type: 'not_found' },
    // Validation errors
    { pattern: /\b422\b/, type: 'validation' },
    { pattern: /validation failed/i, type: 'validation' },
    { pattern: /unprocessable/i, type: 'validation' },
];
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Calculate delay with exponential backoff and jitter
 *
 * @param attempt - Current attempt number (1-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxDelayMs - Maximum delay in milliseconds
 * @param jitterMs - Maximum jitter to add
 * @returns Calculated delay in milliseconds
 */
export function calculateBackoffDelay(attempt, baseDelayMs = RETRY_DEFAULTS.baseDelayMs, maxDelayMs = RETRY_DEFAULTS.maxDelayMs, jitterMs = RETRY_DEFAULTS.jitterMs) {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
    // Add random jitter
    const jitter = Math.random() * jitterMs;
    // Cap at maximum delay
    return Math.min(exponentialDelay + jitter, maxDelayMs);
}
/**
 * Classify an error as recoverable or non-recoverable
 *
 * @param error - The error to classify
 * @returns Classification result with error type and recoverability
 */
export function classifyError(error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Check for rate limit first (special handling for retry-after)
    if (/rate limit/i.test(errorMessage) || /too many requests/i.test(errorMessage)) {
        // Try to extract retry-after value
        const retryAfterMatch = errorMessage.match(/retry.?after[:\s]+(\d+)/i);
        const retryAfterMs = retryAfterMatch ? parseInt(retryAfterMatch[1], 10) * 1000 : undefined;
        return {
            recoverable: true,
            type: 'rate_limit',
            retryAfterMs,
        };
    }
    // Check non-recoverable patterns first (more specific)
    for (const { pattern, type } of NON_RECOVERABLE_PATTERNS) {
        if (pattern.test(errorMessage)) {
            return { recoverable: false, type };
        }
    }
    // Check recoverable patterns
    for (const pattern of RECOVERABLE_PATTERNS) {
        if (pattern.test(errorMessage)) {
            // Determine specific type for recoverable errors
            if (/\b50[234]\b|bad gateway|service unavailable|gateway timeout/i.test(errorMessage)) {
                return { recoverable: true, type: 'server_error' };
            }
            if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|ENETUNREACH|socket|network|connection|timeout/i.test(errorMessage)) {
                return { recoverable: true, type: 'network_error' };
            }
            return { recoverable: true, type: 'rate_limit' };
        }
    }
    // Unknown error - not recoverable by default
    return { recoverable: false, type: 'unknown' };
}
/**
 * Check if an error is recoverable (transient)
 *
 * @param error - The error to check
 * @returns true if the error is recoverable
 */
export function isRecoverableError(error) {
    return classifyError(error).recoverable;
}
/**
 * Execute a gh CLI command and return the output
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The command output as a string
 * @throws Error if the command fails
 */
export function execGh(command, options = {}) {
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
export function execGhJson(command, options = {}) {
    const output = execGh(command, options);
    return JSON.parse(output);
}
/**
 * Safely execute a gh CLI command, returning null on failure
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution options
 * @returns The command output or null on failure
 */
export function safeExecGh(command, options = {}) {
    try {
        return execGh(command, options);
    }
    catch {
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
export function safeExecGhJson(command, options = {}) {
    try {
        return execGhJson(command, options);
    }
    catch {
        return null;
    }
}
/**
 * Default retry callback that logs to console
 */
function defaultRetryCallback(attempt, maxAttempts, error, delayMs) {
    const classification = classifyError(error);
    console.log(`GitHub API ${classification.type} error, retrying in ${Math.round(delayMs)}ms ` +
        `(attempt ${attempt}/${maxAttempts}): ${error.message.slice(0, 100)}`);
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
export async function execGhWithRetry(command, options = {}) {
    const { timeout = DEFAULT_TIMEOUT, silent = false, maxAttempts = RETRY_DEFAULTS.maxAttempts, baseDelayMs = RETRY_DEFAULTS.baseDelayMs, maxDelayMs = RETRY_DEFAULTS.maxDelayMs, jitterMs = RETRY_DEFAULTS.jitterMs, onRetry = silent ? undefined : defaultRetryCallback, } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return execGh(command, { timeout, silent });
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const classification = classifyError(lastError);
            // If error is not recoverable or this is the last attempt, throw immediately
            if (!classification.recoverable || attempt === maxAttempts) {
                throw lastError;
            }
            // Calculate delay - use retry-after if available for rate limits
            let delayMs;
            if (classification.type === 'rate_limit' && classification.retryAfterMs) {
                delayMs = Math.min(classification.retryAfterMs, maxDelayMs);
            }
            else {
                delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs, jitterMs);
            }
            // Log retry attempt
            if (onRetry) {
                onRetry(attempt, maxAttempts, lastError, delayMs);
            }
            // Wait before retrying
            await sleep(delayMs);
        }
    }
    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Retry failed unexpectedly');
}
/**
 * Execute a gh CLI command with retry and return parsed JSON
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution and retry options
 * @returns The parsed JSON response
 * @throws Error if the command fails after all retries or JSON parsing fails
 */
export async function execGhJsonWithRetry(command, options = {}) {
    const output = await execGhWithRetry(command, options);
    return JSON.parse(output);
}
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
export async function safeExecGhWithRetry(command, options = {}) {
    try {
        return await execGhWithRetry(command, options);
    }
    catch {
        return null;
    }
}
/**
 * Safely execute a gh CLI command with retry and return parsed JSON, returning null on failure
 *
 * @param command - The gh command (without 'gh' prefix)
 * @param options - Execution and retry options
 * @returns The parsed JSON response or null on failure
 */
export async function safeExecGhJsonWithRetry(command, options = {}) {
    try {
        return await execGhJsonWithRetry(command, options);
    }
    catch {
        return null;
    }
}
/**
 * Fetch issue details from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns Issue data or null if not found
 */
export function fetchIssue(issueNumber, repo) {
    return safeExecGhJson(`issue view ${issueNumber} --repo "${repo}" --json number,title,body,state,url,labels`);
}
/**
 * Fetch issue title from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns The issue title or null if not found
 */
export function fetchIssueTitle(issueNumber, repo) {
    const data = safeExecGhJson(`issue view ${issueNumber} --repo "${repo}" --json title`);
    return data?.title || null;
}
/**
 * Fetch issue body from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns The issue body or null if not found
 */
export function fetchIssueBody(issueNumber, repo) {
    const data = safeExecGhJson(`issue view ${issueNumber} --repo "${repo}" --json body`);
    return data?.body || null;
}
/**
 * Fetch issue labels from GitHub
 *
 * @param issueNumber - The issue number
 * @param repo - Repository in owner/repo format
 * @returns Array of label names (lowercase) or empty array
 */
export function fetchIssueLabels(issueNumber, repo) {
    try {
        const output = execGh(`issue view ${issueNumber} --repo "${repo}" --json labels -q '.labels[].name'`);
        return output
            .trim()
            .split('\n')
            .filter((l) => l)
            .map((l) => l.toLowerCase());
    }
    catch {
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
export function issueExists(issueNumber, repo) {
    const result = safeExecGhJson(`issue view ${issueNumber} --repo "${repo}" --json number`);
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
export function addIssueLabel(issueNumber, repo, label) {
    return safeExecGh(`issue edit ${issueNumber} --repo "${repo}" --add-label "${label}"`) !== null;
}
/**
 * Search for a PR by issue number
 *
 * @param issueNumber - The issue number to search for
 * @param repo - Repository in owner/repo format
 * @returns The PR URL or null if not found
 */
export function fetchPrUrl(issueNumber, repo) {
    // Try searching by keywords that link to the issue
    const keywords = ['fixes', 'closes', 'resolves'];
    for (const keyword of keywords) {
        const prs = safeExecGhJson(`pr list --repo "${repo}" --state merged --search "${keyword} #${issueNumber}" --json url --limit 1`);
        if (prs && prs.length > 0) {
            return prs[0].url;
        }
    }
    // Try searching by branch pattern
    const branchPrs = safeExecGhJson(`pr list --repo "${repo}" --state merged --search "head:feature/issue-${issueNumber}" --json url --limit 1`);
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
export function listOpenPrs(repo) {
    return safeExecGhJson(`pr list --repo "${repo}" --state open --json number,title,url,state,headRefName`) || [];
}
/**
 * Fetch items from a GitHub project board
 *
 * @param projectNumber - The project number
 * @param owner - The project owner (user or org)
 * @param limit - Maximum items to fetch (default 100)
 * @returns The items response or null on failure
 */
export function fetchProjectItems(projectNumber, owner, limit = 100) {
    return safeExecGhJson(`project item-list ${projectNumber} --owner "${owner}" --format json --limit ${limit}`);
}
/**
 * Fetch project fields
 *
 * @param projectNumber - The project number
 * @param owner - The project owner
 * @returns Array of fields or null on failure
 */
export function fetchProjectFields(projectNumber, owner) {
    return safeExecGhJson(`project field-list ${projectNumber} --owner "${owner}" --format json`);
}
/**
 * Fetch projects for an owner
 *
 * @param owner - The project owner
 * @returns Array of projects or null on failure
 */
export function fetchProjects(owner) {
    return safeExecGhJson(`project list --owner "${owner}" --format json`);
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
export function moveProjectItem(projectId, itemId, fieldId, optionId) {
    return (safeExecGh(`project item-edit --project-id "${projectId}" --id "${itemId}" --field-id "${fieldId}" --single-select-option-id "${optionId}"`) !== null);
}
/**
 * Add an issue to a project
 *
 * @param projectNumber - The project number
 * @param owner - The project owner
 * @param issueUrl - The issue URL to add
 * @returns true if successful
 */
export function addIssueToProject(projectNumber, owner, issueUrl) {
    return (safeExecGh(`project item-add ${projectNumber} --owner "${owner}" --url "${issueUrl}"`) !== null);
}
/**
 * Fetch GitHub API rate limit status
 *
 * @returns Rate limit data or null on failure
 */
export function fetchRateLimit() {
    return safeExecGhJson('api rate_limit');
}
//# sourceMappingURL=github.js.map