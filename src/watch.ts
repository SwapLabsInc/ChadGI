import { existsSync, readFileSync, watchFile, unwatchFile, statSync } from 'fs';
import { join, dirname, resolve } from 'path';

interface WatchOptions {
  config?: string;
  json?: boolean;
  once?: boolean;
  interval?: number;
}

interface ProgressData {
  status: string;
  phase?: string;
  current_task?: {
    id: string;
    title: string;
    branch: string;
    started_at: string;
  };
  session?: {
    started_at: string;
    tasks_completed: number;
    total_cost_usd: number;
  };
  iteration?: {
    current: number;
    max: number;
  };
  recent_tools?: Array<{
    name: string;
    result?: string;
    timestamp: string;
  }>;
  last_updated: string;
}

interface WatchStatus {
  active: boolean;
  state: 'running' | 'paused' | 'stopped' | 'idle' | 'error' | 'no_session';
  phase?: 'implementation' | 'verification' | 'pr_creation' | 'unknown';
  currentTask?: {
    id: string;
    title: string;
    branch: string;
    startedAt: string;
    elapsedSeconds: number;
  };
  iteration?: {
    current: number;
    max: number;
    remaining: number;
  };
  session?: {
    startedAt: string;
    tasksCompleted: number;
    totalCostUsd: number;
    elapsedSeconds: number;
  };
  recentTools?: Array<{
    name: string;
    result?: string;
    timestamp: string;
  }>;
  lastUpdated?: string;
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  purple: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
};

// ANSI escape codes for cursor control
const cursor = {
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
  clearScreen: '\x1b[2J',
  moveTo: (row: number, col: number) => `\x1b[${row};${col}H`,
  clearLine: '\x1b[2K',
};

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
  return new Date(isoDate).toLocaleString();
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString();
}

function getStateColor(state: string): string {
  switch (state) {
    case 'running':
      return colors.green;
    case 'paused':
      return colors.yellow;
    case 'stopped':
    case 'idle':
      return colors.blue;
    case 'error':
      return colors.red;
    case 'no_session':
      return colors.dim;
    default:
      return colors.dim;
  }
}

function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'implementation':
      return colors.cyan;
    case 'verification':
      return colors.yellow;
    case 'pr_creation':
      return colors.green;
    default:
      return colors.dim;
  }
}

function getPhaseEmoji(phase: string): string {
  switch (phase) {
    case 'implementation':
      return '[CODE]';
    case 'verification':
      return '[TEST]';
    case 'pr_creation':
      return '[PR]';
    default:
      return '[...]';
  }
}

function getSpinner(tick: number): string {
  const frames = ['|', '/', '-', '\\'];
  return frames[tick % frames.length];
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

function readProgressFile(progressFile: string): ProgressData | null {
  if (!existsSync(progressFile)) {
    return null;
  }

  try {
    const content = readFileSync(progressFile, 'utf-8');
    return JSON.parse(content) as ProgressData;
  } catch {
    return null;
  }
}

function isSessionActive(progress: ProgressData | null, progressFile: string): boolean {
  if (!progress) return false;

  // Check if the progress file was updated recently (within last 60 seconds)
  // This indicates an actively running session
  if (progress.last_updated) {
    const lastUpdated = new Date(progress.last_updated);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastUpdated.getTime()) / 1000;

    // If status is in_progress and file was updated in the last 60 seconds
    if (progress.status === 'in_progress' && diffSeconds < 60) {
      return true;
    }
  }

  // Also check file modification time as a fallback
  try {
    const stats = statSync(progressFile);
    const diffSeconds = (Date.now() - stats.mtimeMs) / 1000;
    return progress.status === 'in_progress' && diffSeconds < 60;
  } catch {
    return false;
  }
}

