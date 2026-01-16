/**
 * Data loading utilities for ChadGI.
 *
 * Provides functions for loading and parsing common data files like
 * session stats, metrics, and progress files.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  SessionStats,
  TaskMetrics,
  MetricsData,
  ProgressData,
  PauseLockData,
  ApprovalLockData,
} from '../types/index.js';

// ============================================================================
// Session Stats
// ============================================================================

/**
 * Load session stats from chadgi-stats.json
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of session stats or empty array if file doesn't exist
 */
export function loadSessionStats(chadgiDir: string): SessionStats[] {
  const statsFile = join(chadgiDir, 'chadgi-stats.json');
  if (!existsSync(statsFile)) {
    return [];
  }

  try {
    const content = readFileSync(statsFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Get the most recent session from stats
 *
 * @param sessions - Array of session stats
 * @returns The most recent session or null
 */
export function getMostRecentSession(sessions: SessionStats[]): SessionStats | null {
  if (sessions.length === 0) return null;
  return sessions.sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  )[0];
}

// ============================================================================
// Task Metrics
// ============================================================================

/**
 * Load task metrics from chadgi-metrics.json
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of task metrics or empty array if file doesn't exist
 */
export function loadTaskMetrics(chadgiDir: string): TaskMetrics[] {
  const metricsFile = join(chadgiDir, 'chadgi-metrics.json');
  if (!existsSync(metricsFile)) {
    return [];
  }

  try {
    const content = readFileSync(metricsFile, 'utf-8');
    const data: MetricsData = JSON.parse(content);
    return data.tasks || [];
  } catch {
    return [];
  }
}

/**
 * Load the full metrics data structure
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns The full metrics data or null
 */
export function loadMetricsData(chadgiDir: string): MetricsData | null {
  const metricsFile = join(chadgiDir, 'chadgi-metrics.json');
  if (!existsSync(metricsFile)) {
    return null;
  }

  try {
    const content = readFileSync(metricsFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get failed tasks from metrics
 *
 * @param metrics - Array of task metrics
 * @returns Array of failed task metrics
 */
export function getFailedTaskMetrics(metrics: TaskMetrics[]): TaskMetrics[] {
  return metrics.filter((m) => m.status === 'failed');
}

/**
 * Get completed tasks from metrics
 *
 * @param metrics - Array of task metrics
 * @returns Array of completed task metrics
 */
export function getCompletedTaskMetrics(metrics: TaskMetrics[]): TaskMetrics[] {
  return metrics.filter((m) => m.status === 'completed');
}

// ============================================================================
// Progress File
// ============================================================================

/**
 * Load progress data from chadgi-progress.json
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Progress data or null if file doesn't exist
 */
export function loadProgressData(chadgiDir: string): ProgressData | null {
  const progressFile = join(chadgiDir, 'chadgi-progress.json');
  if (!existsSync(progressFile)) {
    return null;
  }

  try {
    const content = readFileSync(progressFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ============================================================================
// Lock Files
// ============================================================================

/**
 * Load pause lock data
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Pause lock data or null if not paused
 */
export function loadPauseLock(chadgiDir: string): PauseLockData | null {
  const pauseLockFile = join(chadgiDir, 'pause.lock');
  if (!existsSync(pauseLockFile)) {
    return null;
  }

  try {
    const content = readFileSync(pauseLockFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if ChadGI is currently paused
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns true if paused
 */
export function isPaused(chadgiDir: string): boolean {
  const pauseLockFile = join(chadgiDir, 'pause.lock');
  return existsSync(pauseLockFile);
}

/**
 * Find pending approval lock files
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns First pending approval or null
 */
export function findPendingApproval(chadgiDir: string): ApprovalLockData | null {
  try {
    const files = readdirSync(chadgiDir).filter(
      (f) => f.startsWith('approval-') && f.endsWith('.lock')
    );
    for (const file of files) {
      try {
        const data = JSON.parse(
          readFileSync(join(chadgiDir, file), 'utf-8')
        ) as ApprovalLockData;
        if (data.status === 'pending') {
          return data;
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory read error
  }
  return null;
}

/**
 * List all approval lock files
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns Array of approval lock data
 */
export function listApprovalLocks(chadgiDir: string): ApprovalLockData[] {
  const approvals: ApprovalLockData[] = [];
  try {
    const files = readdirSync(chadgiDir).filter(
      (f) => f.startsWith('approval-') && f.endsWith('.lock')
    );
    for (const file of files) {
      try {
        const data = JSON.parse(
          readFileSync(join(chadgiDir, file), 'utf-8')
        ) as ApprovalLockData;
        approvals.push(data);
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory read error
  }
  return approvals;
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
export function loadJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Check if a file exists
 *
 * @param filePath - Path to check
 * @returns true if file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Read a file as text
 *
 * @param filePath - Path to the file
 * @returns File contents or null on error
 */
export function readTextFile(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
