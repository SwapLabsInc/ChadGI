/**
 * Test fixtures for session stats, metrics, and other data files.
 */

import type { SessionStats, TaskMetrics, MetricsData, ProgressData } from '../../types/index.js';

export const sampleSessionStats: SessionStats[] = [
  {
    session_id: 'session-001',
    started_at: '2026-01-10T10:00:00Z',
    ended_at: '2026-01-10T12:00:00Z',
    duration_secs: 7200,
    tasks_attempted: 3,
    tasks_completed: 2,
    successful_tasks: [
      { issue: 42, duration_secs: 1200 },
      { issue: 43, duration_secs: 1500 },
    ],
    failed_tasks: [{ issue: 44, duration_secs: 600, reason: 'Build failed' }],
    total_cost_usd: 0.5,
    gigachad_mode: false,
    gigachad_merges: 0,
    repo: 'SwapLabsInc/ChadGI',
  },
  {
    session_id: 'session-002',
    started_at: '2026-01-15T14:00:00Z',
    ended_at: '2026-01-15T16:30:00Z',
    duration_secs: 9000,
    tasks_attempted: 4,
    tasks_completed: 4,
    successful_tasks: [
      { issue: 45, duration_secs: 1800 },
      { issue: 46, duration_secs: 2000 },
      { issue: 47, duration_secs: 2200 },
      { issue: 48, duration_secs: 2100 },
    ],
    failed_tasks: [],
    total_cost_usd: 1.2,
    gigachad_mode: true,
    gigachad_merges: 4,
    repo: 'SwapLabsInc/ChadGI',
  },
];

export const sampleTaskMetrics: TaskMetrics[] = [
  {
    issue_number: 42,
    started_at: '2026-01-10T10:00:00Z',
    completed_at: '2026-01-10T10:20:00Z',
    duration_secs: 1200,
    status: 'completed',
    iterations: 1,
    cost_usd: 0.15,
    category: 'feature',
  },
  {
    issue_number: 43,
    started_at: '2026-01-10T10:30:00Z',
    completed_at: '2026-01-10T10:55:00Z',
    duration_secs: 1500,
    status: 'completed',
    iterations: 2,
    cost_usd: 0.2,
    category: 'bug',
  },
  {
    issue_number: 44,
    started_at: '2026-01-10T11:00:00Z',
    completed_at: '2026-01-10T11:10:00Z',
    duration_secs: 600,
    status: 'failed',
    iterations: 3,
    cost_usd: 0.1,
    failure_reason: 'Build failed',
    failure_phase: 'verification',
  },
  {
    issue_number: 50,
    started_at: '2026-01-15T10:00:00Z',
    completed_at: '2026-01-15T10:30:00Z',
    duration_secs: 1800,
    status: 'completed',
    iterations: 1,
    cost_usd: 0.25,
  },
];

export const sampleMetricsData: MetricsData = {
  version: '1.0',
  last_updated: '2026-01-15T16:30:00Z',
  retention_days: 30,
  tasks: sampleTaskMetrics,
};

export const sampleProgressData: ProgressData = {
  status: 'in_progress',
  current_task: {
    id: '51',
    title: 'Add user authentication',
    branch: 'feature/issue-51-add-user-authentication',
    started_at: '2026-01-15T17:00:00Z',
  },
  session: {
    started_at: '2026-01-15T16:30:00Z',
    tasks_completed: 2,
    total_cost_usd: 0.35,
  },
  last_updated: '2026-01-15T17:05:00Z',
};

export const sampleProgressDataIdle: ProgressData = {
  status: 'idle',
  last_updated: '2026-01-15T12:00:00Z',
};

export const sampleProgressDataPaused: ProgressData = {
  status: 'paused',
  current_task: {
    id: '52',
    title: 'Fix login timeout',
    branch: 'feature/issue-52-fix-login-timeout',
    started_at: '2026-01-15T14:00:00Z',
  },
  last_updated: '2026-01-15T14:30:00Z',
};

export const samplePauseLock = {
  paused_at: '2026-01-15T14:30:00Z',
  reason: 'User requested pause',
};

export const sampleApprovalLock = {
  status: 'pending' as const,
  created_at: '2026-01-15T15:00:00Z',
  issue_number: 53,
  issue_title: 'Add dark mode support',
  branch: 'feature/issue-53-add-dark-mode',
  phase: 'phase1' as const,
  files_changed: 5,
  insertions: 150,
  deletions: 20,
};
