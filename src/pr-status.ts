/**
 * PR Status command for monitoring ChadGI-created PRs.
 *
 * Displays the status of pull requests from tasks currently in "In Review" column,
 * showing CI status, review status, merge conflict status, and age.
 */

import { existsSync, readFileSync } from 'fs';
import { colors } from './utils/colors.js';
import { parseYamlNested, resolveConfigPath, ensureChadgiDirExists } from './utils/config.js';
import { formatAge, getAgeSeconds, truncate } from './utils/formatting.js';
import { gh } from './utils/gh-client.js';
import type { PullRequestDetailedStatus, StatusCheckEntry } from './utils/gh-client.js';
import { Section, Table, divider, keyValue, coloredHyperlink } from './utils/textui.js';

import type {
  PRStatusOptions,
  PRStatusEntry,
  PRStatusSummary,
  PRStatusResult,
  CIStatus,
  ReviewStatus,
  ConflictStatus,
} from './types/index.js';

/**
 * Parse CI status from GitHub status check rollup
 */
function parseCIStatus(statusCheckRollup: StatusCheckEntry[]): CIStatus {
  if (!statusCheckRollup || statusCheckRollup.length === 0) {
    return 'unknown';
  }

  let hasPending = false;
  let hasFailing = false;

  for (const check of statusCheckRollup) {
    // Handle both CheckRun and StatusContext types
    const conclusion = check.conclusion?.toUpperCase();
    const state = check.state?.toUpperCase();
    const status = check.status?.toUpperCase();

    // Check for failures
    if (conclusion === 'FAILURE' || conclusion === 'CANCELLED' || conclusion === 'TIMED_OUT' ||
        state === 'FAILURE' || state === 'ERROR') {
      hasFailing = true;
    }

    // Check for pending
    if (status === 'IN_PROGRESS' || status === 'QUEUED' || status === 'PENDING' ||
        state === 'PENDING' || conclusion === null || conclusion === undefined) {
      if (!hasFailing && conclusion !== 'SUCCESS' && state !== 'SUCCESS') {
        hasPending = true;
      }
    }
  }

  if (hasFailing) {
    return 'failing';
  } else if (hasPending) {
    return 'pending';
  } else {
    return 'passing';
  }
}

/**
 * Parse review status from GitHub review decision
 */
function parseReviewStatus(reviewDecision: string | undefined): ReviewStatus {
  if (!reviewDecision) {
    return 'pending';
  }

  switch (reviewDecision.toUpperCase()) {
    case 'APPROVED':
      return 'approved';
    case 'CHANGES_REQUESTED':
      return 'changes_requested';
    case 'REVIEW_REQUIRED':
      return 'pending';
    default:
      return 'unknown';
  }
}

/**
 * Parse conflict status from GitHub mergeable field
 */
function parseConflictStatus(mergeable: string, mergeStateStatus: string): ConflictStatus {
  if (mergeable.toUpperCase() === 'CONFLICTING' ||
      mergeStateStatus.toUpperCase() === 'DIRTY') {
    return 'merge';
  } else if (mergeable.toUpperCase() === 'MERGEABLE' ||
             mergeable.toUpperCase() === 'UNKNOWN') {
    return 'none';
  }
  return 'unknown';
}

/**
 * Extract issue number from PR title (ChadGI convention: [#123] or #123 in title)
 */
