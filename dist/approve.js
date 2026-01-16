import { existsSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { colors } from './utils/colors.js';
import { atomicWriteJson } from './utils/fileOps.js';
import { toISOString } from './utils/formatting.js';
import { resolveChadgiDir } from './utils/config.js';
/**
 * Get the current username for audit purposes
 */
function getCurrentUser() {
    try {
        return execSync('whoami', { encoding: 'utf-8' }).trim();
    }
    catch {
        return 'unknown';
    }
}
/**
 * Find pending approval lock files in the chadgi directory
 */
function findPendingApprovals(chadgiDir, issueNumber) {
    const files = readdirSync(chadgiDir).filter(f => f.startsWith('approval-') && f.endsWith('.lock'));
    if (issueNumber) {
        return files.filter(f => f.includes(`-${issueNumber}-`) || f.includes(`-${issueNumber}.`));
    }
    return files;
}
/**
 * Read approval lock file
 */
function readApprovalLock(filePath) {
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    }
    catch {
        return null;
    }
}
/**
 * Log approval decision to history
 */
function logApprovalToHistory(chadgiDir, issueNumber, phase, action, comment) {
    const progressFile = join(chadgiDir, 'chadgi-progress.json');
    try {
        let progress = { status: 'idle', last_updated: toISOString(new Date()) };
        if (existsSync(progressFile)) {
            progress = JSON.parse(readFileSync(progressFile, 'utf-8'));
        }
        if (!progress.approval_history) {
            progress.approval_history = [];
        }
        progress.approval_history.push({
            issue_number: issueNumber,
            phase,
            action,
            timestamp: toISOString(new Date()),
            comment,
        });
        // Keep only the last 100 approval entries
        if (progress.approval_history.length > 100) {
            progress.approval_history = progress.approval_history.slice(-100);
        }
        progress.last_updated = toISOString(new Date());
        atomicWriteJson(progressFile, progress);
    }
    catch {
        // Non-critical, ignore errors
    }
}
/**
 * Approve a pending task in interactive mode
 */
export async function approve(options = {}) {
    const chadgiDir = resolveChadgiDir(options);
    // Ensure .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: '.chadgi directory not found' }));
        }
        else {
            console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
            console.error('Run `chadgi init` first to initialize ChadGI.');
        }
        process.exit(1);
    }
    // Find pending approval lock files
    const pendingFiles = findPendingApprovals(chadgiDir, options.issueNumber);
    if (pendingFiles.length === 0) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'No pending approvals found' }));
        }
        else {
            console.log(`${colors.yellow}No pending approvals found.${colors.reset}`);
            if (options.issueNumber) {
                console.log(`Searched for issue #${options.issueNumber}`);
            }
            console.log('\nRun `chadgi status` to check if ChadGI is running in interactive mode.');
        }
        return;
    }
    // Process the first (or only) pending approval
    const lockFile = join(chadgiDir, pendingFiles[0]);
    const lockData = readApprovalLock(lockFile);
    if (!lockData) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'Could not read approval lock file' }));
        }
        else {
            console.error(`${colors.red}Error: Could not read approval lock file.${colors.reset}`);
        }
        process.exit(1);
    }
    if (lockData.status !== 'pending') {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: `Approval already ${lockData.status}` }));
        }
        else {
            console.log(`${colors.yellow}Approval already ${lockData.status}.${colors.reset}`);
        }
        return;
    }
    // Update the lock file with approval
    const now = new Date();
    lockData.status = 'approved';
    lockData.approver = getCurrentUser();
    lockData.approved_at = toISOString(now);
    if (options.message) {
        lockData.comment = options.message;
    }
    atomicWriteJson(lockFile, lockData);
    // Log to history
    logApprovalToHistory(chadgiDir, lockData.issue_number, lockData.phase, 'approved', options.message);
    // Output result
    if (options.json) {
        console.log(JSON.stringify({
            success: true,
            issue_number: lockData.issue_number,
            phase: lockData.phase,
            approver: lockData.approver,
            approved_at: lockData.approved_at,
            comment: lockData.comment,
        }));
    }
    else {
        console.log(`${colors.green}${colors.bold}`);
        console.log('==========================================================');
        console.log('                    APPROVAL GRANTED                       ');
        console.log('==========================================================');
        console.log(`${colors.reset}`);
        console.log(`${colors.cyan}Issue:${colors.reset}    #${lockData.issue_number}`);
        if (lockData.issue_title) {
            console.log(`${colors.cyan}Title:${colors.reset}    ${lockData.issue_title}`);
        }
        console.log(`${colors.cyan}Phase:${colors.reset}    ${formatPhase(lockData.phase)}`);
        console.log(`${colors.cyan}Approver:${colors.reset} ${lockData.approver}`);
        console.log(`${colors.cyan}Time:${colors.reset}     ${now.toLocaleString()}`);
        if (options.message) {
            console.log(`${colors.cyan}Comment:${colors.reset}  ${options.message}`);
        }
        console.log('');
        console.log(`${colors.green}ChadGI will continue processing.${colors.reset}`);
    }
}
/**
 * Reject a pending task in interactive mode
 */
