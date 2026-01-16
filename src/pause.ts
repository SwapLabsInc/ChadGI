import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';

// Import shared types
import type { BaseCommandOptions, ProgressData, PauseLockData } from './types/index.js';

interface PauseOptions extends BaseCommandOptions {
  for?: string;
  reason?: string;
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  purple: '\x1b[35m',
};

/**
 * Parse duration string (e.g., "30m", "2h", "1h30m") to milliseconds
 */
function parseDuration(duration: string): number | null {
  const hourMatch = duration.match(/(\d+)h/);
  const minMatch = duration.match(/(\d+)m/);

  let ms = 0;
  if (hourMatch) {
    ms += parseInt(hourMatch[1], 10) * 60 * 60 * 1000;
  }
  if (minMatch) {
    ms += parseInt(minMatch[1], 10) * 60 * 1000;
  }

  return ms > 0 ? ms : null;
}

/**
 * Format a Date as ISO string
 */
function toISOString(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export async function pause(options: PauseOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const chadgiDir = options.config
    ? dirname(resolve(options.config))
    : join(cwd, '.chadgi');

  // Ensure .chadgi directory exists
  if (!existsSync(chadgiDir)) {
    console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
    console.error('Run `chadgi init` first to initialize ChadGI.');
    process.exit(1);
  }

  const pauseLockFile = join(chadgiDir, 'pause.lock');
  const progressFile = join(chadgiDir, 'chadgi-progress.json');

  // Check if already paused
  if (existsSync(pauseLockFile)) {
    console.log(`${colors.yellow}ChadGI is already paused.${colors.reset}`);
    try {
      const lockContent = JSON.parse(readFileSync(pauseLockFile, 'utf-8'));
      console.log(`  Paused at: ${new Date(lockContent.paused_at).toLocaleString()}`);
      if (lockContent.reason) {
        console.log(`  Reason: ${lockContent.reason}`);
      }
      if (lockContent.resume_at) {
        console.log(`  Auto-resume at: ${new Date(lockContent.resume_at).toLocaleString()}`);
      }
    } catch {
      // Lock file exists but might be corrupted, ignore
    }
    console.log('\nRun `chadgi resume` to continue processing.');
    return;
  }

  // Create pause lock file
  const pauseData: PauseLockData = {
    paused_at: toISOString(new Date()),
  };

  if (options.reason) {
    pauseData.reason = options.reason;
  }

  // Handle optional duration
  if (options.for) {
    const durationMs = parseDuration(options.for);
    if (durationMs) {
      const resumeAt = new Date(Date.now() + durationMs);
      pauseData.resume_at = toISOString(resumeAt);
      console.log(`${colors.cyan}Pause will automatically expire at ${resumeAt.toLocaleString()}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}Warning: Invalid duration format '${options.for}'. Use format like '30m' or '2h'.${colors.reset}`);
    }
  }

  writeFileSync(pauseLockFile, JSON.stringify(pauseData, null, 2));

  console.log(`${colors.yellow}${colors.bold}`);
  console.log('==========================================================');
  console.log('                    CHADGI PAUSED                          ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  // Check if ChadGI is currently running
  let currentTask: ProgressData | null = null;
  if (existsSync(progressFile)) {
    try {
      currentTask = JSON.parse(readFileSync(progressFile, 'utf-8'));
    } catch {
      // Ignore parse errors
    }
  }

  if (currentTask && currentTask.status === 'in_progress' && currentTask.current_task?.id) {
    console.log(`${colors.cyan}A task is currently in progress:${colors.reset}`);
    console.log(`  Issue: #${currentTask.current_task.id}`);
    console.log(`  Title: ${currentTask.current_task.title}`);
    console.log(`  Branch: ${currentTask.current_task.branch}`);
    console.log('');
    console.log(`${colors.yellow}The current task will complete before pausing.${colors.reset}`);
    console.log('ChadGI will pause gracefully after this task finishes.');
  } else {
    console.log('ChadGI will pause before starting the next task.');
  }

  console.log('');
  if (options.reason) {
    console.log(`Reason: ${options.reason}`);
  }
  console.log(`Pause signal created at: ${new Date().toLocaleString()}`);
  console.log('');
  console.log(`Run ${colors.green}chadgi resume${colors.reset} to continue processing.`);
  console.log(`Run ${colors.cyan}chadgi status${colors.reset} to check current state.`);
}
