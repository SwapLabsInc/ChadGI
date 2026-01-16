import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
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
// Parse YAML value (simple key: value extraction)
function parseYamlValue(content, key) {
    const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (match) {
        return match[1].replace(/["']/g, '').replace(/#.*$/, '').trim();
    }
    return null;
}
// Parse nested YAML value
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
// Get the most recent session
function getMostRecentSession(sessions) {
    if (sessions.length === 0)
        return null;
    return sessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
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
// Check if issue exists in GitHub
function issueExists(repo, issueNumber) {
    try {
        execSync(`gh issue view ${issueNumber} --repo "${repo}" --json number`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
        return true;
    }
    catch {
        return false;
    }
}
// Check if branch exists locally
function branchExistsLocally(branch) {
    try {
        const output = execSync('git branch', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const branches = output.split('\n').map(b => b.trim().replace(/^\*\s*/, ''));
        return branches.includes(branch);
    }
    catch {
        return false;
    }
}
// Check if branch exists on remote
function branchExistsRemote(branch) {
    try {
        execSync(`git ls-remote --heads origin "${branch}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const output = execSync(`git ls-remote --heads origin "${branch}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return output.trim().length > 0;
    }
    catch {
        return false;
    }
}
// Check if branch has uncommitted changes
function hasUncommittedChanges(branch) {
    try {
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
        if (currentBranch === branch) {
            const status = execSync('git status --porcelain', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            return status.trim().length > 0;
        }
        return false;
    }
    catch {
        return false;
    }
}
// Get branch name for an issue
function getBranchForIssue(issueNumber, branchPrefix) {
    return `${branchPrefix}${issueNumber}`;
}
// Build failed tasks list from metrics and session stats
function getFailedTasks(metrics, sessions, repo, branchPrefix, lastSessionOnly) {
    const failedTasks = [];
    const processedIssues = new Set();
    // Filter metrics to failed tasks only
    const failedMetrics = metrics.filter(m => m.status === 'failed');
    // If lastSessionOnly, get the most recent session
    let sessionFilter = null;
    if (lastSessionOnly) {
        const lastSession = getMostRecentSession(sessions);
        if (lastSession) {
            sessionFilter = new Set(lastSession.failed_tasks.map(t => t.issue));
        }
    }
    // Sort by failed_at descending (most recent first)
    const sortedMetrics = failedMetrics.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    for (const metric of sortedMetrics) {
        // Skip if already processed (take most recent failure)
        if (processedIssues.has(metric.issue_number))
            continue;
        // Skip if filtering to last session and not in that session
        if (sessionFilter && !sessionFilter.has(metric.issue_number))
            continue;
        processedIssues.add(metric.issue_number);
        const branch = getBranchForIssue(metric.issue_number, branchPrefix);
        const hasBranch = branchExistsLocally(branch) || branchExistsRemote(branch);
        failedTasks.push({
            issueNumber: metric.issue_number,
            failedAt: metric.started_at,
            failureReason: metric.failure_reason,
            failurePhase: metric.failure_phase,
            iterations: metric.iterations,
            cost: metric.cost_usd,
            retryCount: metric.retry_count || 0,
            branch: hasBranch ? branch : undefined,
            hasBranch,
            hasLocalChanges: hasBranch ? hasUncommittedChanges(branch) : false,
        });
    }
    return failedTasks;
}
// Move issue to Ready column in GitHub project board
function moveIssueToReady(issueNumber, repo, projectNumber, readyColumn) {
    const repoOwner = repo.split('/')[0];
    try {
        // Get project item ID for the issue
        const itemsOutput = execSync(`gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const items = JSON.parse(itemsOutput);
        const item = items.items?.find((i) => i.content?.type === 'Issue' && i.content?.number === issueNumber);
        if (!item) {
            // Issue not in project - try to add it
            const issueUrl = `https://github.com/${repo}/issues/${issueNumber}`;
            try {
                execSync(`gh project item-add ${projectNumber} --owner "${repoOwner}" --url "${issueUrl}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            }
            catch {
                return false;
            }
            // Re-fetch items to get the new item ID
            const newItemsOutput = execSync(`gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            const newItems = JSON.parse(newItemsOutput);
            const newItem = newItems.items?.find((i) => i.content?.type === 'Issue' && i.content?.number === issueNumber);
            if (!newItem)
                return false;
            // Update item reference
            Object.assign(item, newItem);
        }
        // Get project metadata (project ID, field IDs)
        const projectOutput = execSync(`gh project list --owner "${repoOwner}" --format json`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const projects = JSON.parse(projectOutput);
        const project = projects.projects?.find((p) => p.number === parseInt(projectNumber, 10));
        if (!project)
            return false;
        // Get field info
        const fieldOutput = execSync(`gh project field-list ${projectNumber} --owner "${repoOwner}" --format json`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const fields = JSON.parse(fieldOutput);
        const statusField = fields.fields?.find((f) => f.name === 'Status');
        if (!statusField)
            return false;
        const readyOptionId = statusField.options?.find((o) => o.name === readyColumn)?.id;
        if (!readyOptionId)
            return false;
        // Move item to Ready column
        execSync(`gh project item-edit --project-id "${project.id}" --id "${item.id}" --field-id "${statusField.id}" --single-select-option-id "${readyOptionId}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return true;
    }
    catch {
        return false;
    }
}
// Delete local branch
function deleteLocalBranch(branch) {
    try {
        execSync(`git branch -D "${branch}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return true;
    }
    catch {
        return false;
    }
}
// Delete remote branch
function deleteRemoteBranch(branch) {
    try {
        execSync(`git push origin --delete "${branch}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return true;
    }
    catch {
        return false;
    }
}
// Increment retry count in metrics
function incrementRetryCount(chadgiDir, issueNumber) {
    const metricsFile = join(chadgiDir, 'chadgi-metrics.json');
    if (!existsSync(metricsFile))
        return;
    try {
        const content = readFileSync(metricsFile, 'utf-8');
        const data = JSON.parse(content);
        // Find the most recent failed task for this issue and increment retry count
        for (const task of data.tasks) {
            if (task.issue_number === issueNumber && task.status === 'failed') {
                task.retry_count = (task.retry_count || 0) + 1;
            }
        }
        data.last_updated = new Date().toISOString();
        writeFileSync(metricsFile, JSON.stringify(data, null, 2));
    }
    catch {
        // Ignore errors updating metrics
    }
}
// Prompt for user confirmation
async function promptConfirmation(message) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(`${message} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}
// Print failed task history
function printFailedTaskHistory(tasks, repo) {
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('                  CHADGI FAILED TASKS                      ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
    if (tasks.length === 0) {
        console.log(`${colors.green}No failed tasks found.${colors.reset}`);
        console.log('');
        return;
    }
    console.log(`${colors.cyan}Found ${tasks.length} failed task${tasks.length !== 1 ? 's' : ''}${colors.reset}`);
    console.log('');
    // Summary
    const totalCost = tasks.reduce((sum, t) => sum + t.cost, 0);
    const totalRetries = tasks.reduce((sum, t) => sum + t.retryCount, 0);
    console.log(`${colors.cyan}${colors.bold}Summary${colors.reset}`);
    console.log(`  Total Cost: ${formatCost(totalCost)}`);
    console.log(`  Previous Retries: ${totalRetries}`);
    console.log('');
    // Task list
    console.log(`${colors.cyan}${colors.bold}Failed Tasks${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(78)}${colors.reset}`);
    for (const task of tasks) {
        // Issue line
        console.log(`${colors.bold}#${task.issueNumber}${colors.reset} ${colors.red}[FAILED]${colors.reset}`);
        // Title if available
        if (task.issueTitle) {
            console.log(`  ${colors.dim}${task.issueTitle.substring(0, 60)}${task.issueTitle.length > 60 ? '...' : ''}${colors.reset}`);
        }
        // Details
        console.log(`  Failed:     ${formatDate(task.failedAt)}`);
        console.log(`  Iterations: ${task.iterations}`);
        console.log(`  Cost:       ${formatCost(task.cost)}`);
        if (task.retryCount > 0) {
            console.log(`  Retries:    ${task.retryCount}`);
        }
        // Failure info
        if (task.failurePhase) {
            console.log(`  Phase:      ${task.failurePhase}`);
        }
        if (task.failureReason) {
            console.log(`  ${colors.red}Reason: ${task.failureReason}${colors.reset}`);
        }
        // Branch info
        if (task.hasBranch) {
            console.log(`  ${colors.blue}Branch: ${task.branch}${colors.reset}${task.hasLocalChanges ? ` ${colors.yellow}(uncommitted changes)${colors.reset}` : ''}`);
        }
        else {
            console.log(`  ${colors.dim}Branch: (not found)${colors.reset}`);
        }
        console.log(`${colors.dim}${'─'.repeat(78)}${colors.reset}`);
    }
    console.log('');
    console.log(`${colors.dim}Commands:${colors.reset}`);
    console.log(`  ${colors.cyan}chadgi replay <issue-number>${colors.reset}   Retry a specific task`);
    console.log(`  ${colors.cyan}chadgi replay --last${colors.reset}           Retry the most recent failed task`);
    console.log(`  ${colors.cyan}chadgi replay --all-failed${colors.reset}     Retry all failed tasks from last session`);
    console.log(`  ${colors.cyan}chadgi replay --fresh${colors.reset}          Start from clean branch (discard previous work)`);
    console.log(`  ${colors.cyan}chadgi replay --continue${colors.reset}       Continue from where the task left off`);
}
// Main replay function for a single issue
export async function replay(issueNumberArg, options = {}) {
    const cwd = process.cwd();
    const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
    const configPath = options.config ? resolve(options.config) : defaultConfigPath;
    const chadgiDir = dirname(configPath);
    const dryRun = options.dryRun ?? false;
    const skipConfirmation = options.yes ?? false;
    const fresh = options.fresh ?? false;
    const continueFromCheckpoint = options.continue ?? false;
    // Check if .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
        console.error(`Run ${colors.cyan}chadgi init${colors.reset} to initialize ChadGI.`);
        process.exit(1);
    }
    // Load config
    if (!existsSync(configPath)) {
        console.error(`${colors.red}Error: Config file not found at ${configPath}${colors.reset}`);
        process.exit(1);
    }
    const configContent = readFileSync(configPath, 'utf-8');
    const repo = parseYamlNested(configContent, 'github', 'repo') || 'owner/repo';
    const projectNumber = parseYamlNested(configContent, 'github', 'project_number') || '1';
    const readyColumn = parseYamlNested(configContent, 'github', 'ready_column') || 'Ready';
    const branchPrefix = parseYamlNested(configContent, 'branch', 'prefix') || 'feature/issue-';
    const baseBranch = parseYamlNested(configContent, 'branch', 'base') || 'main';
    if (repo === 'owner/repo') {
        console.error(`${colors.red}Error: Repository not configured in chadgi-config.yaml${colors.reset}`);
        process.exit(1);
    }
    // Load failed tasks
    const metrics = loadTaskMetrics(chadgiDir);
    const sessions = loadSessionStats(chadgiDir);
    const failedTasks = getFailedTasks(metrics, sessions, repo, branchPrefix, false);
    // If no issue number provided, show failed tasks list
    if (issueNumberArg === undefined) {
        // Fetch issue titles for display
        for (const task of failedTasks) {
            if (!task.issueTitle) {
                task.issueTitle = fetchIssueTitle(repo, task.issueNumber) || undefined;
            }
        }
        if (options.json) {
            const result = {
                success: true,
                action: 'list',
                tasks: failedTasks,
                message: `Found ${failedTasks.length} failed task(s)`,
            };
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            printFailedTaskHistory(failedTasks, repo);
        }
        return;
    }
    // Find the specific failed task
    const task = failedTasks.find(t => t.issueNumber === issueNumberArg);
    if (!task) {
        if (options.json) {
            const result = {
                success: false,
                action: 'replay',
                tasks: [],
                message: `Issue #${issueNumberArg} not found in failed tasks history`,
            };
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.error(`${colors.red}Error:${colors.reset} Issue #${issueNumberArg} not found in failed tasks history.`);
            console.error('');
            console.error('Run `chadgi replay` without arguments to see all failed tasks.');
        }
        process.exit(1);
    }
    // Verify issue still exists in GitHub
    if (!issueExists(repo, issueNumberArg)) {
        if (options.json) {
            const result = {
                success: false,
                action: 'replay',
                tasks: [task],
                message: `Issue #${issueNumberArg} no longer exists in GitHub`,
            };
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.error(`${colors.red}Error:${colors.reset} Issue #${issueNumberArg} no longer exists in GitHub.`);
        }
        process.exit(1);
    }
    // Fetch issue title for display
    task.issueTitle = fetchIssueTitle(repo, issueNumberArg) || undefined;
    // Display task failure history
    if (!options.json) {
        console.log(`${colors.purple}${colors.bold}`);
        console.log('==========================================================');
        console.log('                    CHADGI REPLAY                          ');
        console.log('==========================================================');
        console.log(`${colors.reset}`);
        console.log(`${colors.cyan}${colors.bold}Task to Replay${colors.reset}`);
        console.log(`  Issue:    ${colors.bold}#${task.issueNumber}${colors.reset}`);
        if (task.issueTitle) {
            console.log(`  Title:    ${task.issueTitle}`);
        }
        console.log(`  Failed:   ${formatDate(task.failedAt)}`);
        if (task.failureReason) {
            console.log(`  Reason:   ${colors.red}${task.failureReason}${colors.reset}`);
        }
        if (task.failurePhase) {
            console.log(`  Phase:    ${task.failurePhase}`);
        }
        console.log(`  Retries:  ${task.retryCount}`);
        console.log(`  Cost:     ${formatCost(task.cost)}`);
        console.log('');
        if (task.hasBranch) {
            console.log(`${colors.cyan}${colors.bold}Branch Status${colors.reset}`);
            console.log(`  Branch:   ${task.branch}`);
            console.log(`  Exists:   ${colors.green}Yes${colors.reset}`);
            if (task.hasLocalChanges) {
                console.log(`  Changes:  ${colors.yellow}Uncommitted changes detected${colors.reset}`);
            }
            console.log('');
        }
        // Show what will happen
        console.log(`${colors.cyan}${colors.bold}Replay Options${colors.reset}`);
        if (fresh) {
            console.log(`  Mode:     ${colors.yellow}Fresh start${colors.reset} (will delete existing branch)`);
        }
        else if (continueFromCheckpoint) {
            console.log(`  Mode:     ${colors.blue}Continue${colors.reset} (resume from existing branch)`);
        }
        else {
            console.log(`  Mode:     Default (use existing branch if available)`);
        }
        if (dryRun) {
            console.log(`  ${colors.yellow}DRY RUN - No changes will be made${colors.reset}`);
        }
        console.log('');
    }
    // Confirm before proceeding
    if (!skipConfirmation && !dryRun && !options.json) {
        const confirmed = await promptConfirmation(`${colors.yellow}Replay issue #${issueNumberArg}?${colors.reset}`);
        if (!confirmed) {
            console.log(`${colors.dim}Replay cancelled.${colors.reset}`);
            return;
        }
        console.log('');
    }
    // Perform the replay
    if (dryRun) {
        if (!options.json) {
            console.log(`${colors.yellow}${colors.bold}DRY RUN - Would perform these actions:${colors.reset}`);
            console.log('');
            if (fresh && task.hasBranch) {
                console.log(`  1. Delete local branch: ${task.branch}`);
                if (branchExistsRemote(task.branch)) {
                    console.log(`  2. Delete remote branch: origin/${task.branch}`);
                }
                console.log(`  3. Move issue #${issueNumberArg} to ${readyColumn} column`);
            }
            else {
                console.log(`  1. Move issue #${issueNumberArg} to ${readyColumn} column`);
            }
            console.log(`  ${fresh ? '4' : '2'}. Increment retry count in metrics`);
            console.log(`  ${fresh ? '5' : '3'}. Start ChadGI to process the task`);
            console.log('');
            console.log(`${colors.dim}Run without --dry-run to execute these actions.${colors.reset}`);
        }
        else {
            const result = {
                success: true,
                action: 'replay',
                tasks: [task],
                message: `DRY RUN: Would replay issue #${issueNumberArg}`,
                replayedTasks: [issueNumberArg],
            };
            console.log(JSON.stringify(result, null, 2));
        }
        return;
    }
    // Handle fresh start - delete existing branch
    if (fresh && task.hasBranch) {
        if (!options.json) {
            console.log(`${colors.cyan}Deleting existing branch for fresh start...${colors.reset}`);
        }
        // Make sure we're not on the branch we're about to delete
        try {
            const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
            if (currentBranch === task.branch) {
                execSync(`git checkout "${baseBranch}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            }
        }
        catch {
            // Ignore checkout errors
        }
        // Delete local branch
        if (branchExistsLocally(task.branch)) {
            if (deleteLocalBranch(task.branch)) {
                if (!options.json) {
                    console.log(`  ${colors.green}Deleted local branch: ${task.branch}${colors.reset}`);
                }
            }
            else {
                if (!options.json) {
                    console.log(`  ${colors.yellow}Warning: Could not delete local branch: ${task.branch}${colors.reset}`);
                }
            }
        }
        // Delete remote branch
        if (branchExistsRemote(task.branch)) {
            if (deleteRemoteBranch(task.branch)) {
                if (!options.json) {
                    console.log(`  ${colors.green}Deleted remote branch: origin/${task.branch}${colors.reset}`);
                }
            }
            else {
                if (!options.json) {
                    console.log(`  ${colors.yellow}Warning: Could not delete remote branch: origin/${task.branch}${colors.reset}`);
                }
            }
        }
        if (!options.json) {
            console.log('');
        }
    }
    // Move issue to Ready column
    if (!options.json) {
        console.log(`${colors.cyan}Moving issue #${issueNumberArg} to ${readyColumn} column...${colors.reset}`);
    }
    const moved = moveIssueToReady(issueNumberArg, repo, projectNumber, readyColumn);
    if (!moved) {
        if (options.json) {
            const result = {
                success: false,
                action: 'replay',
                tasks: [task],
                message: `Failed to move issue #${issueNumberArg} to ${readyColumn} column`,
            };
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.error(`${colors.red}Error: Failed to move issue #${issueNumberArg} to ${readyColumn} column.${colors.reset}`);
            console.error('The issue may need to be manually added to the project board.');
        }
        process.exit(1);
    }
    if (!options.json) {
        console.log(`  ${colors.green}Issue moved to ${readyColumn} column${colors.reset}`);
        console.log('');
    }
    // Increment retry count
    incrementRetryCount(chadgiDir, issueNumberArg);
    if (options.json) {
        const result = {
            success: true,
            action: 'replay',
            tasks: [task],
            message: `Issue #${issueNumberArg} queued for replay`,
            replayedTasks: [issueNumberArg],
        };
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    // Success message
    console.log(`${colors.green}${colors.bold}Issue #${issueNumberArg} queued for replay!${colors.reset}`);
    console.log('');
    console.log(`Run ${colors.cyan}chadgi start${colors.reset} to process the task.`);
    console.log('');
    console.log(`${colors.purple}${colors.bold}==========================================================`);
    console.log('               Chad does what Chad wants.');
    console.log(`==========================================================${colors.reset}`);
}
// Replay the most recent failed task
export async function replayLast(options = {}) {
    const cwd = process.cwd();
    const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
    const configPath = options.config ? resolve(options.config) : defaultConfigPath;
    const chadgiDir = dirname(configPath);
    // Check if .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
        console.error(`Run ${colors.cyan}chadgi init${colors.reset} to initialize ChadGI.`);
        process.exit(1);
    }
    // Load config
    if (!existsSync(configPath)) {
        console.error(`${colors.red}Error: Config file not found at ${configPath}${colors.reset}`);
        process.exit(1);
    }
    const configContent = readFileSync(configPath, 'utf-8');
    const repo = parseYamlNested(configContent, 'github', 'repo') || 'owner/repo';
    const branchPrefix = parseYamlNested(configContent, 'branch', 'prefix') || 'feature/issue-';
    // Load failed tasks
    const metrics = loadTaskMetrics(chadgiDir);
    const sessions = loadSessionStats(chadgiDir);
    const failedTasks = getFailedTasks(metrics, sessions, repo, branchPrefix, false);
    if (failedTasks.length === 0) {
        if (options.json) {
            const result = {
                success: false,
                action: 'replay',
                tasks: [],
                message: 'No failed tasks found',
            };
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(`${colors.green}No failed tasks found.${colors.reset}`);
        }
        return;
    }
    // Get the most recent failed task
    const mostRecent = failedTasks[0];
    // Replay it
    await replay(mostRecent.issueNumber, options);
}
// Replay all failed tasks from the last session
export async function replayAllFailed(options = {}) {
    const cwd = process.cwd();
    const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
    const configPath = options.config ? resolve(options.config) : defaultConfigPath;
    const chadgiDir = dirname(configPath);
    const dryRun = options.dryRun ?? false;
    const skipConfirmation = options.yes ?? false;
    // Check if .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
        console.error(`Run ${colors.cyan}chadgi init${colors.reset} to initialize ChadGI.`);
        process.exit(1);
    }
    // Load config
    if (!existsSync(configPath)) {
        console.error(`${colors.red}Error: Config file not found at ${configPath}${colors.reset}`);
        process.exit(1);
    }
    const configContent = readFileSync(configPath, 'utf-8');
    const repo = parseYamlNested(configContent, 'github', 'repo') || 'owner/repo';
    const projectNumber = parseYamlNested(configContent, 'github', 'project_number') || '1';
    const readyColumn = parseYamlNested(configContent, 'github', 'ready_column') || 'Ready';
    const branchPrefix = parseYamlNested(configContent, 'branch', 'prefix') || 'feature/issue-';
    const baseBranch = parseYamlNested(configContent, 'branch', 'base') || 'main';
    const fresh = options.fresh ?? false;
    if (repo === 'owner/repo') {
        console.error(`${colors.red}Error: Repository not configured in chadgi-config.yaml${colors.reset}`);
        process.exit(1);
    }
    // Load failed tasks from last session only
    const metrics = loadTaskMetrics(chadgiDir);
    const sessions = loadSessionStats(chadgiDir);
    const failedTasks = getFailedTasks(metrics, sessions, repo, branchPrefix, true);
    if (failedTasks.length === 0) {
        if (options.json) {
            const result = {
                success: true,
                action: 'replay',
                tasks: [],
                message: 'No failed tasks found in the last session',
            };
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(`${colors.green}No failed tasks found in the last session.${colors.reset}`);
        }
        return;
    }
    // Fetch issue titles for display
    for (const task of failedTasks) {
        if (!task.issueTitle) {
            task.issueTitle = fetchIssueTitle(repo, task.issueNumber) || undefined;
        }
    }
    if (!options.json) {
        console.log(`${colors.purple}${colors.bold}`);
        console.log('==========================================================');
        console.log('              CHADGI REPLAY ALL FAILED                     ');
        console.log('==========================================================');
        console.log(`${colors.reset}`);
        console.log(`${colors.cyan}Found ${failedTasks.length} failed task${failedTasks.length !== 1 ? 's' : ''} from the last session:${colors.reset}`);
        console.log('');
        for (const task of failedTasks) {
            console.log(`  ${colors.bold}#${task.issueNumber}${colors.reset} - ${task.issueTitle || '(no title)'}`);
            if (task.failureReason) {
                console.log(`    ${colors.red}${task.failureReason}${colors.reset}`);
            }
        }
        console.log('');
        if (fresh) {
            console.log(`${colors.yellow}Mode: Fresh start - existing branches will be deleted${colors.reset}`);
            console.log('');
        }
        if (dryRun) {
            console.log(`${colors.yellow}DRY RUN - No changes will be made${colors.reset}`);
            console.log('');
        }
    }
    // Confirm before proceeding
    if (!skipConfirmation && !dryRun && !options.json) {
        const confirmed = await promptConfirmation(`${colors.yellow}Replay all ${failedTasks.length} failed task${failedTasks.length !== 1 ? 's' : ''}?${colors.reset}`);
        if (!confirmed) {
            console.log(`${colors.dim}Replay cancelled.${colors.reset}`);
            return;
        }
        console.log('');
    }
    if (dryRun) {
        if (options.json) {
            const result = {
                success: true,
                action: 'replay',
                tasks: failedTasks,
                message: `DRY RUN: Would replay ${failedTasks.length} task(s)`,
                replayedTasks: failedTasks.map(t => t.issueNumber),
            };
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(`${colors.yellow}${colors.bold}DRY RUN - Would replay ${failedTasks.length} task(s)${colors.reset}`);
        }
        return;
    }
    const replayedTasks = [];
    const failedToReplay = [];
    // Process each failed task
    for (const task of failedTasks) {
        if (!options.json) {
            console.log(`${colors.cyan}Processing issue #${task.issueNumber}...${colors.reset}`);
        }
        // Handle fresh start - delete existing branch
        if (fresh && task.hasBranch) {
            // Make sure we're not on the branch we're about to delete
            try {
                const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
                if (currentBranch === task.branch) {
                    execSync(`git checkout "${baseBranch}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
                }
            }
            catch {
                // Ignore checkout errors
            }
            if (branchExistsLocally(task.branch)) {
                deleteLocalBranch(task.branch);
            }
            if (branchExistsRemote(task.branch)) {
                deleteRemoteBranch(task.branch);
            }
        }
        // Move issue to Ready column
        const moved = moveIssueToReady(task.issueNumber, repo, projectNumber, readyColumn);
        if (moved) {
            incrementRetryCount(chadgiDir, task.issueNumber);
            replayedTasks.push(task.issueNumber);
            if (!options.json) {
                console.log(`  ${colors.green}Queued #${task.issueNumber} for replay${colors.reset}`);
            }
        }
        else {
            failedToReplay.push(task.issueNumber);
            if (!options.json) {
                console.log(`  ${colors.red}Failed to queue #${task.issueNumber}${colors.reset}`);
            }
        }
    }
    if (options.json) {
        const result = {
            success: failedToReplay.length === 0,
            action: 'replay',
            tasks: failedTasks,
            message: `Queued ${replayedTasks.length} task(s) for replay${failedToReplay.length > 0 ? `, ${failedToReplay.length} failed` : ''}`,
            replayedTasks,
        };
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log('');
    console.log(`${colors.green}${colors.bold}Queued ${replayedTasks.length} task(s) for replay!${colors.reset}`);
    if (failedToReplay.length > 0) {
        console.log(`${colors.yellow}${failedToReplay.length} task(s) could not be queued.${colors.reset}`);
    }
    console.log('');
    console.log(`Run ${colors.cyan}chadgi start${colors.reset} to process the tasks.`);
    console.log('');
    console.log(`${colors.purple}${colors.bold}==========================================================`);
    console.log('               Chad does what Chad wants.');
    console.log(`==========================================================${colors.reset}`);
}
//# sourceMappingURL=replay.js.map