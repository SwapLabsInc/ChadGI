import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    purple: '\x1b[35m',
    blue: '\x1b[34m',
};
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
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
    return new Date(isoDate).toLocaleString();
}
function getStateColor(state) {
    switch (state) {
        case 'running':
            return colors.green;
        case 'paused':
            return colors.yellow;
        case 'awaiting_approval':
            return colors.purple;
        case 'stopped':
        case 'idle':
            return colors.blue;
        case 'error':
            return colors.red;
        default:
            return colors.dim;
    }
}
function getStateEmoji(state) {
    switch (state) {
        case 'running':
            return '>';
        case 'paused':
            return '||';
        case 'awaiting_approval':
            return '?!';
        case 'stopped':
        case 'idle':
            return '[]';
        case 'error':
            return 'x';
        default:
            return '?';
    }
}
/**
 * Format phase name for display
 */
function formatPhaseName(phase) {
    switch (phase) {
        case 'pre_task':
            return 'Pre-Task Review';
        case 'phase1':
            return 'Post-Implementation Review';
        case 'phase2':
            return 'Pre-PR Creation Review';
        default:
            return phase;
    }
}
/**
 * Find pending approval lock files and return the first one
 */
function findPendingApproval(chadgiDir) {
    try {
        const files = readdirSync(chadgiDir).filter(f => f.startsWith('approval-') && f.endsWith('.lock'));
        for (const file of files) {
            try {
                const data = JSON.parse(readFileSync(join(chadgiDir, file), 'utf-8'));
                if (data.status === 'pending') {
                    return data;
                }
            }
            catch {
                // Skip invalid files
            }
        }
    }
    catch {
        // Directory read error
    }
    return null;
}
export async function status(options = {}) {
    const cwd = process.cwd();
    const chadgiDir = options.config
        ? dirname(resolve(options.config))
        : join(cwd, '.chadgi');
    if (!existsSync(chadgiDir)) {
        if (options.json) {
            console.log(JSON.stringify({ state: 'unknown', error: '.chadgi directory not found' }, null, 2));
        }
        else {
            console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
            console.error('Run `chadgi init` first to initialize ChadGI.');
        }
        process.exit(1);
    }
    const progressFile = join(chadgiDir, 'chadgi-progress.json');
    const pauseLockFile = join(chadgiDir, 'pause.lock');
    const statusInfo = {
        state: 'unknown',
    };
    // Check for pause lock first
    let pauseInfo = null;
    if (existsSync(pauseLockFile)) {
        try {
            const parsed = JSON.parse(readFileSync(pauseLockFile, 'utf-8'));
            pauseInfo = parsed;
            const pausedAt = new Date(parsed.paused_at);
            statusInfo.pause = {
                pausedAt: parsed.paused_at,
                reason: parsed.reason,
                resumeAt: parsed.resume_at,
                pausedSeconds: Math.floor((Date.now() - pausedAt.getTime()) / 1000),
            };
        }
        catch {
            // Lock file exists but might be corrupted
        }
    }
    // Read progress file
    let progress = null;
    if (existsSync(progressFile)) {
        try {
            const parsed = JSON.parse(readFileSync(progressFile, 'utf-8'));
            progress = parsed;
            statusInfo.lastUpdated = parsed.last_updated;
            // Determine state
            if (pauseInfo) {
                statusInfo.state = 'paused';
            }
            else if (parsed.status === 'awaiting_approval') {
                statusInfo.state = 'awaiting_approval';
            }
            else if (parsed.status === 'in_progress') {
                statusInfo.state = 'running';
            }
            else if (parsed.status === 'paused') {
                statusInfo.state = 'paused';
            }
            else if (parsed.status === 'error') {
                statusInfo.state = 'error';
            }
            else if (parsed.status === 'stopped') {
                statusInfo.state = 'stopped';
            }
            else if (parsed.status === 'idle') {
                statusInfo.state = 'idle';
            }
            // Current task info
            if (parsed.current_task?.id) {
                const startedAt = new Date(parsed.current_task.started_at);
                statusInfo.currentTask = {
                    id: parsed.current_task.id,
                    title: parsed.current_task.title,
                    branch: parsed.current_task.branch,
                    startedAt: parsed.current_task.started_at,
                    elapsedSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
                };
            }
            // Session info
            if (parsed.session?.started_at) {
                const sessionStart = new Date(parsed.session.started_at);
                statusInfo.session = {
                    startedAt: parsed.session.started_at,
                    tasksCompleted: parsed.session.tasks_completed ?? 0,
                    totalCostUsd: parsed.session.total_cost_usd ?? 0,
                    elapsedSeconds: Math.floor((Date.now() - sessionStart.getTime()) / 1000),
                };
            }
        }
        catch (error) {
            if (options.json) {
                console.log(JSON.stringify({ state: 'unknown', error: 'Could not read progress file' }, null, 2));
            }
            else {
                console.error(`${colors.red}Error reading progress file:${colors.reset}`, error.message);
            }
            process.exit(1);
        }
    }
    else {
        statusInfo.state = pauseInfo ? 'paused' : 'stopped';
    }
    // Check for pending approval lock files
    const pendingApproval = findPendingApproval(chadgiDir);
    if (pendingApproval) {
        statusInfo.state = 'awaiting_approval';
        const createdAt = new Date(pendingApproval.created_at);
        statusInfo.pendingApproval = {
            phase: pendingApproval.phase,
            issueNumber: pendingApproval.issue_number,
            issueTitle: pendingApproval.issue_title,
            createdAt: pendingApproval.created_at,
            filesChanged: pendingApproval.files_changed,
            insertions: pendingApproval.insertions,
            deletions: pendingApproval.deletions,
            waitingSeconds: Math.floor((Date.now() - createdAt.getTime()) / 1000),
        };
    }
    // Output as JSON if requested
    if (options.json) {
        console.log(JSON.stringify(statusInfo, null, 2));
        return;
    }
    // Display formatted status
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('                    CHADGI STATUS                          ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
    // State display
    const stateColor = getStateColor(statusInfo.state);
    const stateEmoji = getStateEmoji(statusInfo.state);
    console.log(`${colors.cyan}Session State:${colors.reset} ${stateColor}${colors.bold}${stateEmoji} ${statusInfo.state.toUpperCase()}${colors.reset}`);
    console.log('');
    // Pause info
    if (statusInfo.pause) {
        console.log(`${colors.yellow}${colors.bold}PAUSE INFORMATION${colors.reset}`);
        console.log(`  Paused at:     ${formatDate(statusInfo.pause.pausedAt)}`);
        console.log(`  Paused for:    ${formatDuration(statusInfo.pause.pausedSeconds)}`);
        if (statusInfo.pause.reason) {
            console.log(`  Reason:        ${statusInfo.pause.reason}`);
        }
        if (statusInfo.pause.resumeAt) {
            const resumeTime = new Date(statusInfo.pause.resumeAt);
            const now = new Date();
            if (resumeTime > now) {
                const remainingMs = resumeTime.getTime() - now.getTime();
                const remainingSecs = Math.floor(remainingMs / 1000);
                console.log(`  Auto-resume:   ${formatDate(statusInfo.pause.resumeAt)} (in ${formatDuration(remainingSecs)})`);
            }
            else {
                console.log(`  Auto-resume:   ${formatDate(statusInfo.pause.resumeAt)} ${colors.yellow}(expired)${colors.reset}`);
            }
        }
        console.log('');
    }
    // Pending approval info
    if (statusInfo.pendingApproval) {
        const phaseName = formatPhaseName(statusInfo.pendingApproval.phase);
        console.log(`${colors.purple}${colors.bold}PENDING APPROVAL${colors.reset}`);
        console.log(`  Issue:         #${statusInfo.pendingApproval.issueNumber}`);
        if (statusInfo.pendingApproval.issueTitle) {
            console.log(`  Title:         ${statusInfo.pendingApproval.issueTitle}`);
        }
        console.log(`  Phase:         ${phaseName}`);
        console.log(`  Waiting:       ${formatDuration(statusInfo.pendingApproval.waitingSeconds)}`);
        if (statusInfo.pendingApproval.filesChanged !== undefined) {
            const ins = statusInfo.pendingApproval.insertions ?? 0;
            const del = statusInfo.pendingApproval.deletions ?? 0;
            console.log(`  Changes:       ${statusInfo.pendingApproval.filesChanged} files (+${ins}/-${del})`);
        }
        console.log('');
        console.log(`  ${colors.green}chadgi approve${colors.reset}    - Approve and continue`);
        console.log(`  ${colors.red}chadgi reject${colors.reset}     - Reject with feedback`);
        console.log(`  ${colors.cyan}chadgi diff${colors.reset}       - View changes`);
        console.log('');
    }
    // Current task info
    if (statusInfo.currentTask) {
        console.log(`${colors.cyan}${colors.bold}CURRENT TASK${colors.reset}`);
        console.log(`  Issue:         #${statusInfo.currentTask.id}`);
        console.log(`  Title:         ${statusInfo.currentTask.title}`);
        console.log(`  Branch:        ${statusInfo.currentTask.branch}`);
        console.log(`  Started:       ${formatDate(statusInfo.currentTask.startedAt)}`);
        console.log(`  Elapsed:       ${formatDuration(statusInfo.currentTask.elapsedSeconds)}`);
        console.log('');
    }
    else if (statusInfo.state === 'running') {
        console.log(`${colors.cyan}${colors.bold}CURRENT TASK${colors.reset}`);
        console.log(`  ${colors.dim}(Searching for tasks...)${colors.reset}`);
        console.log('');
    }
    // Session info
    if (statusInfo.session) {
        console.log(`${colors.cyan}${colors.bold}SESSION STATISTICS${colors.reset}`);
        console.log(`  Started:       ${formatDate(statusInfo.session.startedAt)}`);
        console.log(`  Duration:      ${formatDuration(statusInfo.session.elapsedSeconds)}`);
        console.log(`  Completed:     ${statusInfo.session.tasksCompleted} task(s)`);
        console.log(`  Total cost:    $${statusInfo.session.totalCostUsd.toFixed(4)}`);
        console.log('');
    }
    // Last updated
    if (statusInfo.lastUpdated) {
        console.log(`${colors.dim}Last updated: ${formatDate(statusInfo.lastUpdated)}${colors.reset}`);
    }
    // Actions
    console.log('');
    if (statusInfo.state === 'awaiting_approval') {
        console.log(`${colors.purple}Awaiting human approval. Use 'chadgi approve' or 'chadgi reject'.${colors.reset}`);
    }
    else if (statusInfo.state === 'paused') {
        console.log(`${colors.green}Run 'chadgi resume' to continue processing.${colors.reset}`);
    }
    else if (statusInfo.state === 'stopped' || statusInfo.state === 'idle') {
        console.log(`${colors.green}Run 'chadgi start' to begin processing tasks.${colors.reset}`);
    }
    else if (statusInfo.state === 'running') {
        console.log(`${colors.yellow}Run 'chadgi pause' to pause after the current task.${colors.reset}`);
    }
    else if (statusInfo.state === 'error') {
        console.log(`${colors.yellow}Run 'chadgi start' to restart processing.${colors.reset}`);
    }
}
//# sourceMappingURL=status.js.map