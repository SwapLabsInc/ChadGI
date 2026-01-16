import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';

// Import shared utilities
import { colors } from './utils/colors.js';
import { parseYamlNested, resolveConfigPath, ensureChadgiDirExists } from './utils/config.js';
import { formatDuration, formatDate, formatCost, parseSince, truncate } from './utils/formatting.js';
import { loadSessionStats, loadTaskMetrics } from './utils/data.js';
import { fetchIssueTitle, fetchPrUrl } from './utils/github.js';
import { Section, BracketedBadge, divider, keyValue, hyperlink, coloredHyperlink } from './utils/textui.js';

// Import shared types
import type { BaseCommandOptions, SessionStats, TaskMetrics, HistoryEntry, HistoryResult } from './types/index.js';

interface HistoryOptions extends BaseCommandOptions {
  limit?: number;
  since?: string;
  status?: string;
}

// Build unified history entries from both data sources
function buildHistoryEntries(
  sessions: SessionStats[],
  metrics: TaskMetrics[],
  _repo: string
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const processedIssues = new Set<string>(); // Use issue+timestamp to avoid duplicates

  // Process detailed metrics first (more accurate data)
  for (const metric of metrics) {
    const key = `${metric.issue_number}-${metric.started_at}`;
    if (processedIssues.has(key)) continue;
    processedIssues.add(key);

    entries.push({
      issueNumber: metric.issue_number,
      outcome: metric.status === 'completed' ? 'success' : 'failed',
      elapsedTime: metric.duration_secs || 0,
      cost: metric.cost_usd > 0 ? metric.cost_usd : undefined,
      startedAt: metric.started_at,
      completedAt: metric.completed_at,
      failureReason: metric.failure_reason,
      category: metric.category,
      iterations: metric.iterations,
    });
  }

  // Process session stats for entries not covered by metrics
  for (const session of sessions) {
    // Process successful tasks
    for (const task of session.successful_tasks || []) {
      const key = `${task.issue}-${session.started_at}`;
      if (processedIssues.has(key)) continue;
      processedIssues.add(key);

      entries.push({
        issueNumber: task.issue,
        outcome: 'success',
        elapsedTime: task.duration_secs || 0,
        startedAt: session.started_at,
        completedAt: session.ended_at,
      });
    }

    // Process failed tasks
    for (const task of session.failed_tasks || []) {
      const key = `${task.issue}-${session.started_at}`;
      if (processedIssues.has(key)) continue;
      processedIssues.add(key);

      entries.push({
        issueNumber: task.issue,
        outcome: task.reason?.toLowerCase().includes('skip') ? 'skipped' : 'failed',
        elapsedTime: task.duration_secs || 0,
        startedAt: session.started_at,
        completedAt: session.ended_at,
        failureReason: task.reason,
      });
    }
  }

  // Sort by startedAt descending (most recent first)
  entries.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return entries;
}

