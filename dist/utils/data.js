/**
 * Data loading utilities for ChadGI.
 *
 * Provides functions for loading and parsing common data files like
 * session stats, metrics, and progress files.
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { readTaskLock, listTaskLocks, findStaleLocks, isLockStale, DEFAULT_LOCK_TIMEOUT_MINUTES, } from './locks.js';
import { safeParseJson } from './fileOps.js';
import { SESSION_STATS_SCHEMA, METRICS_DATA_SCHEMA, TASK_METRICS_SCHEMA, PROGRESS_DATA_SCHEMA, PAUSE_LOCK_DATA_SCHEMA, APPROVAL_LOCK_DATA_SCHEMA, validateSchema, validateArray, } from './data-schema.js';
import { logSilentError, ErrorCategory } from './diagnostics.js';
// ============================================================================
// Session Stats
// ============================================================================
/**
 * Load session stats from chadgi-stats.json with schema validation.
 *
 * The session stats are validated against SESSION_STATS_SCHEMA to ensure:
 * - All required fields are present
 * - Numeric fields are within reasonable bounds
 * - Timestamps are in valid ISO format
 *
 * Invalid sessions are filtered out, and recoverable fields use defaults.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of validated session stats or empty array if file doesn't exist
 */
export function loadSessionStats(chadgiDir) {
    const statsFile = join(chadgiDir, 'chadgi-stats.json');
    if (!existsSync(statsFile)) {
        return [];
    }
    const content = readFileSync(statsFile, 'utf-8');
    const parseResult = safeParseJson(content, {
        filePath: statsFile,
    });
    if (!parseResult.success) {
        return [];
    }
    // Validate each session against the schema
    const validation = validateArray(parseResult.data, SESSION_STATS_SCHEMA, {
        recover: true,
        filePath: statsFile,
    });
    return validation.data;
}
/**
 * Get the most recent session from stats
 *
 * @param sessions - Array of session stats
 * @returns The most recent session or null
 */
export function getMostRecentSession(sessions) {
    if (sessions.length === 0)
        return null;
    return sessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
}
// ============================================================================
// Task Metrics
// ============================================================================
/**
 * Load task metrics from chadgi-metrics.json with schema validation.
 *
 * The metrics are validated against TASK_METRICS_SCHEMA to ensure:
 * - All required fields are present
 * - Numeric fields (cost, duration, iterations) are within bounds
 * - Status is a valid enum value
 *
 * Invalid metrics are filtered out, and recoverable fields use defaults.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of validated task metrics or empty array if file doesn't exist
 */
export function loadTaskMetrics(chadgiDir) {
    const metricsFile = join(chadgiDir, 'chadgi-metrics.json');
    if (!existsSync(metricsFile)) {
        return [];
    }
    const content = readFileSync(metricsFile, 'utf-8');
    const parseResult = safeParseJson(content, {
        filePath: metricsFile,
    });
    if (!parseResult.success) {
        return [];
    }
    // Validate the container
    const containerValidation = validateSchema(parseResult.data, METRICS_DATA_SCHEMA, {
        recover: true,
        filePath: metricsFile,
    });
    if (!containerValidation.valid || !containerValidation.data) {
        return [];
    }
    const tasks = containerValidation.data.tasks || [];
    // Validate each task against the schema
    const validation = validateArray(tasks, TASK_METRICS_SCHEMA, {
        recover: true,
        filePath: metricsFile,
    });
    return validation.data;
}
/**
 * Load the full metrics data structure with schema validation.
 *
 * The metrics data container is validated against METRICS_DATA_SCHEMA.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns The validated metrics data or null
 */
export function loadMetricsData(chadgiDir) {
    const metricsFile = join(chadgiDir, 'chadgi-metrics.json');
    if (!existsSync(metricsFile)) {
        return null;
    }
    const content = readFileSync(metricsFile, 'utf-8');
    const parseResult = safeParseJson(content, {
        filePath: metricsFile,
    });
    if (!parseResult.success) {
        return null;
    }
    const validation = validateSchema(parseResult.data, METRICS_DATA_SCHEMA, {
        recover: true,
        filePath: metricsFile,
    });
    return validation.valid ? validation.data ?? null : null;
}
/**
 * Get failed tasks from metrics
 *
 * @param metrics - Array of task metrics
 * @returns Array of failed task metrics
 */
export function getFailedTaskMetrics(metrics) {
    return metrics.filter((m) => m.status === 'failed');
}
/**
 * Get completed tasks from metrics
 *
 * @param metrics - Array of task metrics
 * @returns Array of completed task metrics
 */
export function getCompletedTaskMetrics(metrics) {
    return metrics.filter((m) => m.status === 'completed');
}
// ============================================================================
// Progress File
// ============================================================================
/**
 * Load progress data from chadgi-progress.json with schema validation.
 *
 * The progress data is validated against PROGRESS_DATA_SCHEMA to ensure:
 * - Required fields like status and last_updated are present
 * - Numeric fields in session/iteration are within bounds
 * - Status is a valid enum value
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Validated progress data or null if file doesn't exist
 */
export function loadProgressData(chadgiDir) {
    const progressFile = join(chadgiDir, 'chadgi-progress.json');
    if (!existsSync(progressFile)) {
        return null;
    }
    const content = readFileSync(progressFile, 'utf-8');
    const parseResult = safeParseJson(content, {
        filePath: progressFile,
    });
    if (!parseResult.success) {
        return null;
    }
    const validation = validateSchema(parseResult.data, PROGRESS_DATA_SCHEMA, {
        recover: true,
        filePath: progressFile,
    });
    return validation.valid ? validation.data ?? null : null;
}
// ============================================================================
// Lock Files
// ============================================================================
/**
 * Load pause lock data with schema validation.
 *
 * The pause lock is validated against PAUSE_LOCK_DATA_SCHEMA to ensure:
 * - Required paused_at timestamp is present and valid
 * - Optional resume_at is a valid timestamp if present
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Validated pause lock data or null if not paused
 */
