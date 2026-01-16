/**
 * Data loading utilities for ChadGI.
 *
 * Provides functions for loading and parsing common data files like
 * session stats, metrics, and progress files.
 */
import type { SessionStats, TaskMetrics, MetricsData, ProgressData, PauseLockData, ApprovalLockData, TaskLockData, TaskLockInfo } from '../types/index.js';
/**
 * Load session stats from chadgi-stats.json
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of session stats or empty array if file doesn't exist
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
 * Load task metrics from chadgi-metrics.json
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of task metrics or empty array if file doesn't exist
 */
export declare function loadTaskMetrics(chadgiDir: string): TaskMetrics[];
/**
 * Load the full metrics data structure
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns The full metrics data or null
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
 * Load progress data from chadgi-progress.json
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Progress data or null if file doesn't exist
 */
export declare function loadProgressData(chadgiDir: string): ProgressData | null;
/**
 * Load pause lock data
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Pause lock data or null if not paused
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
 * Find pending approval lock files
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns First pending approval or null
 */
export declare function findPendingApproval(chadgiDir: string): ApprovalLockData | null;
/**
 * List all approval lock files
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of approval lock data
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