import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    purple: '\x1b[35m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    else {
        return `${secs}s`;
    }
}
function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
function formatCost(cost) {
    return `$${cost.toFixed(4)}`;
}
// Parse --since option: supports "7d", "2w", "1m", "2024-01-01"
function parseSince(since) {
    if (!since)
        return null;
    // Try relative format first (e.g., "7d", "2w", "1m")
    const relativeMatch = since.match(/^(\d+)([dwmhDWMH])$/);
    if (relativeMatch) {
        const value = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();
        const now = new Date();
        switch (unit) {
            case 'h':
                now.setHours(now.getHours() - value);
                break;
            case 'd':
                now.setDate(now.getDate() - value);
                break;
            case 'w':
                now.setDate(now.getDate() - value * 7);
                break;
            case 'm':
                now.setMonth(now.getMonth() - value);
                break;
            default:
                return null;
        }
        return now;
    }
    // Try ISO date format (e.g., "2024-01-01")
    const dateMatch = since.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateMatch) {
        const parsed = new Date(since);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    // Try full ISO datetime format
    const parsed = new Date(since);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    return null;
}
// Parse YAML value (simple key: value extraction)
function parseYamlNested(content, parent, key) {
    const lines = content.split('\n');
    let inParent = false;
    for (const line of lines) {
        if (line.match(new RegExp(`^${parent}:`))) {
            inParent = true;
            continue;
        }
        if (inParent && line.match(/^[a-z]/)) {
            inParent = false;
        }
        if (inParent && line.match(new RegExp(`^\\s+${key}:`))) {
            const value = line.split(':')[1];
            if (value) {
                return value.replace(/["']/g, '').replace(/#.*$/, '').trim();
            }
        }
    }
    return null;
}
// Load session stats from chadgi-stats.json
function loadSessionStats(chadgiDir) {
    const statsFile = join(chadgiDir, 'chadgi-stats.json');
    if (!existsSync(statsFile)) {
        return [];
    }
    try {
        const content = readFileSync(statsFile, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
// Load task metrics from chadgi-metrics.json
function loadTaskMetrics(chadgiDir) {
    const metricsFile = join(chadgiDir, 'chadgi-metrics.json');
    if (!existsSync(metricsFile)) {
        return [];
    }
    try {
        const content = readFileSync(metricsFile, 'utf-8');
        const data = JSON.parse(content);
        return data.tasks || [];
    }
    catch {
        return [];
    }
}
// Try to fetch PR URL for an issue from GitHub
function fetchPrUrl(repo, issueNumber) {
    try {
        // Search for PRs that mention this issue in their title or body
        const output = execSync(`gh pr list --repo "${repo}" --state merged --search "fixes #${issueNumber} OR closes #${issueNumber} OR resolves #${issueNumber} OR issue-${issueNumber}" --json number,url --limit 1`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
        const prs = JSON.parse(output);
        if (prs.length > 0) {
            return prs[0].url;
        }
        // Also check by branch pattern
        const branchOutput = execSync(`gh pr list --repo "${repo}" --state merged --search "head:feature/issue-${issueNumber}" --json url --limit 1`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
        const branchPrs = JSON.parse(branchOutput);
        if (branchPrs.length > 0) {
            return branchPrs[0].url;
        }
    }
    catch {
        // Ignore errors - PR URL is optional
    }
    return null;
}
// Fetch issue title from GitHub
function fetchIssueTitle(repo, issueNumber) {
    try {
        const output = execSync(`gh issue view ${issueNumber} --repo "${repo}" --json title`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
        const data = JSON.parse(output);
        return data.title || null;
    }
    catch {
        return null;
    }
}
// Build unified history entries from both data sources
function buildHistoryEntries(sessions, metrics, repo) {
    const entries = [];
    const processedIssues = new Set(); // Use issue+timestamp to avoid duplicates
    // Process detailed metrics first (more accurate data)
    for (const metric of metrics) {
        const key = `${metric.issue_number}-${metric.started_at}`;
        if (processedIssues.has(key))
            continue;
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
            if (processedIssues.has(key))
                continue;
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
            if (processedIssues.has(key))
                continue;
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
function applyFilters(entries, options) {
    let filtered = [...entries];
    let sinceDate;
    let statusFilter;
    // Apply --since filter
    if (options.since) {
        sinceDate = parseSince(options.since) || undefined;
        if (sinceDate) {
            const sinceTime = sinceDate.getTime();
            filtered = filtered.filter((entry) => new Date(entry.startedAt).getTime() >= sinceTime);
        }
        else {
            console.error(`Warning: Could not parse --since value: ${options.since}`);
            console.error('Supported formats: "7d", "2w", "1m", "2024-01-01"');
        }
    }
    // Apply --status filter
    if (options.status) {
        statusFilter = options.status.toLowerCase();
        if (statusFilter === 'success' || statusFilter === 'completed') {
            filtered = filtered.filter((entry) => entry.outcome === 'success');
        }
        else if (statusFilter === 'failed' || statusFilter === 'failure') {
            filtered = filtered.filter((entry) => entry.outcome === 'failed');
        }
        else if (statusFilter === 'skipped') {
            filtered = filtered.filter((entry) => entry.outcome === 'skipped');
        }
        else {
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
// Print formatted history output
function printHistory(entries, total, sinceDate, statusFilter, repo) {
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('                  CHADGI TASK HISTORY                      ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
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
    console.log(`${colors.dim}${'─'.repeat(78)}${colors.reset}`);
    // Task entries
    for (const entry of entries) {
        const outcomeColor = entry.outcome === 'success'
            ? colors.green
            : entry.outcome === 'skipped'
                ? colors.yellow
                : colors.red;
        const outcomeText = entry.outcome === 'success'
            ? 'SUCCESS'
            : entry.outcome === 'skipped'
                ? 'SKIPPED'
                : 'FAILED';
        // Issue line
        console.log(`${colors.bold}#${entry.issueNumber}${colors.reset} ${outcomeColor}[${outcomeText}]${colors.reset}`);
        // Title if available
        if (entry.issueTitle) {
            console.log(`  ${colors.dim}${entry.issueTitle.substring(0, 60)}${entry.issueTitle.length > 60 ? '...' : ''}${colors.reset}`);
        }
        // Details
        console.log(`  Date:    ${formatDate(entry.startedAt)}`);
        console.log(`  Elapsed: ${formatDuration(entry.elapsedTime)}`);
        if (entry.cost !== undefined && entry.cost > 0) {
            console.log(`  Cost:    ${formatCost(entry.cost)}`);
        }
        if (entry.category) {
            console.log(`  Category: ${entry.category}`);
        }
        if (entry.iterations && entry.iterations > 1) {
            console.log(`  Iterations: ${entry.iterations}`);
        }
        // Failure reason if applicable
        if (entry.outcome === 'failed' && entry.failureReason) {
            console.log(`  ${colors.red}Reason: ${entry.failureReason}${colors.reset}`);
        }
        // PR URL if available
        if (entry.prUrl) {
            console.log(`  ${colors.blue}PR: ${entry.prUrl}${colors.reset}`);
        }
        console.log(`${colors.dim}${'─'.repeat(78)}${colors.reset}`);
    }
    console.log('');
    console.log(`${colors.purple}${colors.bold}==========================================================`);
    console.log('               Chad does what Chad wants.');
    console.log(`==========================================================${colors.reset}`);
}
export async function history(options = {}) {
    const cwd = process.cwd();
    const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
    const configPath = options.config ? resolve(options.config) : defaultConfigPath;
    const chadgiDir = dirname(configPath);
    // Check if .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        console.error('Error: .chadgi directory not found.');
        console.error('Run `chadgi init` to initialize ChadGI in this directory.');
        process.exit(1);
    }
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
                entry.issueTitle = fetchIssueTitle(repo, entry.issueNumber) || undefined;
            }
            // Fetch PR URL for successful tasks
            if (entry.outcome === 'success' && !entry.prUrl) {
                entry.prUrl = fetchPrUrl(repo, entry.issueNumber) || undefined;
            }
        }
    }
    // Output as JSON if requested
    if (options.json) {
        const result = {
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
//# sourceMappingURL=history.js.map