// Apply filters to history entries
function applyFilters(
  entries: HistoryEntry[],
  options: HistoryOptions
): { filtered: HistoryEntry[]; sinceDate?: Date; statusFilter?: string } {
  let filtered = [...entries];
  let sinceDate: Date | undefined;
  let statusFilter: string | undefined;

  // Apply --since filter
  if (options.since) {
    sinceDate = parseSince(options.since) || undefined;
    if (sinceDate) {
      const sinceTime = sinceDate.getTime();
      filtered = filtered.filter(
        (entry) => new Date(entry.startedAt).getTime() >= sinceTime
      );
    } else {
      console.error(`Warning: Could not parse --since value: ${options.since}`);
      console.error('Supported formats: "7d", "2w", "1m", "2024-01-01"');
    }
  }

  // Apply --status filter
  if (options.status) {
    statusFilter = options.status.toLowerCase();
    if (statusFilter === 'success' || statusFilter === 'completed') {
      filtered = filtered.filter((entry) => entry.outcome === 'success');
    } else if (statusFilter === 'failed' || statusFilter === 'failure') {
      filtered = filtered.filter((entry) => entry.outcome === 'failed');
    } else if (statusFilter === 'skipped') {
      filtered = filtered.filter((entry) => entry.outcome === 'skipped');
    } else {
      console.error(`Warning: Unknown status filter: ${options.status}`);
      console.error('Supported values: success, failed, skipped');
    }
  }

  // Apply --limit
  if (options.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return { filtered, sinceDate, statusFilter };
}

// Print formatted history output using text UI components
function printHistory(
  entries: HistoryEntry[],
  total: number,
  sinceDate?: Date,
  statusFilter?: string,
  _repo?: string
): void {
  // Print section header using Section component
  const header = new Section({
    title: 'CHADGI TASK HISTORY',
    width: 58,
  });
  header.printHeader();
  console.log('');

  // Show filters if applied
  if (sinceDate || statusFilter) {
    console.log(`${colors.dim}Filters applied:`);
    if (sinceDate) {
      console.log(`  Since: ${formatDate(sinceDate.toISOString())}`);
    }
    if (statusFilter) {
      console.log(`  Status: ${statusFilter}`);
    }
    console.log(`${colors.reset}`);
    console.log('');
  }

  if (entries.length === 0) {
    console.log(`${colors.yellow}No task history found matching the specified criteria.${colors.reset}`);
    console.log('');
    console.log('Run `chadgi start` to begin processing tasks and build history.');
    return;
  }

  // Summary
  console.log(`${colors.cyan}Showing ${entries.length} of ${total} total tasks${colors.reset}`);
  console.log('');

  // Calculate summary stats
  const successful = entries.filter((e) => e.outcome === 'success').length;
  const failed = entries.filter((e) => e.outcome === 'failed').length;
  const skipped = entries.filter((e) => e.outcome === 'skipped').length;
  const totalCost = entries.reduce((sum, e) => sum + (e.cost || 0), 0);
  const totalTime = entries.reduce((sum, e) => sum + e.elapsedTime, 0);

  console.log(`${colors.cyan}${colors.bold}Summary${colors.reset}`);
  console.log(`  ${colors.green}Success:${colors.reset} ${successful}`);
  console.log(`  ${colors.red}Failed:${colors.reset}  ${failed}`);
  if (skipped > 0) {
    console.log(`  ${colors.yellow}Skipped:${colors.reset} ${skipped}`);
  }
  console.log(`  Total Time: ${formatDuration(totalTime)}`);
  if (totalCost > 0) {
    console.log(`  Total Cost: ${formatCost(totalCost)}`);
  }
  console.log('');

  // Task list header
  console.log(`${colors.cyan}${colors.bold}Task History${colors.reset}`);
  console.log(divider(78));

  // Task entries using Badge for status
  for (const entry of entries) {
    const badgeStyle =
      entry.outcome === 'success'
        ? 'success'
        : entry.outcome === 'skipped'
          ? 'warning'
          : 'error';

    const outcomeText =
      entry.outcome === 'success'
        ? 'SUCCESS'
        : entry.outcome === 'skipped'
          ? 'SKIPPED'
          : 'FAILED';

    // Issue line with bracketed badge
    console.log(
      `${colors.bold}#${entry.issueNumber}${colors.reset} ${BracketedBadge(outcomeText, badgeStyle)}`
    );

    // Title if available
    if (entry.issueTitle) {
      console.log(`  ${colors.dim}${truncate(entry.issueTitle, 60)}${colors.reset}`);
    }

    // Details using keyValue helper
    console.log(keyValue('Date:', formatDate(entry.startedAt), 10));
    console.log(keyValue('Elapsed:', formatDuration(entry.elapsedTime), 10));

    if (entry.cost !== undefined && entry.cost > 0) {
      console.log(keyValue('Cost:', formatCost(entry.cost), 10));
    }

    if (entry.category) {
      console.log(keyValue('Category:', entry.category, 10));
    }

    if (entry.iterations && entry.iterations > 1) {
      console.log(keyValue('Iterations:', String(entry.iterations), 10));
    }

    // Failure reason if applicable
    if (entry.outcome === 'failed' && entry.failureReason) {
      console.log(`  ${colors.red}Reason: ${entry.failureReason}${colors.reset}`);
    }

    // PR URL if available (clickable if terminal supports hyperlinks)
    if (entry.prUrl) {
      const prLink = coloredHyperlink(entry.prUrl, entry.prUrl, 'blue');
      console.log(`  PR: ${prLink}`);
    }

    console.log(divider(78));
  }

  console.log('');
  // Footer section
  const footer = new Section({
    title: 'Chad does what Chad wants.',
    width: 58,
    showTopDivider: true,
    showBottomDivider: false,
  });
  footer.printHeader();
}

export async function history(options: HistoryOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { configPath, chadgiDir } = resolveConfigPath(options.config, cwd);
  ensureChadgiDirExists(chadgiDir);

  // Load config for repo info
  let repo = 'owner/repo';
  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf-8');
    repo = parseYamlNested(configContent, 'github', 'repo') || repo;
  }

  // Load data from both sources
  const sessions = loadSessionStats(chadgiDir);
  const metrics = loadTaskMetrics(chadgiDir);

  // Build unified history entries
  const allEntries = buildHistoryEntries(sessions, metrics, repo);

  // Apply filters
  const defaultLimit = 10;
  const effectiveLimit = options.limit ?? (options.since || options.status ? undefined : defaultLimit);
  const { filtered, sinceDate, statusFilter } = applyFilters(allEntries, {
    ...options,
    limit: effectiveLimit,
  });

  // Optionally fetch issue titles and PR URLs for successful tasks
  // (only for displayed entries to minimize API calls)
  if (!options.json && repo !== 'owner/repo') {
    for (const entry of filtered) {
      // Fetch issue title if not already set
      if (!entry.issueTitle) {
        entry.issueTitle = fetchIssueTitle(entry.issueNumber, repo) || undefined;
      }

      // Fetch PR URL for successful tasks
      if (entry.outcome === 'success' && !entry.prUrl) {
        entry.prUrl = fetchPrUrl(entry.issueNumber, repo) || undefined;
      }
    }
  }

  // Output as JSON if requested
  if (options.json) {
    const result: HistoryResult = {
      entries: filtered,
      total: allEntries.length,
      filtered: filtered.length,
    };
    if (sinceDate) {
      result.dateRange = {
        since: sinceDate.toISOString(),
        until: new Date().toISOString(),
      };
    }
    if (statusFilter) {
      result.statusFilter = statusFilter;
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Display formatted history
  printHistory(filtered, allEntries.length, sinceDate, statusFilter, repo);
}
