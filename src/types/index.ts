/**
 * Shared type definitions for ChadGI.
 *
 * This module contains common interfaces and types used across multiple command modules.
 */

// ============================================================================
// Task and Metrics Types
// ============================================================================

/**
 * Individual task result from a session
 */
export interface TaskResult {
  issue: number;
  duration_secs?: number;
  reason?: string;
}

/**
 * Session statistics from chadgi-stats.json
 */
export interface SessionStats {
  session_id: string;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  tasks_attempted: number;
  tasks_completed: number;
  successful_tasks: TaskResult[];
  failed_tasks: TaskResult[];
  total_cost_usd: number;
  gigachad_mode: boolean;
  gigachad_merges: number;
  repo: string;
}

/**
 * Phase-specific metrics for detailed task analysis
 */
export interface PhaseMetrics {
  phase1_time_secs?: number;
  phase2_time_secs?: number;
  verification_time_secs?: number;
}

/**
 * Token usage metrics
 */
export interface TokenMetrics {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

/**
 * Extended task metrics from chadgi-metrics.json
 */
export interface TaskMetrics {
  issue_number: number;
  started_at: string;
  completed_at?: string;
  duration_secs: number;
  status: 'completed' | 'failed';
  iterations: number;
  cost_usd: number;
  failure_reason?: string;
  failure_phase?: 'phase1' | 'phase2' | 'verification' | string;
  category?: string;
  retry_count?: number;
  phases?: PhaseMetrics;
  tokens?: TokenMetrics;
  error_recovery_time_secs?: number;
  files_modified?: number;
  lines_changed?: number;
}

/**
 * Container for task metrics JSON file
 */
export interface MetricsData {
  version: string;
  last_updated: string;
  retention_days: number;
  tasks: TaskMetrics[];
}

// ============================================================================
// History Types
// ============================================================================

/**
 * Unified history entry combining data from both session stats and metrics
 */
export interface HistoryEntry {
  issueNumber: number;
  issueTitle?: string;
  outcome: 'success' | 'skipped' | 'failed';
  elapsedTime: number;
  cost?: number;
  prUrl?: string;
  startedAt: string;
  completedAt?: string;
  failureReason?: string;
  category?: string;
  iterations?: number;
}

/**
 * History result for JSON output
 */
export interface HistoryResult {
  entries: HistoryEntry[];
  total: number;
  filtered: number;
  dateRange?: { since: string; until: string };
  statusFilter?: string;
}

// ============================================================================
// Progress and State Types
// ============================================================================

/**
 * Current task information in progress file
 */
export interface CurrentTask {
  id: string;
  title: string;
  branch: string;
  started_at: string;
}

/**
 * Session information in progress file
 */
export interface SessionProgress {
  started_at: string;
  tasks_completed: number;
  total_cost_usd: number;
}

/**
 * Progress file data structure (chadgi-progress.json)
 */
export interface ProgressData {
  status: 'idle' | 'in_progress' | 'paused' | 'stopped' | 'error' | 'awaiting_approval' | string;
  current_task?: CurrentTask;
  session?: SessionProgress;
  last_updated: string;
}

/**
 * Pause lock file data
 */
export interface PauseLockData {
  paused_at: string;
  reason?: string;
  resume_at?: string;
}

/**
 * Approval lock file data
 */
export interface ApprovalLockData {
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  issue_number: number;
  issue_title?: string;
  branch?: string;
  phase: 'pre_task' | 'phase1' | 'phase2';
  files_changed?: number;
  insertions?: number;
  deletions?: number;
}

// ============================================================================
// Queue Types
// ============================================================================

/**
 * Queue task from GitHub project board
 */
export interface QueueTask {
  number: number;
  title: string;
  url: string;
  itemId: string;
  category?: string;
  priority?: number;
  priorityName?: string;
  labels?: string[];
  dependencies?: number[];
  dependencyStatus?: 'resolved' | 'blocked';
  blockingIssues?: number[];
}

/**
 * Queue result for JSON output
 */
export interface QueueResult {
  readyColumn: string;
  taskCount: number;
  tasks: QueueTask[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * GitHub configuration section
 */
export interface GitHubConfig {
  repo: string;
  project_number: string;
  ready_column: string;
  in_progress_column: string;
  review_column: string;
  done_column?: string;
}

/**
 * Branch configuration section
 */
export interface BranchConfig {
  base: string;
  prefix: string;
}

/**
 * Budget configuration section
 */
export interface BudgetConfig {
  per_task_limit?: number;
  per_session_limit?: number;
  on_task_budget_exceeded?: 'skip' | 'fail' | 'warn';
  on_session_budget_exceeded?: 'stop' | 'warn';
  warning_threshold?: number;
}

/**
 * Iteration configuration section
 */
export interface IterationConfig {
  max_iterations: number;
  completion_promise: string;
  ready_promise: string;
  test_command?: string;
  build_command?: string;
  on_max_iterations?: 'skip' | 'fail';
  gigachad_mode?: boolean;
  gigachad_commit_prefix?: string;
}

/**
 * ChadGI configuration structure
 */
export interface ChadGIConfig {
  task_source?: string;
  prompt_template?: string;
  generate_template?: string;
  progress_file?: string;
  github: GitHubConfig;
  branch: BranchConfig;
  poll_interval?: number;
  consecutive_empty_threshold?: number;
  on_empty_queue?: 'generate' | 'wait' | 'exit';
  iteration: IterationConfig;
  budget?: BudgetConfig;
  output?: {
    show_tool_details?: boolean;
    show_cost?: boolean;
    truncate_length?: number;
  };
}

// ============================================================================
// Replay Types
// ============================================================================

/**
 * Failed task for display and replay
 */
export interface FailedTask {
  issueNumber: number;
  issueTitle?: string;
  failedAt: string;
  failureReason?: string;
  failurePhase?: string;
  iterations: number;
  cost: number;
  retryCount: number;
  branch?: string;
  hasBranch: boolean;
  hasLocalChanges: boolean;
}

/**
 * Replay result for JSON output
 */
export interface ReplayResult {
  success: boolean;
  action: 'replay' | 'list';
  tasks: FailedTask[];
  message: string;
  replayedTasks?: number[];
}

// ============================================================================
// Doctor/Health Check Types
// ============================================================================

/**
 * Health check result
 */
export interface HealthCheck {
  name: string;
  category: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fixable?: boolean;
  fixed?: boolean;
}

/**
 * Health report summary
 */
export interface HealthReport {
  timestamp: string;
  healthScore: number;
  checks: HealthCheck[];
  recommendations: string[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };
}

// ============================================================================
// Status Types
// ============================================================================

/**
 * Status information for display
 */
export interface StatusInfo {
  state: 'running' | 'paused' | 'stopped' | 'idle' | 'error' | 'awaiting_approval' | 'unknown';
  currentTask?: {
    id: string;
    title: string;
    branch: string;
    startedAt: string;
    elapsedSeconds: number;
  };
  session?: {
    startedAt: string;
    tasksCompleted: number;
    totalCostUsd: number;
    elapsedSeconds: number;
  };
  pause?: {
    pausedAt: string;
    reason?: string;
    resumeAt?: string;
    pausedSeconds: number;
  };
  blockedTasks?: {
    count: number;
    issues: string[];
  };
  pendingApproval?: {
    phase: string;
    issueNumber: number;
    issueTitle?: string;
    createdAt: string;
    filesChanged?: number;
    insertions?: number;
    deletions?: number;
    waitingSeconds: number;
  };
  lastUpdated?: string;
}

// ============================================================================
// Action Result Types
// ============================================================================

/**
 * Generic action result for queue operations
 */
export interface ActionResult {
  success: boolean;
  action: string;
  issueNumber?: number;
  message: string;
  targetColumn?: string;
}

// ============================================================================
// Rate Limit Types
// ============================================================================

/**
 * GitHub API rate limit data
 */
export interface RateLimitData {
  resources: {
    core: {
      limit: number;
      remaining: number;
      reset: number;
      used: number;
    };
    graphql: {
      limit: number;
      remaining: number;
      reset: number;
      used: number;
    };
  };
}
