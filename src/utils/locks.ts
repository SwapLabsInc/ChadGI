/**
 * Task lock utilities for ChadGI.
 *
 * Provides functions for managing task-level locks to prevent concurrent
 * processing of the same issue by multiple sessions. Uses atomic file
 * operations for crash-safe lock management.
 */

import { existsSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { hostname } from 'os';
import { atomicWriteJson, safeParseJson } from './fileOps.js';
import { TASK_LOCK_DATA_SCHEMA, validateSchema } from './data-schema.js';
import type {
  TaskLockData,
  TaskLockResult,
  TaskLockOptions,
  TaskLockInfo,
} from '../types/index.js';

/** Default lock timeout in minutes (2 hours) */
export const DEFAULT_LOCK_TIMEOUT_MINUTES = 120;

/** Heartbeat interval in milliseconds (30 seconds) */
export const HEARTBEAT_INTERVAL_MS = 30 * 1000;

/** Name of the locks directory within .chadgi */
export const LOCKS_DIRECTORY = 'locks';

/**
 * Generate a unique session ID for this process
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${hostname()}-${process.pid}-${timestamp}-${random}`;
}

/**
 * Get the path to the locks directory
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Path to the locks directory
 */
export function getLocksDir(chadgiDir: string): string {
  return join(chadgiDir, LOCKS_DIRECTORY);
}

/**
 * Get the lock file path for a specific issue
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @returns Path to the lock file
 */
export function getLockFilePath(chadgiDir: string, issueNumber: number): string {
  return join(getLocksDir(chadgiDir), `issue-${issueNumber}.lock`);
}

/**
 * Ensure the locks directory exists
 *
 * @param chadgiDir - Path to the .chadgi directory
 */
export function ensureLocksDir(chadgiDir: string): void {
  const locksDir = getLocksDir(chadgiDir);
  if (!existsSync(locksDir)) {
    mkdirSync(locksDir, { recursive: true });
  }
}

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
export function readTaskLock(chadgiDir: string, issueNumber: number): TaskLockData | null {
  const lockPath = getLockFilePath(chadgiDir, issueNumber);
  if (!existsSync(lockPath)) {
    return null;
  }

  const content = readFileSync(lockPath, 'utf-8');
  const parseResult = safeParseJson<TaskLockData>(content, {
    filePath: lockPath,
  });

  if (!parseResult.success) {
    return null;
  }

  const validation = validateSchema<TaskLockData>(parseResult.data, TASK_LOCK_DATA_SCHEMA, {
    recover: false, // Lock data is critical - don't recover with defaults
    filePath: lockPath,
  });

  return validation.valid ? validation.data ?? null : null;
}

/**
 * Check if a lock is stale based on the last heartbeat time
 *
 * @param lock - The lock data
 * @param timeoutMinutes - Timeout in minutes (default: DEFAULT_LOCK_TIMEOUT_MINUTES)
 * @returns true if the lock is stale
 */
export function isLockStale(lock: TaskLockData, timeoutMinutes: number = DEFAULT_LOCK_TIMEOUT_MINUTES): boolean {
  const heartbeatTime = new Date(lock.last_heartbeat).getTime();
  const now = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;
  return (now - heartbeatTime) > timeoutMs;
}

/**
 * Check if a process is still running
 *
 * @param pid - Process ID to check
 * @returns true if the process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Sending signal 0 doesn't actually send a signal,
    // but will throw if the process doesn't exist
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Attempt to acquire a task lock
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to lock
 * @param sessionId - Unique session identifier
 * @param options - Lock acquisition options
 * @returns Result of the lock acquisition attempt
 */
export function acquireTaskLock(
  chadgiDir: string,
  issueNumber: number,
  sessionId: string,
  options: TaskLockOptions = {}
): TaskLockResult {
  const { forceClaim = false, timeoutMinutes = DEFAULT_LOCK_TIMEOUT_MINUTES, workerId, repoName } = options;

  try {
    ensureLocksDir(chadgiDir);

    // Check for existing lock
    const existingLock = readTaskLock(chadgiDir, issueNumber);

    if (existingLock) {
      // Check if the lock is owned by this session
      if (existingLock.session_id === sessionId) {
        // This session already owns the lock - refresh the heartbeat
        const updatedLock: TaskLockData = {
          ...existingLock,
          last_heartbeat: new Date().toISOString(),
        };
        atomicWriteJson(getLockFilePath(chadgiDir, issueNumber), updatedLock);
        return { acquired: true, lock: updatedLock };
      }

      // Check if the lock is stale
      const stale = isLockStale(existingLock, timeoutMinutes);

      // Check if the process is still running (only reliable on same machine)
      const localLock = existingLock.hostname === hostname();
      const processGone = localLock && !isProcessRunning(existingLock.pid);

      if (forceClaim && (stale || processGone)) {
        // Force claim a stale lock - remove it and acquire a new one
        unlinkSync(getLockFilePath(chadgiDir, issueNumber));
      } else if (stale || processGone) {
        // Lock is stale but force claim not requested
        return {
          acquired: false,
          lock: existingLock,
          reason: 'stale_lock',
          error: `Lock is stale (last heartbeat: ${existingLock.last_heartbeat}). Use --force-claim to override.`,
        };
      } else {
        // Lock is held by another active session
        return {
          acquired: false,
          lock: existingLock,
          reason: 'already_locked',
          error: `Issue #${issueNumber} is locked by session ${existingLock.session_id} on ${existingLock.hostname}`,
        };
      }
    }

    // Create new lock
    const now = new Date().toISOString();
    const newLock: TaskLockData = {
      issue_number: issueNumber,
      session_id: sessionId,
      pid: process.pid,
      hostname: hostname(),
      locked_at: now,
      last_heartbeat: now,
      ...(workerId !== undefined && { worker_id: workerId }),
      ...(repoName && { repo_name: repoName }),
    };

    atomicWriteJson(getLockFilePath(chadgiDir, issueNumber), newLock);

    return { acquired: true, lock: newLock };
  } catch (error) {
    return {
      acquired: false,
      reason: 'error',
      error: `Failed to acquire lock: ${(error as Error).message}`,
    };
  }
}

/**
 * Release a task lock
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to unlock
 * @param sessionId - The session ID that owns the lock (for verification)
 * @returns true if the lock was released
 */
export function releaseTaskLock(
  chadgiDir: string,
  issueNumber: number,
  sessionId?: string
): boolean {
  const lockPath = getLockFilePath(chadgiDir, issueNumber);

  if (!existsSync(lockPath)) {
    return true; // No lock to release
  }

  // If sessionId provided, verify ownership
  if (sessionId) {
    const existingLock = readTaskLock(chadgiDir, issueNumber);
    if (existingLock && existingLock.session_id !== sessionId) {
      return false; // Not the owner
    }
  }

  try {
    unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Force release a task lock (ignores ownership)
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to unlock
 * @returns true if the lock was released
 */
export function forceReleaseTaskLock(chadgiDir: string, issueNumber: number): boolean {
  const lockPath = getLockFilePath(chadgiDir, issueNumber);

  if (!existsSync(lockPath)) {
    return true; // No lock to release
  }

  try {
    unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Update the heartbeat for a held lock
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @param sessionId - The session ID that owns the lock
 * @returns true if the heartbeat was updated
 */
export function updateLockHeartbeat(
  chadgiDir: string,
  issueNumber: number,
  sessionId: string
): boolean {
  const existingLock = readTaskLock(chadgiDir, issueNumber);

  if (!existingLock || existingLock.session_id !== sessionId) {
    return false; // Not the owner or no lock
  }

  try {
    const updatedLock: TaskLockData = {
      ...existingLock,
      last_heartbeat: new Date().toISOString(),
    };
    atomicWriteJson(getLockFilePath(chadgiDir, issueNumber), updatedLock);
    return true;
  } catch {
    return false;
  }
}

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
export function listTaskLocks(
  chadgiDir: string,
  timeoutMinutes: number = DEFAULT_LOCK_TIMEOUT_MINUTES
): TaskLockInfo[] {
  const locksDir = getLocksDir(chadgiDir);

  if (!existsSync(locksDir)) {
    return [];
  }

  const locks: TaskLockInfo[] = [];

  try {
    const files = readdirSync(locksDir).filter(
      (f) => f.startsWith('issue-') && f.endsWith('.lock')
    );

    const now = Date.now();

    for (const file of files) {
      const filePath = join(locksDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const parseResult = safeParseJson<TaskLockData>(content, {
        filePath,
      });

      if (!parseResult.success) {
        continue;
      }

      const validation = validateSchema<TaskLockData>(parseResult.data, TASK_LOCK_DATA_SCHEMA, {
        recover: false, // Lock data is critical - don't recover with defaults
        filePath,
      });

      if (validation.valid && validation.data) {
        const lock = validation.data;
        const lockedAt = new Date(lock.locked_at).getTime();
        const heartbeatAt = new Date(lock.last_heartbeat).getTime();

        locks.push({
          issueNumber: lock.issue_number,
          sessionId: lock.session_id,
          pid: lock.pid,
          hostname: lock.hostname,
          lockedAt: lock.locked_at,
          lockedSeconds: Math.floor((now - lockedAt) / 1000),
          heartbeatAgeSeconds: Math.floor((now - heartbeatAt) / 1000),
          isStale: isLockStale(lock, timeoutMinutes),
          workerId: lock.worker_id,
          repoName: lock.repo_name,
        });
      }
    }
  } catch {
    // Directory read error
  }

  return locks;
}

/**
 * Find stale locks
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout in minutes for staleness
 * @returns Array of stale lock info objects
 */
export function findStaleLocks(
  chadgiDir: string,
  timeoutMinutes: number = DEFAULT_LOCK_TIMEOUT_MINUTES
): TaskLockInfo[] {
  return listTaskLocks(chadgiDir, timeoutMinutes).filter((lock) => lock.isStale);
}

/**
 * Clean up stale locks
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param timeoutMinutes - Timeout in minutes for staleness
 * @returns Number of stale locks removed
 */
export function cleanupStaleLocks(
  chadgiDir: string,
  timeoutMinutes: number = DEFAULT_LOCK_TIMEOUT_MINUTES
): number {
  const staleLocks = findStaleLocks(chadgiDir, timeoutMinutes);
  let removedCount = 0;

  for (const lock of staleLocks) {
    if (forceReleaseTaskLock(chadgiDir, lock.issueNumber)) {
      removedCount++;
    }
  }

  return removedCount;
}

/**
 * Check if an issue is locked
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to check
 * @returns true if the issue is locked
 */
export function isIssueLocked(chadgiDir: string, issueNumber: number): boolean {
  return readTaskLock(chadgiDir, issueNumber) !== null;
}

/**
 * Check if an issue is locked by another session
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number to check
 * @param currentSessionId - The current session ID
 * @param timeoutMinutes - Timeout for staleness check
 * @returns true if locked by another active (non-stale) session
 */
export function isLockedByOther(
  chadgiDir: string,
  issueNumber: number,
  currentSessionId: string,
  timeoutMinutes: number = DEFAULT_LOCK_TIMEOUT_MINUTES
): boolean {
  const lock = readTaskLock(chadgiDir, issueNumber);

  if (!lock) {
    return false;
  }

  // Same session owns the lock
  if (lock.session_id === currentSessionId) {
    return false;
  }

  // Check if lock is stale
  if (isLockStale(lock, timeoutMinutes)) {
    return false; // Stale locks don't count as blocking
  }

  // Check if process is gone (local only)
  if (lock.hostname === hostname() && !isProcessRunning(lock.pid)) {
    return false;
  }

  return true;
}

/**
 * Start a heartbeat timer for a locked task
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param issueNumber - The issue number
 * @param sessionId - The session ID
 * @returns Timer reference (use clearInterval to stop)
 */
export function startHeartbeat(
  chadgiDir: string,
  issueNumber: number,
  sessionId: string
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    updateLockHeartbeat(chadgiDir, issueNumber, sessionId);
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Release all locks held by a specific session
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param sessionId - The session ID
 * @returns Number of locks released
 */
export function releaseAllSessionLocks(chadgiDir: string, sessionId: string): number {
  const locks = listTaskLocks(chadgiDir);
  let releasedCount = 0;

  for (const lock of locks) {
    if (lock.sessionId === sessionId) {
      if (forceReleaseTaskLock(chadgiDir, lock.issueNumber)) {
        releasedCount++;
      }
    }
  }

  return releasedCount;
}
