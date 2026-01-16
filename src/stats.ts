import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { colors } from './utils/colors.js';

// Import shared types
import type { BaseCommandOptions, SessionStats, TaskResult } from './types/index.js';

interface StatsOptions extends BaseCommandOptions {
  last?: number;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString();
}

export async function stats(options: StatsOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const chadgiDir = options.config
    ? dirname(resolve(options.config))
    : join(cwd, '.chadgi');
  const statsFile = join(chadgiDir, 'chadgi-stats.json');

  if (!existsSync(statsFile)) {
    console.log('No session statistics found.');
    console.log(`Stats file not found at: ${statsFile}`);
    console.log('\nRun `chadgi start` to begin tracking session statistics.');
    return;
  }

  let sessions: SessionStats[];
  try {
    const content = readFileSync(statsFile, 'utf-8');
    sessions = JSON.parse(content);
  } catch (error) {
    console.error('Error reading stats file:', (error as Error).message);
    return;
  }

  if (!Array.isArray(sessions) || sessions.length === 0) {
    console.log('No session statistics recorded yet.');
    return;
  }

  // Filter to last N sessions if specified
  const limit = options.last ?? sessions.length;
  const displaySessions = sessions.slice(-limit);

  // Output as JSON if requested
  if (options.json) {
    console.log(JSON.stringify(displaySessions, null, 2));
    return;
  }

  // Display formatted statistics
  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('              CHADGI SESSION HISTORY                       ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  // Aggregate statistics
  let totalDuration = 0;
  let totalAttempted = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  let totalCost = 0;
  let totalGigachadMerges = 0;

  for (const session of displaySessions) {
    totalDuration += session.duration_secs;
    totalAttempted += session.tasks_attempted;
    totalCompleted += session.tasks_completed;
    totalFailed += session.failed_tasks?.length ?? 0;
    totalCost += session.total_cost_usd ?? 0;
    totalGigachadMerges += session.gigachad_merges ?? 0;
  }

  // Display aggregate stats
  console.log(`${colors.cyan}Overall Statistics (${displaySessions.length} sessions)${colors.reset}`);
  console.log(`  Total Duration:     ${formatDuration(totalDuration)}`);
  console.log(`  Tasks Attempted:    ${totalAttempted}`);
  console.log(`  Tasks Completed:    ${totalCompleted}`);
  console.log(`  Tasks Failed:       ${totalFailed}`);
  if (totalAttempted > 0) {
    const successRate = ((totalCompleted / totalAttempted) * 100).toFixed(1);
    console.log(`  Success Rate:       ${successRate}%`);
  }
  console.log(`  Total Cost:         $${totalCost.toFixed(4)}`);
  if (totalCompleted > 0) {
    const avgCost = totalCost / totalCompleted;
    console.log(`  Avg Cost/Task:      $${avgCost.toFixed(4)}`);
  }
  if (totalGigachadMerges > 0) {
    console.log(`  ${colors.purple}GigaChad Merges:    ${totalGigachadMerges}${colors.reset}`);
  }
  console.log('');

  // Display individual sessions
  console.log(`${colors.cyan}Session History${colors.reset}`);
  console.log('');

  for (let i = displaySessions.length - 1; i >= 0; i--) {
    const session = displaySessions[i];
    const sessionNum = sessions.indexOf(session) + 1;

    console.log(`${colors.bold}Session #${sessionNum}${colors.reset} ${colors.dim}(${session.repo})${colors.reset}`);
    console.log(`  Started:     ${formatDate(session.started_at)}`);
    console.log(`  Duration:    ${formatDuration(session.duration_secs)}`);
    console.log(`  Tasks:       ${session.tasks_completed}/${session.tasks_attempted} completed`);
    console.log(`  Cost:        $${(session.total_cost_usd ?? 0).toFixed(4)}`);

    // Show successful tasks
    if (session.successful_tasks?.length > 0) {
      console.log(`  ${colors.green}Completed:${colors.reset}`);
      for (const task of session.successful_tasks) {
        const duration = task.duration_secs ? formatDuration(task.duration_secs) : 'N/A';
        console.log(`    - Issue #${task.issue} (${duration})`);
      }
    }

    // Show failed tasks
    if (session.failed_tasks?.length > 0) {
      console.log(`  ${colors.red}Failed:${colors.reset}`);
      for (const task of session.failed_tasks) {
        const reason = task.reason ?? 'unknown';
        console.log(`    - Issue #${task.issue}: ${reason}`);
      }
    }

    // GigaChad mode indicator
    if (session.gigachad_mode && session.gigachad_merges > 0) {
      console.log(`  ${colors.purple}GigaChad:    ${session.gigachad_merges} auto-merged${colors.reset}`);
    }

    console.log('');
  }

  console.log(`${colors.purple}${colors.bold}==========================================================`);
  console.log('               Chad does what Chad wants.');
  console.log(`==========================================================${colors.reset}`);
}