export function loadPauseLock(chadgiDir) {
    const pauseLockFile = join(chadgiDir, 'pause.lock');
    if (!existsSync(pauseLockFile)) {
        return null;
    }
    const content = readFileSync(pauseLockFile, 'utf-8');
    const parseResult = safeParseJson(content, {
        filePath: pauseLockFile,
    });
    if (!parseResult.success) {
        return null;
    }
    const validation = validateSchema(parseResult.data, PAUSE_LOCK_DATA_SCHEMA, {
        recover: true,
        filePath: pauseLockFile,
    });
    return validation.valid ? validation.data ?? null : null;
}
/**
 * Check if ChadGI is currently paused
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns true if paused
 */
export function isPaused(chadgiDir) {
    const pauseLockFile = join(chadgiDir, 'pause.lock');
    return existsSync(pauseLockFile);
}
/**
 * Find pending approval lock files with schema validation.
 *
 * Each approval lock is validated against APPROVAL_LOCK_DATA_SCHEMA.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns First validated pending approval or null
 */
export function findPendingApproval(chadgiDir) {
    try {
        const files = readdirSync(chadgiDir).filter((f) => f.startsWith('approval-') && f.endsWith('.lock'));
        for (const file of files) {
            const filePath = join(chadgiDir, file);
            const content = readFileSync(filePath, 'utf-8');
            const parseResult = safeParseJson(content, {
                filePath,
            });
            if (!parseResult.success) {
                continue;
            }
            const validation = validateSchema(parseResult.data, APPROVAL_LOCK_DATA_SCHEMA, {
                recover: true,
                filePath,
            });
            if (validation.valid && validation.data?.status === 'pending') {
                return validation.data;
            }
        }
    }
    catch (e) {
        // Directory read may fail if .chadgi doesn't exist or has permission issues
        logSilentError(e, 'reading approval lock directory', ErrorCategory.EXPECTED);
    }
    return null;
}
/**
 * List all approval lock files with schema validation.
 *
 * Each approval lock is validated against APPROVAL_LOCK_DATA_SCHEMA.
 * Invalid locks are filtered out.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of validated approval lock data
 */
export function listApprovalLocks(chadgiDir) {
    const approvals = [];
    try {
        const files = readdirSync(chadgiDir).filter((f) => f.startsWith('approval-') && f.endsWith('.lock'));
        for (const file of files) {
            const filePath = join(chadgiDir, file);
            const content = readFileSync(filePath, 'utf-8');
            const parseResult = safeParseJson(content, {
                filePath,
            });
            if (!parseResult.success) {
                continue;
            }
            const validation = validateSchema(parseResult.data, APPROVAL_LOCK_DATA_SCHEMA, {
                recover: true,
                filePath,
            });
            if (validation.valid && validation.data) {
                approvals.push(validation.data);
            }
        }
    }
    catch (e) {
        // Directory read may fail if .chadgi doesn't exist or has permission issues
        logSilentError(e, 'listing approval lock files', ErrorCategory.EXPECTED);
    }
    return approvals;
}
// ============================================================================
// Task Locks
// ============================================================================
/**
 * Load a specific task lock
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @returns Task lock data or null if no lock exists
 */
export function loadTaskLock(chadgiDir, issueNumber) {
    return readTaskLock(chadgiDir, issueNumber);
}
/**
 * Get all current task locks with status information
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout for staleness determination
 * @returns Array of task lock info objects
 */
export function loadAllTaskLocks(chadgiDir, timeoutMinutes = DEFAULT_LOCK_TIMEOUT_MINUTES) {
    return listTaskLocks(chadgiDir, timeoutMinutes);
}
/**
 * Get all stale task locks
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout in minutes for staleness
 * @returns Array of stale task lock info objects
 */
export function loadStaleLocks(chadgiDir, timeoutMinutes = DEFAULT_LOCK_TIMEOUT_MINUTES) {
    return findStaleLocks(chadgiDir, timeoutMinutes);
}
/**
 * Check if a task lock is stale
 *
 * @param lock - The task lock data
 * @param timeoutMinutes - Timeout in minutes
 * @returns true if the lock is stale
 */
export function isTaskLockStale(lock, timeoutMinutes = DEFAULT_LOCK_TIMEOUT_MINUTES) {
    return isLockStale(lock, timeoutMinutes);
}
// ============================================================================
// JSON File Helpers
// ============================================================================
/**
 * Safely load and parse a JSON file
 *
 * @param filePath - Path to the JSON file
 * @returns Parsed JSON or null on error
 */
export function loadJsonFile(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }
    const content = readFileSync(filePath, 'utf-8');
    const result = safeParseJson(content, {
        filePath,
    });
    return result.success ? result.data : null;
}
/**
 * Check if a file exists
 *
 * @param filePath - Path to check
 * @returns true if file exists
 */
export function fileExists(filePath) {
    return existsSync(filePath);
}
/**
 * Read a file as text
 *
 * @param filePath - Path to the file
 * @returns File contents or null on error
 */
export function readTextFile(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }
    try {
        return readFileSync(filePath, 'utf-8');
    }
    catch (e) {
        // File read failure is expected when file doesn't exist or is inaccessible
        logSilentError(e, `reading text file: ${filePath}`, ErrorCategory.EXPECTED);
        return null;
    }
}
//# sourceMappingURL=data.js.map