export async function reject(options = {}) {
    const chadgiDir = resolveChadgiDir(options);
    // Ensure .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: '.chadgi directory not found' }));
        }
        else {
            console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
            console.error('Run `chadgi init` first to initialize ChadGI.');
        }
        process.exit(1);
    }
    // Find pending approval lock files
    const pendingFiles = findPendingApprovals(chadgiDir, options.issueNumber);
    if (pendingFiles.length === 0) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'No pending approvals found' }));
        }
        else {
            console.log(`${colors.yellow}No pending approvals found.${colors.reset}`);
            if (options.issueNumber) {
                console.log(`Searched for issue #${options.issueNumber}`);
            }
            console.log('\nRun `chadgi status` to check if ChadGI is running in interactive mode.');
        }
        return;
    }
    // Process the first (or only) pending approval
    const lockFile = join(chadgiDir, pendingFiles[0]);
    const lockData = readApprovalLock(lockFile);
    if (!lockData) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'Could not read approval lock file' }));
        }
        else {
            console.error(`${colors.red}Error: Could not read approval lock file.${colors.reset}`);
        }
        process.exit(1);
    }
    if (lockData.status !== 'pending') {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: `Approval already ${lockData.status}` }));
        }
        else {
            console.log(`${colors.yellow}Approval already ${lockData.status}.${colors.reset}`);
        }
        return;
    }
    // Update the lock file with rejection
    const now = new Date();
    lockData.status = 'rejected';
    lockData.approver = getCurrentUser();
    lockData.rejected_at = toISOString(now);
    if (options.message) {
        lockData.feedback = options.message;
    }
    atomicWriteJson(lockFile, lockData);
    // Log to history
    logApprovalToHistory(chadgiDir, lockData.issue_number, lockData.phase, 'rejected', options.message);
    // Output result
    if (options.json) {
        console.log(JSON.stringify({
            success: true,
            issue_number: lockData.issue_number,
            phase: lockData.phase,
            action: 'rejected',
            skip: options.skip ?? false,
            rejected_at: lockData.rejected_at,
            feedback: lockData.feedback,
        }));
    }
    else {
        console.log(`${colors.red}${colors.bold}`);
        console.log('==========================================================');
        console.log('                    APPROVAL REJECTED                      ');
        console.log('==========================================================');
        console.log(`${colors.reset}`);
        console.log(`${colors.cyan}Issue:${colors.reset}    #${lockData.issue_number}`);
        if (lockData.issue_title) {
            console.log(`${colors.cyan}Title:${colors.reset}    ${lockData.issue_title}`);
        }
        console.log(`${colors.cyan}Phase:${colors.reset}    ${formatPhase(lockData.phase)}`);
        console.log(`${colors.cyan}Rejector:${colors.reset} ${lockData.approver}`);
        console.log(`${colors.cyan}Time:${colors.reset}     ${now.toLocaleString()}`);
        if (options.message) {
            console.log(`${colors.cyan}Feedback:${colors.reset} ${options.message}`);
        }
        console.log('');
        if (options.skip) {
            console.log(`${colors.yellow}Task will be moved back to Ready column.${colors.reset}`);
        }
        else {
            console.log(`${colors.yellow}Claude will iterate with your feedback.${colors.reset}`);
        }
    }
}
/**
 * Format phase name for display
 */
function formatPhase(phase) {
    switch (phase) {
        case 'pre_task':
            return 'Pre-Task Review';
        case 'phase1':
            return 'Phase 1: Post-Implementation Review';
        case 'phase2':
            return 'Phase 2: Pre-PR Creation Review';
        default:
            return phase;
    }
}
/**
 * Check if there are pending approvals (for use by other modules)
 */
export function hasPendingApprovals(chadgiDir) {
    const pendingFiles = findPendingApprovals(chadgiDir);
    for (const file of pendingFiles) {
        const lockData = readApprovalLock(join(chadgiDir, file));
        if (lockData && lockData.status === 'pending') {
            return true;
        }
    }
    return false;
}
/**
 * Get pending approval info (for use by status command)
 */
export function getPendingApprovalInfo(chadgiDir) {
    const pendingFiles = findPendingApprovals(chadgiDir);
    for (const file of pendingFiles) {
        const lockData = readApprovalLock(join(chadgiDir, file));
        if (lockData && lockData.status === 'pending') {
            return lockData;
        }
    }
    return null;
}
/**
 * Create an approval lock file (for use by bash script via node)
 */
export function createApprovalLock(chadgiDir, phase, issueNumber, issueTitle, branch, diffStats) {
    const lockData = {
        status: 'pending',
        created_at: toISOString(new Date()),
        issue_number: issueNumber,
        issue_title: issueTitle,
        branch: branch,
        phase: phase,
        files_changed: diffStats?.filesChanged,
        insertions: diffStats?.insertions,
        deletions: diffStats?.deletions,
    };
    const lockFile = join(chadgiDir, `approval-${phase}-${issueNumber}.lock`);
    atomicWriteJson(lockFile, lockData);
    return lockFile;
}
/**
 * Remove an approval lock file
 */
export function removeApprovalLock(chadgiDir, phase, issueNumber) {
    const lockFile = join(chadgiDir, `approval-${phase}-${issueNumber}.lock`);
    if (existsSync(lockFile)) {
        unlinkSync(lockFile);
    }
}
//# sourceMappingURL=approve.js.map