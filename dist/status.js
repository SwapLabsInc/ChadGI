import { existsSync } from 'fs';
// Import shared utilities
import { colors } from './utils/colors.js';
import { resolveConfigPath } from './utils/config.js';
import { formatDuration } from './utils/formatting.js';
import { loadProgressData, loadPauseLock, findPendingApproval, loadAllTaskLocks } from './utils/data.js';
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
function buildStatusInfo(progress, pauseInfo, pendingApproval, taskLocks = []) {
    const statusInfo = {
        state: 'unknown',
    };
    // Set pause info if present
    if (pauseInfo) {
        const pausedAt = new Date(pauseInfo.paused_at);
        statusInfo.pause = {
            pausedAt: pauseInfo.paused_at,
            reason: pauseInfo.reason,
            resumeAt: pauseInfo.resume_at,
            pausedSeconds: Math.floor((Date.now() - pausedAt.getTime()) / 1000),
        };
    }
    // Determine state from progress
    if (progress) {
        statusInfo.lastUpdated = progress.last_updated;
        if (pauseInfo) {
            statusInfo.state = 'paused';
        }
        else if (progress.status === 'awaiting_approval') {
            statusInfo.state = 'awaiting_approval';
        }
        else if (progress.status === 'in_progress') {
            statusInfo.state = 'running';
        }
        else if (progress.status === 'paused') {
            statusInfo.state = 'paused';
        }
        else if (progress.status === 'error') {
            statusInfo.state = 'error';
        }
        else if (progress.status === 'stopped') {
            statusInfo.state = 'stopped';
        }
        else if (progress.status === 'idle') {
            statusInfo.state = 'idle';
        }
        // Current task info
        if (progress.current_task?.id) {
            const startedAt = new Date(progress.current_task.started_at);
            statusInfo.currentTask = {
                id: progress.current_task.id,
                title: progress.current_task.title,
                branch: progress.current_task.branch,
                startedAt: progress.current_task.started_at,
                elapsedSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
            };
        }
        // Session info
        if (progress.session?.started_at) {
            const sessionStart = new Date(progress.session.started_at);
            statusInfo.session = {
                startedAt: progress.session.started_at,
                tasksCompleted: progress.session.tasks_completed ?? 0,
                totalCostUsd: progress.session.total_cost_usd ?? 0,
                elapsedSeconds: Math.floor((Date.now() - sessionStart.getTime()) / 1000),
            };
        }
    }
    else {
        statusInfo.state = pauseInfo ? 'paused' : 'stopped';
    }
    // Check for pending approval
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
    // Add task locks
    return {
        ...statusInfo,
        taskLocks: taskLocks.length > 0 ? taskLocks : undefined,
    };
}
function printStatus(statusInfo) {
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
    // Task locks info
    if (statusInfo.taskLocks && statusInfo.taskLocks.length > 0) {
        const activeLocks = statusInfo.taskLocks.filter((l) => !l.isStale);
        const staleLocks = statusInfo.taskLocks.filter((l) => l.isStale);
        console.log(`${colors.cyan}${colors.bold}TASK LOCKS${colors.reset}`);
        console.log(`  Active:        ${activeLocks.length} lock(s)`);
        if (staleLocks.length > 0) {
            console.log(`  Stale:         ${colors.yellow}${staleLocks.length} lock(s)${colors.reset}`);
        }
        // Show first few locks
        const locksToShow = statusInfo.taskLocks.slice(0, 5);
        for (const lock of locksToShow) {
            const staleIndicator = lock.isStale ? ` ${colors.yellow}(stale)${colors.reset}` : '';
            console.log(`  - Issue #${lock.issueNumber}: locked ${formatDuration(lock.lockedSeconds)} ago${staleIndicator}`);
        }
        if (statusInfo.taskLocks.length > 5) {
            console.log(`  ${colors.dim}... and ${statusInfo.taskLocks.length - 5} more${colors.reset}`);
        }
        console.log('');
        if (staleLocks.length > 0) {
            console.log(`  ${colors.dim}Run 'chadgi unlock --stale' to clean up stale locks.${colors.reset}`);
            console.log('');
        }
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
export async function status(options = {}) {
    const cwd = process.cwd();
    const { chadgiDir } = resolveConfigPath(options.config, cwd);
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
    // Load data using shared utilities
    const progress = loadProgressData(chadgiDir);
    const pauseInfo = loadPauseLock(chadgiDir);
    const pendingApproval = findPendingApproval(chadgiDir);
    const taskLocks = loadAllTaskLocks(chadgiDir);
    // Build status info
    const statusInfo = buildStatusInfo(progress, pauseInfo, pendingApproval, taskLocks);
    // Output as JSON if requested
    if (options.json) {
        console.log(JSON.stringify(statusInfo, null, 2));
        return;
    }
    // Display formatted status
    printStatus(statusInfo);
}
//# sourceMappingURL=status.js.map