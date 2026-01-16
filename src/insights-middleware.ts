/**
 * Insights command implementation using the middleware system.
 *
 * This is a refactored version of insights.ts that demonstrates the middleware
 * pattern for reducing boilerplate.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { colors } from './utils/colors.js';
import { formatDuration } from './utils/formatting.js';
import { logSilentError, ErrorCategory } from './utils/diagnostics.js';

// Import middleware utilities
import {
  withCommand,
  withDirectory,
  withDirectoryValidation,
  type DirectoryContext,
  type CommandResult,
} from './utils/index.js';

// Import shared types
import type {
  BaseCommandOptions,
  SessionStats,
  TaskMetrics,
  MetricsData,
} from './types/index.js';

/**
 * Insights command options.
 */
interface InsightsOptions extends BaseCommandOptions {
  export?: string;
  days?: number;
  category?: string;
}

/**
 * Category statistics for breakdown
 */
interface CategoryStats {
  tasks: number;
  completed: number;
  failed: number;
  successRate: number;
  avgDuration: number;
  totalCost: number;
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function calculateMedian(values: number[]): number {
  return calculatePercentile(values, 50);
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Generate ASCII histogram
 */
function generateHistogram(
  values: number[],
  bins: number = 5,
  width: number = 20
): string[] {
  if (values.length === 0) return ['No data'];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const binSize = range / bins;

  const histogram: number[] = new Array(bins).fill(0);
  for (const v of values) {
    const binIndex = Math.min(Math.floor((v - min) / binSize), bins - 1);
    histogram[binIndex]++;
  }

  const maxCount = Math.max(...histogram);
  const lines: string[] = [];

  for (let i = 0; i < bins; i++) {
    const rangeStart = min + i * binSize;
    const rangeEnd = min + (i + 1) * binSize;
    const barLength = maxCount > 0 ? Math.round((histogram[i] / maxCount) * width) : 0;
    const bar = '\u2588'.repeat(barLength);
    const label = `${formatDuration(rangeStart)}-${formatDuration(rangeEnd)}`;
    lines.push(`  ${label.padEnd(20)} ${bar} ${histogram[i]}`);
  }

  return lines;
}

/**
 * Load and merge data from both stats and metrics files
 */
function loadInsightsData(chadgiDir: string, days?: number): {
  sessions: SessionStats[];
  tasks: TaskMetrics[];
} {
  const statsFile = join(chadgiDir, 'chadgi-stats.json');
  const metricsFile = join(chadgiDir, 'chadgi-metrics.json');

  let sessions: SessionStats[] = [];
  let tasks: TaskMetrics[] = [];

  // Load session stats
  if (existsSync(statsFile)) {
    try {
      const content = readFileSync(statsFile, 'utf-8');
      sessions = JSON.parse(content);
    } catch (e) {
      // Stats file may be corrupted or in unexpected format - continue with empty data
      logSilentError(e, 'parsing session stats for insights', ErrorCategory.EXPECTED);
    }
  }

  // Load detailed metrics
  if (existsSync(metricsFile)) {
    try {
      const content = readFileSync(metricsFile, 'utf-8');
      const metricsData: MetricsData = JSON.parse(content);
      tasks = metricsData.tasks || [];
    } catch (e) {
      // Metrics file may be corrupted or in unexpected format - continue with empty data
      logSilentError(e, 'parsing task metrics for insights', ErrorCategory.EXPECTED);
    }
  }

  // Apply retention filter if specified
  if (days && days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    sessions = sessions.filter((s) => s.started_at >= cutoffStr);
    tasks = tasks.filter((t) => t.started_at >= cutoffStr);
  }

  return { sessions, tasks };
}

/**
 * Build task metrics from session stats when detailed metrics are not available
 */
function buildTaskMetricsFromSessions(sessions: SessionStats[]): TaskMetrics[] {
  const tasks: TaskMetrics[] = [];

  for (const session of sessions) {
    // Add successful tasks
    for (const task of session.successful_tasks || []) {
      tasks.push({
        issue_number: task.issue,
        started_at: session.started_at,
        duration_secs: task.duration_secs || 0,
        status: 'completed',
        iterations: 1, // Unknown from basic stats
        cost_usd: 0, // Unknown per-task
      });
    }

    // Add failed tasks
    for (const task of session.failed_tasks || []) {
      tasks.push({
        issue_number: task.issue,
        started_at: session.started_at,
        duration_secs: 0, // Unknown
        status: 'failed',
        iterations: 1,
        cost_usd: 0,
        failure_reason: task.reason,
      });
    }
  }

  return tasks;
}

interface AnalysisResults {
  // Overview
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;

  // Duration stats
  avgDuration: number;
  medianDuration: number;
  minDuration: number;
  maxDuration: number;
  stdDevDuration: number;
  p90Duration: number;
  durations: number[];

  // Cost stats
  totalCost: number;
  avgCostPerTask: number;
  avgCostPerSuccessfulTask: number;
  costs: number[];

  // Iteration stats
  avgIterations: number;
  totalIterations: number;
  iterationsDistribution: Record<number, number>;

  // Failure analysis
  failuresByReason: Record<string, number>;
  failuresByPhase: Record<string, number>;

  // Phase timing (if available)
  avgPhase1Duration: number;
  avgPhase2Duration: number;
  avgVerificationDuration: number;
  phaseBreakdown: {
    phase1Pct: number;
    phase2Pct: number;
    verificationPct: number;
  };

  // Complexity (if available)
  avgFilesModified: number;
  avgLinesChanged: number;

  // Sessions
  totalSessions: number;
  totalSessionDuration: number;
  avgSessionDuration: number;
  gigachadMerges: number;

  // Trends
  recentSuccessRate: number; // Last 10 tasks
  recentAvgDuration: number;

  // Category breakdown
  categoryBreakdown: Record<string, CategoryStats>;
}

function analyzeData(
  sessions: SessionStats[],
  tasks: TaskMetrics[]
): AnalysisResults {
  // Use tasks from metrics if available, otherwise derive from sessions
  const taskList = tasks.length > 0 ? tasks : buildTaskMetricsFromSessions(sessions);

  const completedTasks = taskList.filter((t) => t.status === 'completed');
  const failedTasks = taskList.filter((t) => t.status === 'failed');
  const durations = completedTasks.map((t) => t.duration_secs).filter((d) => d > 0);
  const costs = taskList.map((t) => t.cost_usd).filter((c) => c > 0);

  // Failure analysis
  const failuresByReason: Record<string, number> = {};
  const failuresByPhase: Record<string, number> = {};
  for (const task of failedTasks) {
    const reason = task.failure_reason || 'unknown';
    failuresByReason[reason] = (failuresByReason[reason] || 0) + 1;
    if (task.failure_phase) {
      failuresByPhase[task.failure_phase] = (failuresByPhase[task.failure_phase] || 0) + 1;
    }
  }

  // Iteration distribution
  const iterationsDistribution: Record<number, number> = {};
  for (const task of taskList) {
    const iter = task.iterations || 1;
    iterationsDistribution[iter] = (iterationsDistribution[iter] || 0) + 1;
  }

  // Phase timing
  const tasksWithPhases = tasks.filter((t) => t.phases);
  let avgPhase1 = 0, avgPhase2 = 0, avgVerification = 0;
  if (tasksWithPhases.length > 0) {
    avgPhase1 = tasksWithPhases.reduce((a, t) => a + (t.phases?.phase1_duration_secs || 0), 0) / tasksWithPhases.length;
    avgPhase2 = tasksWithPhases.reduce((a, t) => a + (t.phases?.phase2_duration_secs || 0), 0) / tasksWithPhases.length;
    avgVerification = tasksWithPhases.reduce((a, t) => a + (t.phases?.verification_duration_secs || 0), 0) / tasksWithPhases.length;
  }

  const totalPhaseTime = avgPhase1 + avgPhase2 + avgVerification;
  const phaseBreakdown = {
    phase1Pct: totalPhaseTime > 0 ? (avgPhase1 / totalPhaseTime) * 100 : 0,
    phase2Pct: totalPhaseTime > 0 ? (avgPhase2 / totalPhaseTime) * 100 : 0,
    verificationPct: totalPhaseTime > 0 ? (avgVerification / totalPhaseTime) * 100 : 0,
  };

  // Complexity
  const tasksWithComplexity = tasks.filter((t) => t.files_modified !== undefined);
  const avgFilesModified = tasksWithComplexity.length > 0
    ? tasksWithComplexity.reduce((a, t) => a + (t.files_modified || 0), 0) / tasksWithComplexity.length
    : 0;
  const avgLinesChanged = tasksWithComplexity.length > 0
    ? tasksWithComplexity.reduce((a, t) => a + (t.lines_changed || 0), 0) / tasksWithComplexity.length
    : 0;

  // Session stats
  const totalSessionDuration = sessions.reduce((a, s) => a + s.duration_secs, 0);
  const gigachadMerges = sessions.reduce((a, s) => a + (s.gigachad_merges || 0), 0);

  // Recent trends (last 10 tasks)
  const recentTasks = taskList.slice(-10);
  const recentCompleted = recentTasks.filter((t) => t.status === 'completed');
  const recentSuccessRate = recentTasks.length > 0
    ? (recentCompleted.length / recentTasks.length) * 100
    : 0;
  const recentDurations = recentCompleted.map((t) => t.duration_secs).filter((d) => d > 0);
  const recentAvgDuration = recentDurations.length > 0
    ? recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length
    : 0;

  // Total cost from sessions (more accurate)
  const totalCost = sessions.reduce((a, s) => a + (s.total_cost_usd || 0), 0);

  // Category breakdown
  const categoryBreakdown: Record<string, CategoryStats> = {};
  for (const task of taskList) {
    const cat = task.category || 'uncategorized';
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = {
        tasks: 0,
        completed: 0,
        failed: 0,
        successRate: 0,
        avgDuration: 0,
        totalCost: 0,
      };
    }
    categoryBreakdown[cat].tasks++;
    if (task.status === 'completed') {
      categoryBreakdown[cat].completed++;
    } else {
      categoryBreakdown[cat].failed++;
    }
    categoryBreakdown[cat].totalCost += task.cost_usd || 0;
  }

  // Calculate derived category stats
  for (const cat of Object.keys(categoryBreakdown)) {
    const stats = categoryBreakdown[cat];
    stats.successRate = stats.tasks > 0 ? (stats.completed / stats.tasks) * 100 : 0;

    // Calculate average duration for completed tasks in this category
    const catDurations = taskList
      .filter((t) => (t.category || 'uncategorized') === cat && t.status === 'completed' && t.duration_secs > 0)
      .map((t) => t.duration_secs);
    stats.avgDuration = catDurations.length > 0
      ? catDurations.reduce((a, b) => a + b, 0) / catDurations.length
      : 0;
  }

  return {
    totalTasks: taskList.length,
    completedTasks: completedTasks.length,
    failedTasks: failedTasks.length,
    successRate: taskList.length > 0 ? (completedTasks.length / taskList.length) * 100 : 0,

    avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    medianDuration: calculateMedian(durations),
    minDuration: durations.length > 0 ? Math.min(...durations) : 0,
    maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
    stdDevDuration: calculateStdDev(durations),
    p90Duration: calculatePercentile(durations, 90),
    durations,

    totalCost,
    avgCostPerTask: taskList.length > 0 ? totalCost / taskList.length : 0,
    avgCostPerSuccessfulTask: completedTasks.length > 0 ? totalCost / completedTasks.length : 0,
    costs,

    avgIterations: taskList.length > 0
      ? taskList.reduce((a, t) => a + (t.iterations || 1), 0) / taskList.length
      : 0,
    totalIterations: taskList.reduce((a, t) => a + (t.iterations || 1), 0),
    iterationsDistribution,

    failuresByReason,
    failuresByPhase,

    avgPhase1Duration: avgPhase1,
    avgPhase2Duration: avgPhase2,
    avgVerificationDuration: avgVerification,
    phaseBreakdown,

    avgFilesModified,
    avgLinesChanged,

    totalSessions: sessions.length,
    totalSessionDuration,
    avgSessionDuration: sessions.length > 0 ? totalSessionDuration / sessions.length : 0,
    gigachadMerges,

    recentSuccessRate,
    recentAvgDuration,

    categoryBreakdown,
  };
}

function generateSuggestions(analysis: AnalysisResults): string[] {
  const suggestions: string[] = [];

  // Success rate suggestions
  if (analysis.successRate < 70) {
    suggestions.push('Low success rate detected. Consider reviewing task complexity or prompt templates.');
  }
  if (analysis.successRate < 50) {
    suggestions.push('Critical: More than half of tasks are failing. Check error diagnostics for patterns.');
  }

  // Duration suggestions
  if (analysis.avgDuration > 600) {
    // > 10 minutes
    suggestions.push('Tasks averaging over 10 minutes. Consider breaking tasks into smaller issues.');
  }
  if (analysis.stdDevDuration > analysis.avgDuration) {
    suggestions.push('High duration variance. Some task types may need different handling.');
  }

  // Iteration suggestions
  if (analysis.avgIterations > 2) {
    suggestions.push('High average iterations. Improve test coverage to catch issues earlier.');
  }

  // Cost suggestions
  if (analysis.avgCostPerTask > 0.5) {
    suggestions.push('High average cost per task. Consider using smaller models for simpler tasks.');
  }

  // Failure pattern suggestions
  const topFailure = Object.entries(analysis.failuresByReason)
    .sort(([, a], [, b]) => b - a)[0];
  if (topFailure && topFailure[1] >= 3) {
    suggestions.push(`Most common failure: "${topFailure[0]}" (${topFailure[1]} times). Address this root cause.`);
  }

  // Phase timing suggestions
  if (analysis.phaseBreakdown.verificationPct > 40) {
    suggestions.push('Verification takes >40% of task time. Consider optimizing test suite.');
  }

  // Trend suggestions
  if (analysis.recentSuccessRate < analysis.successRate - 10) {
    suggestions.push('Recent success rate is declining. Review recent changes to templates or workflow.');
  }

  // GigaChad mode suggestions
  if (analysis.gigachadMerges > 0 && analysis.successRate < 90) {
    suggestions.push('GigaChad mode active with <90% success rate. Consider disabling until reliability improves.');
  }

  return suggestions;
}

function printInsights(analysis: AnalysisResults, _chadgiDir: string): void {
  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('               CHADGI PERFORMANCE INSIGHTS                 ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  // Overview Section
  console.log(`${colors.cyan}${colors.bold}Overview${colors.reset}`);
  console.log(`  Total Tasks:      ${analysis.totalTasks}`);
  console.log(`  Completed:        ${colors.green}${analysis.completedTasks}${colors.reset}`);
  console.log(`  Failed:           ${colors.red}${analysis.failedTasks}${colors.reset}`);
  const successColor = analysis.successRate >= 80 ? colors.green : analysis.successRate >= 50 ? colors.yellow : colors.red;
  console.log(`  Success Rate:     ${successColor}${analysis.successRate.toFixed(1)}%${colors.reset}`);
  console.log(`  Total Sessions:   ${analysis.totalSessions}`);
  if (analysis.gigachadMerges > 0) {
    console.log(`  ${colors.purple}GigaChad Merges: ${analysis.gigachadMerges}${colors.reset}`);
  }
  console.log('');

  // Duration Analysis
  console.log(`${colors.cyan}${colors.bold}Duration Analysis${colors.reset}`);
  console.log(`  Average:          ${formatDuration(analysis.avgDuration)}`);
  console.log(`  Median:           ${formatDuration(analysis.medianDuration)}`);
  console.log(`  Min:              ${formatDuration(analysis.minDuration)}`);
  console.log(`  Max:              ${formatDuration(analysis.maxDuration)}`);
  console.log(`  Std Dev:          ${formatDuration(analysis.stdDevDuration)}`);
  console.log(`  P90:              ${formatDuration(analysis.p90Duration)}`);
  console.log('');

  // Duration distribution histogram
  if (analysis.durations.length > 0) {
    console.log(`${colors.dim}Duration Distribution:${colors.reset}`);
    const histogram = generateHistogram(analysis.durations, 5, 15);
    histogram.forEach((line) => console.log(line));
    console.log('');
  }

  // Cost Analysis
  console.log(`${colors.cyan}${colors.bold}Cost Analysis${colors.reset}`);
  console.log(`  Total Cost:       $${analysis.totalCost.toFixed(4)}`);
  console.log(`  Avg per Task:     $${analysis.avgCostPerTask.toFixed(4)}`);
  console.log(`  Avg per Success:  $${analysis.avgCostPerSuccessfulTask.toFixed(4)}`);
  if (analysis.totalSessionDuration > 0) {
    const costPerMinute = (analysis.totalCost / analysis.totalSessionDuration) * 60;
    console.log(`  Cost per Minute:  $${costPerMinute.toFixed(4)}`);
  }
  console.log('');

  // Iteration Analysis
  console.log(`${colors.cyan}${colors.bold}Iteration Analysis${colors.reset}`);
  console.log(`  Avg Iterations:   ${analysis.avgIterations.toFixed(1)}`);
  console.log(`  Total Iterations: ${analysis.totalIterations}`);
  if (Object.keys(analysis.iterationsDistribution).length > 0) {
    console.log(`  Distribution:`);
    const sorted = Object.entries(analysis.iterationsDistribution)
      .sort(([a], [b]) => Number(a) - Number(b));
    for (const [iter, count] of sorted) {
      const pct = ((count / analysis.totalTasks) * 100).toFixed(0);
      console.log(`    ${iter} iteration(s): ${count} tasks (${pct}%)`);
    }
  }
  console.log('');

  // Phase Timing (if available)
  if (analysis.avgPhase1Duration > 0 || analysis.avgPhase2Duration > 0) {
    console.log(`${colors.cyan}${colors.bold}Phase Timing${colors.reset}`);
    console.log(`  Phase 1 (Impl):   ${formatDuration(analysis.avgPhase1Duration)} (${analysis.phaseBreakdown.phase1Pct.toFixed(0)}%)`);
    console.log(`  Phase 2 (PR):     ${formatDuration(analysis.avgPhase2Duration)} (${analysis.phaseBreakdown.phase2Pct.toFixed(0)}%)`);
    console.log(`  Verification:     ${formatDuration(analysis.avgVerificationDuration)} (${analysis.phaseBreakdown.verificationPct.toFixed(0)}%)`);
    console.log('');
  }

  // Failure Analysis
  if (analysis.failedTasks > 0) {
    console.log(`${colors.cyan}${colors.bold}Failure Analysis${colors.reset}`);
    if (Object.keys(analysis.failuresByReason).length > 0) {
      console.log(`  By Reason:`);
      const sorted = Object.entries(analysis.failuresByReason)
        .sort(([, a], [, b]) => b - a);
      for (const [reason, count] of sorted) {
        const pct = ((count / analysis.failedTasks) * 100).toFixed(0);
        console.log(`    ${colors.red}${reason}${colors.reset}: ${count} (${pct}%)`);
      }
    }
    if (Object.keys(analysis.failuresByPhase).length > 0) {
      console.log(`  By Phase:`);
      for (const [phase, count] of Object.entries(analysis.failuresByPhase)) {
        const pct = ((count / analysis.failedTasks) * 100).toFixed(0);
        console.log(`    ${phase}: ${count} (${pct}%)`);
      }
    }
    console.log('');
  }

  // Complexity Metrics (if available)
  if (analysis.avgFilesModified > 0) {
    console.log(`${colors.cyan}${colors.bold}Complexity Metrics${colors.reset}`);
    console.log(`  Avg Files Modified: ${analysis.avgFilesModified.toFixed(1)}`);
    console.log(`  Avg Lines Changed:  ${analysis.avgLinesChanged.toFixed(0)}`);
    console.log('');
  }

  // Category Breakdown
  const categoryKeys = Object.keys(analysis.categoryBreakdown);
  if (categoryKeys.length > 0 && !(categoryKeys.length === 1 && categoryKeys[0] === 'uncategorized')) {
    console.log(`${colors.cyan}${colors.bold}Category Breakdown${colors.reset}`);
    // Sort categories by task count descending
    const sortedCategories = categoryKeys
      .map((cat) => ({ cat, stats: analysis.categoryBreakdown[cat] }))
      .sort((a, b) => b.stats.tasks - a.stats.tasks);

    for (const { cat, stats } of sortedCategories) {
      const catSuccessColor = stats.successRate >= 80 ? colors.green : stats.successRate >= 50 ? colors.yellow : colors.red;
      const durationStr = stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : 'N/A';
      console.log(`  ${colors.bold}${cat}${colors.reset}: ${stats.tasks} tasks, ${catSuccessColor}${stats.successRate.toFixed(0)}% success${colors.reset}, avg ${durationStr}`);
    }
    console.log('');
  }

  // Recent Trends
  console.log(`${colors.cyan}${colors.bold}Recent Trends (Last 10 Tasks)${colors.reset}`);
  const trendColor = analysis.recentSuccessRate >= analysis.successRate
    ? colors.green
    : colors.yellow;
  console.log(`  Success Rate:     ${trendColor}${analysis.recentSuccessRate.toFixed(1)}%${colors.reset}`);
  console.log(`  Avg Duration:     ${formatDuration(analysis.recentAvgDuration)}`);
  console.log('');

  // Suggestions
  const suggestions = generateSuggestions(analysis);
  if (suggestions.length > 0) {
    console.log(`${colors.yellow}${colors.bold}Optimization Suggestions${colors.reset}`);
    for (const suggestion of suggestions) {
      console.log(`  ${colors.yellow}*${colors.reset} ${suggestion}`);
    }
    console.log('');
  }

  console.log(`${colors.purple}${colors.bold}==========================================================`);
  console.log('               Chad does what Chad wants.');
  console.log(`==========================================================${colors.reset}`);
}

/**
 * Insights command handler using middleware pattern.
 *
 * Note how the handler is now focused purely on business logic:
 * - No try/catch needed (handled by withErrorHandler)
 * - No config path resolution (handled by withDirectory)
 * - No directory validation (handled by withDirectoryValidation)
 * - JSON output is handled automatically when result.data is returned
 */
async function insightsHandler(
  ctx: DirectoryContext<InsightsOptions>
): Promise<CommandResult> {
  const { chadgiDir, options } = ctx;

  // Load data
  let { sessions, tasks } = loadInsightsData(chadgiDir, options.days);

  if (sessions.length === 0 && tasks.length === 0) {
    console.log('No performance data found.');
    console.log(`Looking in: ${chadgiDir}`);
    console.log('\nRun `chadgi start` to begin collecting performance metrics.');
    return { success: true };
  }

  // Filter by category if specified
  if (options.category) {
    const categoryFilter = options.category.toLowerCase();
    tasks = tasks.filter((t) => t.category?.toLowerCase() === categoryFilter);
    if (tasks.length === 0) {
      console.log(`No tasks found with category: ${options.category}`);
      console.log('Available categories can be viewed by running `chadgi insights` without the --category flag.');
      return { success: true };
    }
    console.log(`${colors.dim}Filtering by category: ${options.category}${colors.reset}\n`);
  }

  // Analyze data
  const analysis = analyzeData(sessions, tasks);

  // Export if requested
  if (options.export) {
    const exportData = {
      generated_at: new Date().toISOString(),
      analysis,
      sessions,
      tasks,
    };
    writeFileSync(options.export, JSON.stringify(exportData, null, 2));
    console.log(`Metrics exported to: ${options.export}`);
    return { success: true };
  }

  // Output as JSON if requested
  if (options.json) {
    return { data: analysis };
  }

  // Display formatted insights
  printInsights(analysis, chadgiDir);

  return { success: true };
}

/**
 * Insights command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 * 5. withDirectoryValidation - ensures .chadgi directory exists
 */
export const insightsMiddleware = withCommand<InsightsOptions, DirectoryContext<InsightsOptions>>(
  [withDirectory, withDirectoryValidation] as any,
  insightsHandler
);