function buildWatchStatus(progress: ProgressData | null, progressFile: string): WatchStatus {
  const watchStatus: WatchStatus = {
    active: false,
    state: 'no_session',
  };

  if (!progress) {
    return watchStatus;
  }

  watchStatus.active = isSessionActive(progress, progressFile);
  watchStatus.lastUpdated = progress.last_updated;

  // Determine state
  if (!watchStatus.active) {
    if (progress.status === 'in_progress') {
      watchStatus.state = 'stopped'; // Was running but stale
    } else if (progress.status === 'paused') {
      watchStatus.state = 'paused';
    } else if (progress.status === 'error') {
      watchStatus.state = 'error';
    } else if (progress.status === 'idle') {
      watchStatus.state = 'idle';
    } else {
      watchStatus.state = 'stopped';
    }
  } else {
    watchStatus.state = 'running';
  }

  // Phase
  if (progress.phase) {
    watchStatus.phase = progress.phase as WatchStatus['phase'];
  } else if (progress.status === 'in_progress') {
    watchStatus.phase = 'implementation';
  }

  // Current task
  if (progress.current_task?.id) {
    const startedAt = new Date(progress.current_task.started_at);
    watchStatus.currentTask = {
      id: progress.current_task.id,
      title: progress.current_task.title,
      branch: progress.current_task.branch,
      startedAt: progress.current_task.started_at,
      elapsedSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    };
  }

  // Iteration info
  if (progress.iteration) {
    watchStatus.iteration = {
      current: progress.iteration.current,
      max: progress.iteration.max,
      remaining: progress.iteration.max - progress.iteration.current,
    };
  }

  // Session info
  if (progress.session?.started_at) {
    const sessionStart = new Date(progress.session.started_at);
    watchStatus.session = {
      startedAt: progress.session.started_at,
      tasksCompleted: progress.session.tasks_completed ?? 0,
      totalCostUsd: progress.session.total_cost_usd ?? 0,
      elapsedSeconds: Math.floor((Date.now() - sessionStart.getTime()) / 1000),
    };
  }

  // Recent tools
  if (progress.recent_tools && progress.recent_tools.length > 0) {
    watchStatus.recentTools = progress.recent_tools.slice(-5); // Last 5 tools
  }

  return watchStatus;
}

function renderDashboard(status: WatchStatus, tick: number): void {
  const lines: string[] = [];

  // Header
  lines.push(`${colors.purple}${colors.bold}`);
  lines.push('==========================================================');
  lines.push('                  CHADGI WATCH                            ');
  lines.push('==========================================================');
  lines.push(`${colors.reset}`);

  // Status indicator
  const stateColor = getStateColor(status.state);
  const spinner = status.active ? ` ${getSpinner(tick)}` : '';
  lines.push(`${colors.cyan}Status:${colors.reset} ${stateColor}${colors.bold}${status.state.toUpperCase()}${spinner}${colors.reset}`);

  if (!status.active && status.state !== 'running') {
    lines.push('');
    if (status.state === 'no_session') {
      lines.push(`${colors.yellow}No active ChadGI session detected.${colors.reset}`);
      lines.push('');
      lines.push(`${colors.dim}To start a session, run: chadgi start${colors.reset}`);
    } else if (status.state === 'stopped' || status.state === 'idle') {
      lines.push(`${colors.yellow}Session is not currently running.${colors.reset}`);
      lines.push('');
      if (status.lastUpdated) {
        lines.push(`${colors.dim}Last activity: ${formatDate(status.lastUpdated)}${colors.reset}`);
      }
      lines.push(`${colors.dim}To start a session, run: chadgi start${colors.reset}`);
    } else if (status.state === 'paused') {
      lines.push(`${colors.yellow}Session is paused.${colors.reset}`);
      lines.push('');
      lines.push(`${colors.dim}To resume, run: chadgi resume${colors.reset}`);
    } else if (status.state === 'error') {
      lines.push(`${colors.red}Session encountered an error.${colors.reset}`);
      lines.push('');
      lines.push(`${colors.dim}Check logs or run: chadgi doctor${colors.reset}`);
    }

    // Show last task info if available
    if (status.currentTask) {
      lines.push('');
      lines.push(`${colors.cyan}${colors.bold}LAST TASK${colors.reset}`);
      lines.push(`  Issue:   #${status.currentTask.id}`);
      lines.push(`  Title:   ${truncate(status.currentTask.title, 50)}`);
      lines.push(`  Branch:  ${status.currentTask.branch}`);
    }
  } else {
    // Phase
    if (status.phase) {
      const phaseColor = getPhaseColor(status.phase);
      const phaseEmoji = getPhaseEmoji(status.phase);
      lines.push(`${colors.cyan}Phase:${colors.reset}  ${phaseColor}${phaseEmoji} ${status.phase.toUpperCase()}${colors.reset}`);
    }

    lines.push('');

    // Current task
    if (status.currentTask) {
      lines.push(`${colors.cyan}${colors.bold}CURRENT TASK${colors.reset}`);
      lines.push(`  Issue:   #${status.currentTask.id}`);
      lines.push(`  Title:   ${truncate(status.currentTask.title, 50)}`);
      lines.push(`  Branch:  ${status.currentTask.branch}`);
      lines.push(`  Elapsed: ${formatDuration(status.currentTask.elapsedSeconds)}`);
      lines.push('');
    }

    // Iteration info
    if (status.iteration) {
      lines.push(`${colors.cyan}${colors.bold}ITERATION${colors.reset}`);
      const progress = Math.round((status.iteration.current / status.iteration.max) * 100);
      const progressBar = renderProgressBar(progress, 20);
      lines.push(`  ${progressBar} ${status.iteration.current}/${status.iteration.max}`);
      lines.push(`  Retries remaining: ${status.iteration.remaining}`);
      lines.push('');
    }

    // Recent tool calls
    if (status.recentTools && status.recentTools.length > 0) {
      lines.push(`${colors.cyan}${colors.bold}RECENT ACTIVITY${colors.reset}`);
      for (const tool of status.recentTools.slice(-3)) {
        const time = formatTime(tool.timestamp);
        const toolName = truncate(tool.name, 20);
        const result = tool.result ? truncate(tool.result, 30) : '';
        lines.push(`  ${colors.dim}${time}${colors.reset} ${toolName}${result ? ` -> ${colors.dim}${result}${colors.reset}` : ''}`);
      }
      lines.push('');
    }

    // Session stats
    if (status.session) {
      lines.push(`${colors.cyan}${colors.bold}SESSION STATS${colors.reset}`);
      lines.push(`  Duration:  ${formatDuration(status.session.elapsedSeconds)}`);
      lines.push(`  Completed: ${status.session.tasksCompleted} task(s)`);
      lines.push(`  Cost:      $${status.session.totalCostUsd.toFixed(4)}`);
    }
  }

  // Footer
  lines.push('');
  lines.push(`${colors.dim}Last updated: ${status.lastUpdated ? formatDate(status.lastUpdated) : 'N/A'}${colors.reset}`);
  lines.push(`${colors.dim}Press Ctrl+C to exit${colors.reset}`);

  // Clear and render
  process.stdout.write(cursor.clearScreen);
  process.stdout.write(cursor.moveTo(1, 1));
  console.log(lines.join('\n'));
}

function renderProgressBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const bar = `${'#'.repeat(filled)}${'-'.repeat(empty)}`;
  return `[${bar}]`;
}

export async function watch(options: WatchOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const chadgiDir = options.config
    ? dirname(resolve(options.config))
    : join(cwd, '.chadgi');

  if (!existsSync(chadgiDir)) {
    if (options.json) {
      console.log(JSON.stringify({ active: false, state: 'no_session', error: '.chadgi directory not found' }, null, 2));
    } else {
      console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
      console.error('Run `chadgi init` first to initialize ChadGI.');
    }
    process.exit(1);
  }

  const progressFile = join(chadgiDir, 'chadgi-progress.json');

  // Single check mode (--once flag)
  if (options.once) {
    const progress = readProgressFile(progressFile);
    const status = buildWatchStatus(progress, progressFile);

    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      renderDashboard(status, 0);
    }
    return;
  }

  // JSON mode doesn't support continuous watching (use --once for JSON)
  if (options.json) {
    console.error(`${colors.yellow}Note: --json flag requires --once for single status check.${colors.reset}`);
    console.error('Use: chadgi watch --json --once');
    const progress = readProgressFile(progressFile);
    const status = buildWatchStatus(progress, progressFile);
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  // Live watch mode
  const refreshInterval = options.interval ?? 2000; // Default 2 second refresh
  let tick = 0;
  let running = true;

  // Handle cleanup on exit
  const cleanup = () => {
    running = false;
    unwatchFile(progressFile);
    process.stdout.write(cursor.show);
    process.stdout.write(cursor.clearScreen);
    process.stdout.write(cursor.moveTo(1, 1));
    console.log('Stopped watching.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Hide cursor for cleaner display
  process.stdout.write(cursor.hide);

  // Initial render
  const renderUpdate = () => {
    if (!running) return;
    const progress = readProgressFile(progressFile);
    const status = buildWatchStatus(progress, progressFile);
    renderDashboard(status, tick);
    tick++;
  };

  renderUpdate();

  // Set up polling for updates
  const pollInterval = setInterval(() => {
    if (running) {
      renderUpdate();
    }
  }, refreshInterval);

  // Also watch the file for changes (more responsive)
  watchFile(progressFile, { interval: 500 }, () => {
    if (running) {
      renderUpdate();
    }
  });

  // Keep the process running
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => {
      clearInterval(pollInterval);
      resolve();
    });
    process.on('SIGTERM', () => {
      clearInterval(pollInterval);
      resolve();
    });
  });
}
