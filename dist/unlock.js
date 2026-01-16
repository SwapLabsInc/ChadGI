/**
 * Unlock command for ChadGI.
 *
 * Manually releases task locks to allow re-processing of issues.
 */
import { existsSync } from 'fs';
import { colors } from './utils/colors.js';
import { resolveConfigPath } from './utils/config.js';
import { formatDuration } from './utils/formatting.js';
import { forceReleaseTaskLock, listTaskLocks, findStaleLocks, cleanupStaleLocks, readTaskLock, DEFAULT_LOCK_TIMEOUT_MINUTES, } from './utils/locks.js';
/**
 * Format a single lock for display
 */
function formatLockInfo(lock) {
    const lines = [];
    const staleIndicator = lock.isStale ? `${colors.yellow}(stale)${colors.reset}` : '';
    lines.push(`  Issue #${lock.issueNumber} ${staleIndicator}`);
    lines.push(`    Session:   ${lock.sessionId}`);
    lines.push(`    PID:       ${lock.pid}`);
    lines.push(`    Hostname:  ${lock.hostname}`);
    lines.push(`    Locked:    ${formatDuration(lock.lockedSeconds)} ago`);
    lines.push(`    Heartbeat: ${formatDuration(lock.heartbeatAgeSeconds)} ago`);
    if (lock.workerId !== undefined) {
        lines.push(`    Worker:    ${lock.workerId}`);
    }
    if (lock.repoName) {
        lines.push(`    Repo:      ${lock.repoName}`);
    }
    return lines.join('\n');
}
/**
 * List all current task locks
 */
async function listLocks(chadgiDir, options) {
    const locks = listTaskLocks(chadgiDir);
    if (locks.length === 0) {
        return {
            success: true,
            action: 'list',
            released: 0,
            locks: [],
            message: 'No task locks found.',
        };
    }
    const staleLocks = locks.filter((l) => l.isStale);
    const activeLocks = locks.filter((l) => !l.isStale);
    return {
        success: true,
        action: 'list',
        released: 0,
        locks,
        message: `Found ${locks.length} task lock(s): ${activeLocks.length} active, ${staleLocks.length} stale.`,
    };
}
/**
 * Clean up stale locks
 */
async function cleanupStale(chadgiDir, options) {
    const staleLocks = findStaleLocks(chadgiDir);
    if (staleLocks.length === 0) {
        return {
            success: true,
            action: 'cleanup',
            released: 0,
            locks: [],
            message: 'No stale locks found.',
        };
    }
    const removedCount = cleanupStaleLocks(chadgiDir);
    return {
        success: true,
        action: 'cleanup',
        released: removedCount,
        locks: staleLocks,
        message: `Removed ${removedCount} stale lock(s).`,
    };
}
/**
 * Unlock a specific issue
 */
async function unlockIssue(chadgiDir, issueNumber, options) {
    const lock = readTaskLock(chadgiDir, issueNumber);
    if (!lock) {
        return {
            success: false,
            action: 'unlock',
            issueNumber,
            message: `Issue #${issueNumber} is not locked.`,
        };
    }
    // Check if force is required for non-stale locks
    const isStale = lock.last_heartbeat
        ? (Date.now() - new Date(lock.last_heartbeat).getTime()) > DEFAULT_LOCK_TIMEOUT_MINUTES * 60 * 1000
        : false;
    if (!isStale && !options.force) {
        return {
            success: false,
            action: 'unlock',
            issueNumber,
            message: `Issue #${issueNumber} is locked by an active session (${lock.session_id}). Use --force to override.`,
        };
    }
    const released = forceReleaseTaskLock(chadgiDir, issueNumber);
    if (released) {
        return {
            success: true,
            action: 'unlock',
            issueNumber,
            released: 1,
            message: `Released lock for issue #${issueNumber}.`,
        };
    }
    else {
        return {
            success: false,
            action: 'unlock',
            issueNumber,
            message: `Failed to release lock for issue #${issueNumber}.`,
        };
    }
}
/**
 * Unlock all locks
 */
async function unlockAll(chadgiDir, options) {
    const locks = listTaskLocks(chadgiDir);
    if (locks.length === 0) {
        return {
            success: true,
            action: 'unlock',
            released: 0,
            locks: [],
            message: 'No locks to release.',
        };
    }
    // Without force, only remove stale locks
    const locksToRemove = options.force ? locks : locks.filter((l) => l.isStale);
    if (locksToRemove.length === 0) {
        return {
            success: false,
            action: 'unlock',
            released: 0,
            locks,
            message: `Found ${locks.length} active lock(s). Use --force to release active locks.`,
        };
    }
    let removedCount = 0;
    for (const lock of locksToRemove) {
        if (forceReleaseTaskLock(chadgiDir, lock.issueNumber)) {
            removedCount++;
        }
    }
    return {
        success: true,
        action: 'unlock',
        released: removedCount,
        locks: locksToRemove,
        message: `Released ${removedCount} lock(s).`,
    };
}
/**
 * Print unlock results
 */
function printResult(result, showLocks) {
    if (result.action === 'list' && result.locks && result.locks.length > 0) {
        console.log(`${colors.purple}${colors.bold}`);
        console.log('==========================================================');
        console.log('                    TASK LOCKS                            ');
        console.log('==========================================================');
        console.log(`${colors.reset}`);
        const activeLocks = result.locks.filter((l) => !l.isStale);
        const staleLocks = result.locks.filter((l) => l.isStale);
        if (activeLocks.length > 0) {
            console.log(`${colors.cyan}${colors.bold}Active Locks (${activeLocks.length})${colors.reset}`);
            for (const lock of activeLocks) {
                console.log(formatLockInfo(lock));
            }
            console.log('');
        }
        if (staleLocks.length > 0) {
            console.log(`${colors.yellow}${colors.bold}Stale Locks (${staleLocks.length})${colors.reset}`);
            for (const lock of staleLocks) {
                console.log(formatLockInfo(lock));
            }
            console.log('');
            console.log(`${colors.dim}Run 'chadgi unlock --stale' to clean up stale locks.${colors.reset}`);
        }
    }
    else if (showLocks && result.locks && result.locks.length > 0) {
        console.log('');
        console.log(`${colors.cyan}Released locks:${colors.reset}`);
        for (const lock of result.locks) {
            console.log(`  - Issue #${lock.issueNumber}`);
        }
    }
    // Print message
    const color = result.success ? colors.green : colors.red;
    console.log(`${color}${result.message}${colors.reset}`);
}
/**
 * Main unlock command
 */
export async function unlock(issueNumber, options = {}) {
    const cwd = process.cwd();
    const { chadgiDir } = resolveConfigPath(options.config, cwd);
    if (!existsSync(chadgiDir)) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: '.chadgi directory not found' }, null, 2));
        }
        else {
            console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
            console.error('Run `chadgi init` first to initialize ChadGI.');
        }
        process.exit(1);
    }
    let result;
    if (options.stale) {
        // Clean up stale locks only
        result = await cleanupStale(chadgiDir, options);
    }
    else if (options.all) {
        // Unlock all locks (with force) or all stale locks (without force)
        result = await unlockAll(chadgiDir, options);
    }
    else if (issueNumber !== undefined) {
        // Unlock specific issue
        result = await unlockIssue(chadgiDir, issueNumber, options);
    }
    else {
        // No issue specified - list locks
        result = await listLocks(chadgiDir, options);
    }
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
    }
    else {
        printResult(result, result.action !== 'list');
    }
    if (!result.success) {
        process.exit(1);
    }
}
//# sourceMappingURL=unlock.js.map