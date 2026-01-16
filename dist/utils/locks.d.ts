/**
 * Task lock utilities for ChadGI.
 *
 * Provides functions for managing task-level locks to prevent concurrent
 * processing of the same issue by multiple sessions. Uses atomic file
 * operations for crash-safe lock management.
 */
import type { TaskLockData, TaskLockResult, TaskLockOptions, TaskLockInfo } from '../types/index.js';
/** Default lock timeout in minutes (2 hours) */
export declare const DEFAULT_LOCK_TIMEOUT_MINUTES = 120;
/** Heartbeat interval in milliseconds (30 seconds) */
export declare const HEARTBEAT_INTERVAL_MS: number;
/** Name of the locks directory within .chadgi */
export declare const LOCKS_DIRECTORY = "locks";
/**
 * Generate a unique session ID for this process
 */
export declare function generateSessionId(): string;
/**
 * Get the path to the locks directory
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Path to the locks directory
 */
export declare function getLocksDir(chadgiDir: string): string;
/**
 * Get the lock file path for a specific issue
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @returns Path to the lock file
 */
export declare function getLockFilePath(chadgiDir: string, issueNumber: number): string;
/**
 * Ensure the locks directory exists
 *
 * @param chadgiDir - Path to the .chadgi directory
 */
export declare function ensureLocksDir(chadgiDir: string): void;
/**
 * Read a task lock file with schema validation.
 *
 * The lock data is validated against TASK_LOCK_DATA_SCHEMA to ensure:
 * - All required fields (issue_number, session_id, pid, etc.) are present
 * - Numeric fields are positive integers
 * - Timestamps are in valid ISO format
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @returns Validated lock data or null if no lock exists or validation fails
 */
export declare function readTaskLock(chadgiDir: string, issueNumber: number): TaskLockData | null;
/**
 * Check if a lock is stale based on the last heartbeat time
 *
 * @param lock - The lock data
 * @param timeoutMinutes - Timeout in minutes (default: DEFAULT_LOCK_TIMEOUT_MINUTES)
 * @returns true if the lock is stale
 */
export declare function isLockStale(lock: TaskLockData, timeoutMinutes?: number): boolean;
/**
 * Check if a process is still running
 *
 * @param pid - Process ID to check
 * @returns true if the process is running
 */
export declare function isProcessRunning(pid: number): boolean;
/**
 * Attempt to acquire a task lock
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to lock
 * @param sessionId - Unique session identifier
 * @param options - Lock acquisition options
 * @returns Result of the lock acquisition attempt
 */
export declare function acquireTaskLock(chadgiDir: string, issueNumber: number, sessionId: string, options?: TaskLockOptions): TaskLockResult;
/**
 * Release a task lock
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to unlock
 * @param sessionId - The session ID that owns the lock (for verification)
 * @returns true if the lock was released
 */
export declare function releaseTaskLock(chadgiDir: string, issueNumber: number, sessionId?: string): boolean;
/**
 * Force release a task lock (ignores ownership)
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to unlock
 * @returns true if the lock was released
 */
export declare function forceReleaseTaskLock(chadgiDir: string, issueNumber: number): boolean;
/**
 * Update the heartbeat for a held lock
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @param sessionId - The session ID that owns the lock
 * @returns true if the heartbeat was updated
 */
export declare function updateLockHeartbeat(chadgiDir: string, issueNumber: number, sessionId: string): boolean;
/**
 * List all current task locks with schema validation.
 *
 * Each lock file is validated against TASK_LOCK_DATA_SCHEMA.
 * Invalid locks are filtered out.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout for determining staleness
 * @returns Array of validated lock info objects
 */
export declare function listTaskLocks(chadgiDir: string, timeoutMinutes?: number): TaskLockInfo[];
/**
 * Find stale locks
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout in minutes for staleness
 * @returns Array of stale lock info objects
 */
export declare function findStaleLocks(chadgiDir: string, timeoutMinutes?: number): TaskLockInfo[];
/**
 * Clean up stale locks
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout in minutes for staleness
 * @returns Number of stale locks removed
 */
export declare function cleanupStaleLocks(chadgiDir: string, timeoutMinutes?: number): number;
/**
 * Check if an issue is locked
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to check
 * @returns true if the issue is locked
 */
export declare function isIssueLocked(chadgiDir: string, issueNumber: number): boolean;
/**
 * Check if an issue is locked by another session
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to check
 * @param currentSessionId - The current session ID
 * @param timeoutMinutes - Timeout for staleness check
 * @returns true if locked by another active (non-stale) session
 */
export declare function isLockedByOther(chadgiDir: string, issueNumber: number, currentSessionId: string, timeoutMinutes?: number): boolean;
/**
 * Start a heartbeat timer for a locked task
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @param sessionId - The session ID
 * @returns Timer reference (use clearInterval to stop)
 */
export declare function startHeartbeat(chadgiDir: string, issueNumber: number, sessionId: string): ReturnType<typeof setInterval>;
/**
 * Release all locks held by a specific session
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param sessionId - The session ID
 * @returns Number of locks released
 */
export declare function releaseAllSessionLocks(chadgiDir: string, sessionId: string): number;
//# sourceMappingURL=locks.d.ts.map