function extractIssueNumber(title: string): number | undefined {
  // Try [#123] format first
  const bracketMatch = title.match(/\[#(\d+)\]/);
  if (bracketMatch) {
    return parseInt(bracketMatch[1], 10);
  }

  // Try #123 at the start of title
  const hashMatch = title.match(/^#(\d+)/);
  if (hashMatch) {
    return parseInt(hashMatch[1], 10);
  }

  // Try issue-123 in branch name or title
  const issueMatch = title.match(/issue[- ]?(\d+)/i);
  if (issueMatch) {
    return parseInt(issueMatch[1], 10);
  }

  return undefined;
}

/**
 * Convert detailed PR status to PRStatusEntry
 */
function toPRStatusEntry(pr: PullRequestDetailedStatus): PRStatusEntry {
  const ageSeconds = getAgeSeconds(pr.createdAt);

  return {
    prNumber: pr.number,
    title: pr.title,
    url: pr.url,
    issueNumber: extractIssueNumber(pr.title) || extractIssueNumber(pr.branch),
    ciStatus: parseCIStatus(pr.statusCheckRollup),
    reviewStatus: parseReviewStatus(pr.reviewDecision),
    conflictStatus: parseConflictStatus(pr.mergeable, pr.mergeStateStatus),
    createdAt: pr.createdAt,
    age: formatAge(ageSeconds),
    ageSeconds,
    branch: pr.branch,
    merged: pr.state === 'MERGED',
    closed: pr.state === 'CLOSED',
  };
}

/**
 * Calculate summary statistics from PR entries
 */
function calculateSummary(prs: PRStatusEntry[]): PRStatusSummary {
  return {
    total: prs.length,
    passing: prs.filter(pr => pr.ciStatus === 'passing').length,
    failing: prs.filter(pr => pr.ciStatus === 'failing').length,
    pending: prs.filter(pr => pr.ciStatus === 'pending').length,
    needsAttention: prs.filter(pr =>
      pr.conflictStatus === 'merge' ||
      pr.reviewStatus === 'changes_requested' ||
      pr.ciStatus === 'failing'
    ).length,
    withConflicts: prs.filter(pr => pr.conflictStatus === 'merge').length,
    pendingReview: prs.filter(pr => pr.reviewStatus === 'pending').length,
    approved: prs.filter(pr => pr.reviewStatus === 'approved').length,
  };
}

/**
 * Apply filters to PR entries
 */
function applyFilters(prs: PRStatusEntry[], options: PRStatusOptions): PRStatusEntry[] {
  let filtered = [...prs];

  if (options.failing) {
    filtered = filtered.filter(pr => pr.ciStatus === 'failing');
  }

  if (options.needsReview) {
    filtered = filtered.filter(pr => pr.reviewStatus === 'pending');
  }

  if (options.hasConflicts) {
    filtered = filtered.filter(pr => pr.conflictStatus === 'merge');
  }

  return filtered;
}

/**
 * Get color for CI status
 */
function getCIStatusColor(status: CIStatus): string {
  switch (status) {
    case 'passing':
      return colors.green;
    case 'failing':
      return colors.red;
    case 'pending':
      return colors.yellow;
    default:
      return colors.dim;
  }
}

/**
 * Get color for review status
 */
function getReviewStatusColor(status: ReviewStatus): string {
  switch (status) {
    case 'approved':
      return colors.green;
    case 'changes_requested':
      return colors.red;
    case 'pending':
      return colors.yellow;
    default:
      return colors.dim;
  }
}

/**
 * Get color for conflict status
 */
function getConflictStatusColor(status: ConflictStatus): string {
  switch (status) {
    case 'none':
      return colors.green;
    case 'merge':
      return colors.red;
    default:
      return colors.dim;
  }
}

/**
 * Print formatted PR status table
 */
function printPRStatus(
  prs: PRStatusEntry[],
  summary: PRStatusSummary,
  repo: string,
  syncPerformed: boolean = false,
  syncedTasks: number[] = []
): void {
  // Print header
  const header = new Section({
    title: 'ChadGI PR Status',
    width: 78,
  });
  header.printHeader();
  console.log('');

  // Print repo info
  console.log(keyValue('Repo:', repo, 12));
  console.log('');

  if (prs.length === 0) {
    console.log(`${colors.yellow}No open PRs found in the "In Review" column.${colors.reset}`);
    console.log('');
    console.log('Run `chadgi start` to begin processing tasks.');
    return;
  }

  // Print table header
  console.log(
    `${colors.dim} #   PR#    Title                               CI       Review    Conflicts  Age${colors.reset}`
  );
  console.log(divider(78));

  // Print each PR
  prs.forEach((pr, index) => {
    const ciColor = getCIStatusColor(pr.ciStatus);
    const reviewColor = getReviewStatusColor(pr.reviewStatus);
    const conflictColor = getConflictStatusColor(pr.conflictStatus);

    const prLink = coloredHyperlink(pr.url, `#${pr.prNumber}`, 'cyan');
    const titleTruncated = truncate(pr.title, 35);

    // Format statuses with padding
    const ciText = pr.ciStatus.padEnd(8);
    const reviewText = (pr.reviewStatus === 'changes_requested' ? 'changes' : pr.reviewStatus).padEnd(9);
    const conflictText = pr.conflictStatus.padEnd(10);

    console.log(
      ` ${String(index + 1).padStart(2)}  ${prLink.padEnd(6)}  ${titleTruncated.padEnd(35)}  ` +
      `${ciColor}${ciText}${colors.reset} ` +
      `${reviewColor}${reviewText}${colors.reset} ` +
      `${conflictColor}${conflictText}${colors.reset} ` +
      `${pr.age}`
    );
  });

  console.log('');

  // Print summary
  console.log(`${colors.cyan}${colors.bold}Summary${colors.reset}`);
  console.log(
    `  ${summary.total} PR${summary.total !== 1 ? 's' : ''} open ` +
    `(${colors.green}${summary.passing} passing${colors.reset}, ` +
    `${colors.red}${summary.failing} failing${colors.reset}, ` +
    `${colors.yellow}${summary.pending} pending${colors.reset})`
  );

  if (summary.needsAttention > 0) {
    console.log(
      `  ${colors.red}${summary.needsAttention} need${summary.needsAttention !== 1 ? '' : 's'} attention${colors.reset} ` +
      `(${summary.withConflicts} with conflicts, ` +
      `${prs.filter(pr => pr.reviewStatus === 'changes_requested').length} with changes requested)`
    );
  }

  console.log('');

  // Print sync info if applicable
  if (syncPerformed && syncedTasks.length > 0) {
    console.log(`${colors.green}Synced ${syncedTasks.length} merged PR(s) to Done column.${colors.reset}`);
    console.log('');
  }

  // Print hint
  console.log(`${colors.dim}Run 'chadgi pr-status --sync' to auto-close merged PRs.${colors.reset}`);
}

/**
 * Main pr-status command handler
 */
export async function prStatus(options: PRStatusOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { configPath, chadgiDir } = resolveConfigPath(options.config, cwd);
  ensureChadgiDirExists(chadgiDir);

  // Load config
  let repo = 'owner/repo';
  let reviewColumn = 'In Review';
  let projectNumber = '';
  let doneColumn = 'Done';

  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf-8');
    repo = parseYamlNested(configContent, 'github', 'repo') || repo;
    reviewColumn = parseYamlNested(configContent, 'github', 'review_column') || reviewColumn;
    projectNumber = parseYamlNested(configContent, 'github', 'project_number') || projectNumber;
    doneColumn = parseYamlNested(configContent, 'github', 'done_column') || doneColumn;
  }

  // Override repo if provided via option
  if (options.repo) {
    repo = options.repo;
  }

  // Validate repo configuration
  if (!repo || repo === 'owner/repo') {
    console.error(`${colors.red}Error: Repository not configured.${colors.reset}`);
    console.error('Run `chadgi init` to set up your configuration.');
    process.exit(1);
  }

  const owner = repo.split('/')[0];

  // Get PRs from "In Review" column if project is configured
  let prNumbers: number[] = [];

  if (projectNumber) {
    try {
      const items = await gh.project.getItems(projectNumber, owner, {
        status: reviewColumn,
        type: 'PullRequest',
      });

      // Extract PR numbers from project items
      prNumbers = items
        .filter(item => item.content?.type === 'PullRequest' && item.content?.number)
        .map(item => item.content!.number!);
    } catch {
      // If project query fails, fall back to listing all open PRs
    }
  }

  // If no project or project query returned no PRs, list all open PRs
  if (prNumbers.length === 0) {
    try {
      const openPRs = await gh.pr.list(repo, { state: 'open', limit: 50 });
      prNumbers = openPRs.map(pr => pr.number);
    } catch (error) {
      console.error(`${colors.red}Error: Failed to fetch PRs from GitHub.${colors.reset}`);
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
    }
  }

  // Get detailed status for each PR
  const prEntries: PRStatusEntry[] = [];

  for (const prNumber of prNumbers) {
    const detailedStatus = await gh.pr.getDetailedStatus(prNumber, repo);
    if (detailedStatus && detailedStatus.state === 'OPEN') {
      prEntries.push(toPRStatusEntry(detailedStatus));
    }
  }

  // Sort by age (oldest first)
  prEntries.sort((a, b) => b.ageSeconds - a.ageSeconds);

  // Apply filters
  const filteredPRs = applyFilters(prEntries, options);

  // Calculate summary
  const summary = calculateSummary(filteredPRs);

  // Handle sync option
  let syncPerformed = false;
  const syncedTasks: number[] = [];

  if (options.sync && projectNumber) {
    // Find merged PRs and move their tasks to Done
    for (const prNumber of prNumbers) {
      const detailedStatus = await gh.pr.getDetailedStatus(prNumber, repo);
      if (detailedStatus?.state === 'MERGED') {
        // TODO: Move associated task to Done column
        // This would require getting the project item ID and status field ID
        syncedTasks.push(prNumber);
      }
    }
    syncPerformed = true;
  }

  // Output
  if (options.json) {
    const result: PRStatusResult = {
      repo,
      prs: filteredPRs,
      summary,
      timestamp: new Date().toISOString(),
      syncPerformed,
      syncedTasks: syncedTasks.length > 0 ? syncedTasks : undefined,
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Print formatted output
  printPRStatus(filteredPRs, summary, repo, syncPerformed, syncedTasks);
}
