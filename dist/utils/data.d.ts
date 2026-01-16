/**
 * Data loading utilities for ChadGI.
 *
 * Provides functions for loading and parsing common data files like
 * session stats, metrics, and progress files.
 */
import type { SessionStats, TaskMetrics, MetricsData, ProgressData, PauseLockData, ApprovalLockData, TaskLockData, TaskLockInfo } from '../types/index.js';
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
export declare function loadSessionStats(chadgiDir: string): SessionStats[];
/**
 * Get the most recent session from stats
 *
 * @param sessions - Array of session stats
 * @returns The most recent session or null
 */
export declare function getMostRecentSession(sessions: SessionStats[]): SessionStats | null;
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
export declare function loadTaskMetrics(chadgiDir: string): TaskMetrics[];
/**
 * Load the full metrics data structure with schema validation.
 *
 * The metrics data container is validated against METRICS_DATA_SCHEMA.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns The validated metrics data or null
 */
export declare function loadMetricsData(chadgiDir: string): MetricsData | null;
/**
 * Get failed tasks from metrics
 *
 * @param metrics - Array of task metrics
 * @returns Array of failed task metrics
 */
export declare function getFailedTaskMetrics(metrics: TaskMetrics[]): TaskMetrics[];
/**
 * Get completed tasks from metrics
 *
 * @param metrics - Array of task metrics
 * @returns Array of completed task metrics
 */
export declare function getCompletedTaskMetrics(metrics: TaskMetrics[]): TaskMetrics[];
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
export declare function loadProgressData(chadgiDir: string): ProgressData | null;
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
export declare function loadPauseLock(chadgiDir: string): PauseLockData | null;
/**
 * Check if ChadGI is currently paused
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns true if paused
 */
export declare function isPaused(chadgiDir: string): boolean;
/**
 * Find pending approval lock files with schema validation.
 *
 * Each approval lock is validated against APPROVAL_LOCK_DATA_SCHEMA.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns First validated pending approval or null
 */
export declare function findPendingApproval(chadgiDir: string): ApprovalLockData | null;
/**
 * List all approval lock files with schema validation.
 *
 * Each approval lock is validated against APPROVAL_LOCK_DATA_SCHEMA.
 * Invalid locks are filtered out.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of validated approval lock data
 */
export declare function listApprovalLocks(chadgiDir: string): ApprovalLockData[];
/**
 * Load a specific task lock
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @returns Task lock data or null if no lock exists
 */
export declare function loadTaskLock(chadgiDir: string, issueNumber: number): TaskLockData | null;
/**
 * Get all current task locks with status information
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout for staleness determination
 * @returns Array of task lock info objects
 */
export declare function loadAllTaskLocks(chadgiDir: string, timeoutMinutes?: number): TaskLockInfo[];
/**
 * Get all stale task locks
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout in minutes for staleness
 * @returns Array of stale task lock info objects
 */
export declare function loadStaleLocks(chadgiDir: string, timeoutMinutes?: number): TaskLockInfo[];
/**
 * Check if a task lock is stale
 *
 * @param lock - The task lock data
 * @param timeoutMinutes - Timeout in minutes
 * @returns true if the lock is stale
 */
export declare function isTaskLockStale(lock: TaskLockData, timeoutMinutes?: number): boolean;
/**
 * Safely load and parse a JSON file
 *
 * @param filePath - Path to the JSON file
 * @returns Parsed JSON or null on error
 */
export declare function loadJsonFile<T>(filePath: string): T | null;
/**
 * Check if a file exists
 *
 * @param filePath - Path to check
 * @returns true if file exists
 */
export declare function fileExists(filePath: string): boolean;
/**
 * Read a file as text
 *
 * @param filePath - Path to the file
 * @returns File contents or null on error
 */
export declare function readTextFile(filePath: string): string | null;
//# sourceMappingURL=data.d.ts.map