import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  watchFile,
  unwatchFile,
} from 'fs';
import { join, dirname, basename } from 'path';
import { createInterface } from 'readline';
import { colors } from './utils/colors.js';
import { parseYamlNested, resolveConfigPath, ensureChadgiDirExists } from './utils/config.js';
import {
  formatDate,
  formatRelativeTime,
  formatBytes,
  parseSince,
  horizontalLine,
  truncate,
} from './utils/formatting.js';
import { readTextFile } from './utils/data.js';

import type {
  BaseCommandOptions,
  LogEntry,
  LogLevel,
  LogsResult,
  LogFileInfo,
} from './types/index.js';

// ============================================================================
// Types
// ============================================================================

interface LogsOptions extends BaseCommandOptions {
  limit?: number;
  since?: string;
  follow?: boolean;
  level?: string;
  task?: number;
  grep?: string;
}

interface LogsListOptions extends BaseCommandOptions {
  // No additional options
}

interface LogsClearOptions extends BaseCommandOptions {
  yes?: boolean;
  keepLast?: number;
}

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const DEFAULT_LOG_FILE = './chadgi.log';
const DEFAULT_LIMIT = 100;

// ANSI cursor control
const cursor = {
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
  clearLine: '\x1b[2K',
  moveUp: (n: number) => `\x1b[${n}A`,
  moveToColumn: (n: number) => `\x1b[${n}G`,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get log level color
 */
function getLevelColor(level: LogLevel): string {
  switch (level) {
    case 'error':
      return colors.red;
    case 'warn':
      return colors.yellow;
    case 'info':
      return colors.reset;
    case 'debug':
      return colors.dim;
    default:
      return colors.reset;
  }
}

/**
 * Get log level priority (higher = more severe)
 */
function getLevelPriority(level: LogLevel): number {
  return LOG_LEVELS.indexOf(level);
}

/**
 * Resolve log file path from config
 */
function resolveLogPath(chadgiDir: string, configContent: string): string {
  const logFile =
    parseYamlNested(configContent, 'output', 'log_file') || DEFAULT_LOG_FILE;
  return logFile.startsWith('/') ? logFile : join(chadgiDir, logFile);
}

/**
 * Parse a plain text log line
 * Supports formats:
 * - [2024-01-15T10:30:00Z] [INFO] message
 * - [2024-01-15T10:30:00Z] [INFO] [task:42] message
 * - 2024-01-15T10:30:00Z INFO message
 */
function parsePlainTextLogLine(line: string): LogEntry | null {
  // Format: [timestamp] [LEVEL] [context] message
  const bracketMatch = line.match(
    /^\[([^\]]+)\]\s*\[([A-Z]+)\]\s*(?:\[([^\]]+)\]\s*)?(.*)$/
  );
  if (bracketMatch) {
    const [, timestamp, level, context, message] = bracketMatch;
    const entry: LogEntry = {
      timestamp: timestamp.trim(),
      level: level.toLowerCase() as LogLevel,
      message: message.trim(),
    };
    if (context) {
      // Parse context like "task:42" or "phase:implementation"
      const taskMatch = context.match(/task:(\d+)/i);
      if (taskMatch) {
        entry.taskId = parseInt(taskMatch[1], 10);
      }
      const phaseMatch = context.match(/phase:(\w+)/i);
      if (phaseMatch) {
        entry.phase = phaseMatch[1];
      }
      entry.context = context;
    }
    return entry;
  }

  // Format: timestamp LEVEL message
  const spaceMatch = line.match(
    /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*)\s+([A-Z]+)\s+(.*)$/
  );
  if (spaceMatch) {
    const [, timestamp, level, message] = spaceMatch;
    return {
      timestamp: timestamp.trim(),
      level: level.toLowerCase() as LogLevel,
      message: message.trim(),
    };
  }

  return null;
}

/**
 * Parse JSON log line
 */
function parseJsonLogLine(line: string): LogEntry | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed.timestamp && parsed.level && parsed.message) {
      return {
        timestamp: parsed.timestamp,
        level: (parsed.level || 'info').toLowerCase() as LogLevel,
        message: parsed.message,
        context: parsed.context,
        taskId: parsed.taskId || parsed.task_id || parsed.issue_number,
        phase: parsed.phase,
        metadata: parsed.metadata,
      };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

/**
 * Parse a single log line (auto-detect format)
 */
function parseLogLine(line: string): LogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try JSON first (starts with {)
  if (trimmed.startsWith('{')) {
    const entry = parseJsonLogLine(trimmed);
    if (entry) return entry;
  }

  // Try plain text
  return parsePlainTextLogLine(trimmed);
}

/**
 * Parse log file content into entries
 */
function parseLogEntries(content: string): LogEntry[] {
  const lines = content.split('\n');
  const entries: LogEntry[] = [];

  for (const line of lines) {
    const entry = parseLogLine(line);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Apply filters to log entries
 */
function applyFilters(
  entries: LogEntry[],
  options: LogsOptions
): { filtered: LogEntry[]; sinceDate?: Date; levelFilter?: string; taskFilter?: number; grepPattern?: string } {
  let filtered = [...entries];
  let sinceDate: Date | undefined;
  let levelFilter: string | undefined;
  let taskFilter: number | undefined;
  let grepPattern: string | undefined;

  // Apply --since filter
  if (options.since) {
    sinceDate = parseSince(options.since) || undefined;
    if (sinceDate) {
      const sinceTime = sinceDate.getTime();
      filtered = filtered.filter((entry) => {
        const entryTime = new Date(entry.timestamp).getTime();
        return !isNaN(entryTime) && entryTime >= sinceTime;
      });
    } else {
      console.error(`${colors.yellow}Warning: Could not parse --since value: ${options.since}${colors.reset}`);
      console.error('Supported formats: "1h", "7d", "2w", "1m", "2024-01-01"');
    }
  }

  // Apply --level filter
  if (options.level) {
    levelFilter = options.level.toLowerCase();
    const filterPriority = getLevelPriority(levelFilter as LogLevel);
    if (filterPriority >= 0) {
      // Show this level and higher severity levels
      filtered = filtered.filter(
        (entry) => getLevelPriority(entry.level) >= filterPriority
      );
    } else {
      console.error(`${colors.yellow}Warning: Unknown log level: ${options.level}${colors.reset}`);
      console.error('Supported levels: debug, info, warn, error');
    }
  }

  // Apply --task filter
  if (options.task !== undefined) {
    taskFilter = options.task;
    filtered = filtered.filter((entry) => entry.taskId === taskFilter);
  }

  // Apply --grep filter
  if (options.grep) {
    grepPattern = options.grep;
    try {
      const regex = new RegExp(grepPattern, 'i');
      filtered = filtered.filter((entry) => regex.test(entry.message));
    } catch {
      console.error(`${colors.yellow}Warning: Invalid regex pattern: ${options.grep}${colors.reset}`);
    }
  }

  // Apply --limit (from the end, most recent first)
  if (options.limit && options.limit > 0 && filtered.length > options.limit) {
    filtered = filtered.slice(-options.limit);
  }

  return { filtered, sinceDate, levelFilter, taskFilter, grepPattern };
}

/**
 * Format a single log entry for display
 */
function formatLogEntry(entry: LogEntry, showFullTimestamp: boolean = false): string {
  const levelColor = getLevelColor(entry.level);
  const levelStr = entry.level.toUpperCase().padEnd(5);

  const timestamp = showFullTimestamp
    ? formatDate(entry.timestamp)
    : formatRelativeTime(entry.timestamp);

  let line = `${colors.dim}${timestamp}${colors.reset} ${levelColor}[${levelStr}]${colors.reset}`;

  if (entry.taskId) {
    line += ` ${colors.cyan}#${entry.taskId}${colors.reset}`;
  }

  if (entry.phase) {
    line += ` ${colors.dim}(${entry.phase})${colors.reset}`;
  }

  line += ` ${entry.message}`;

  return line;
}

/**
 * Print formatted log entries
 */
function printLogs(
  entries: LogEntry[],
  total: number,
  options: LogsOptions,
  sinceDate?: Date,
  levelFilter?: string,
  taskFilter?: number,
  grepPattern?: string
): void {
  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('                    CHADGI LOGS                           ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  // Show filters if applied
  const hasFilters = sinceDate || levelFilter || taskFilter || grepPattern;
  if (hasFilters) {
    console.log(`${colors.dim}Filters applied:`);
    if (sinceDate) {
      console.log(`  Since: ${formatDate(sinceDate.toISOString())}`);
    }
    if (levelFilter) {
      console.log(`  Level: ${levelFilter} and above`);
    }
    if (taskFilter) {
      console.log(`  Task: #${taskFilter}`);
    }
    if (grepPattern) {
      console.log(`  Pattern: ${grepPattern}`);
    }
    console.log(`${colors.reset}`);
    console.log('');
  }

  if (entries.length === 0) {
    console.log(`${colors.yellow}No log entries found matching the specified criteria.${colors.reset}`);
    console.log('');
    console.log('If you expected logs, check that:');
    console.log('  - ChadGI has been run at least once');
    console.log('  - Log file is configured in chadgi-config.yaml');
    console.log('  - Your filter criteria match existing entries');
    return;
  }

  // Summary
  console.log(`${colors.cyan}Showing ${entries.length} of ${total} total entries${colors.reset}`);
  console.log('');

  // Entry list
  console.log(`${colors.cyan}${colors.bold}Log Entries${colors.reset}`);
  console.log(`${colors.dim}${horizontalLine(78)}${colors.reset}`);

  for (const entry of entries) {
    console.log(formatLogEntry(entry, true));
  }

  console.log(`${colors.dim}${horizontalLine(78)}${colors.reset}`);
  console.log('');
  console.log(`${colors.purple}${colors.bold}==========================================================`);
  console.log('               Chad does what Chad wants.');
  console.log(`==========================================================${colors.reset}`);
}

/**
 * Find all log files (main and rotated)
 */
function findLogFiles(chadgiDir: string, configContent: string): LogFileInfo[] {
  const logFile =
    parseYamlNested(configContent, 'output', 'log_file') || DEFAULT_LOG_FILE;
  const baseLogPath = logFile.startsWith('/') ? logFile : join(chadgiDir, logFile);
  const logDir = dirname(baseLogPath);
  const logBaseName = basename(baseLogPath);

  const files: LogFileInfo[] = [];

  if (!existsSync(logDir)) {
    return files;
  }

  try {
    const entries = readdirSync(logDir);

    // Find main log file and rotated logs
    for (const entry of entries) {
      if (entry === logBaseName || (entry.startsWith(logBaseName + '.') && /\.\d+$/.test(entry))) {
        const filePath = join(logDir, entry);
        try {
          const stats = statSync(filePath);
          if (stats.isFile()) {
            files.push({
              name: entry,
              path: filePath,
              size: stats.size,
              modified: stats.mtime.toISOString(),
            });
          }
        } catch {
          // Skip files we can't stat
        }
      }
    }

    // Sort: main log first, then by rotation number
    files.sort((a, b) => {
      const aNum = a.name.match(/\.(\d+)$/)?.[1];
      const bNum = b.name.match(/\.(\d+)$/)?.[1];
      if (!aNum && !bNum) return 0;
      if (!aNum) return -1;
      if (!bNum) return 1;
      return parseInt(aNum, 10) - parseInt(bNum, 10);
    });
  } catch {
    // Ignore errors reading directory
  }

  return files;
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// ============================================================================
// Main Command Functions
// ============================================================================

/**
 * Main logs command - view execution logs
 */
export async function logs(options: LogsOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { configPath, chadgiDir } = resolveConfigPath(options.config, cwd);
  ensureChadgiDirExists(chadgiDir);

  // Load config
  const configContent = existsSync(configPath)
    ? readFileSync(configPath, 'utf-8')
    : '';

  const logFilePath = resolveLogPath(chadgiDir, configContent);

  // Handle --follow mode
  if (options.follow) {
    await followLogs(logFilePath, options);
    return;
  }

  // Check if log file exists
  if (!existsSync(logFilePath)) {
    if (options.json) {
      const result: LogsResult = {
        entries: [],
        total: 0,
        filtered: 0,
        logFile: logFilePath,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`${colors.yellow}No log file found at: ${logFilePath}${colors.reset}`);
      console.log('');
      console.log('Log file will be created when ChadGI runs.');
      console.log('Run `chadgi start` to begin processing tasks.');
    }
    return;
  }

  // Read and parse log file
  const content = readTextFile(logFilePath);
  if (!content) {
    if (options.json) {
      const result: LogsResult = {
        entries: [],
        total: 0,
        filtered: 0,
        logFile: logFilePath,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`${colors.yellow}Log file is empty.${colors.reset}`);
    }
    return;
  }

  // Parse entries
  const allEntries = parseLogEntries(content);

  // Apply default limit if no filters specified
  const effectiveOptions = { ...options };
  if (effectiveOptions.limit === undefined && !options.since && !options.level && !options.task && !options.grep) {
    effectiveOptions.limit = DEFAULT_LIMIT;
  }

  // Apply filters
  const { filtered, sinceDate, levelFilter, taskFilter, grepPattern } = applyFilters(allEntries, effectiveOptions);

  // Output as JSON if requested
  if (options.json) {
    const result: LogsResult = {
      entries: filtered,
      total: allEntries.length,
      filtered: filtered.length,
      logFile: logFilePath,
    };
    if (sinceDate) {
      result.dateRange = {
        since: sinceDate.toISOString(),
        until: new Date().toISOString(),
      };
    }
    if (levelFilter) {
      result.levelFilter = levelFilter;
    }
    if (taskFilter !== undefined) {
      result.taskFilter = taskFilter;
    }
    if (grepPattern) {
      result.grepPattern = grepPattern;
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Display formatted logs
  printLogs(filtered, allEntries.length, options, sinceDate, levelFilter, taskFilter, grepPattern);
}

/**
 * Follow logs in real-time (like tail -f)
 */
async function followLogs(logFilePath: string, options: LogsOptions): Promise<void> {
  let running = true;
  let lastPosition = 0;
  let lastEntries: LogEntry[] = [];

  // Handle cleanup on exit
  const cleanup = () => {
    running = false;
    unwatchFile(logFilePath);
    process.stdout.write(cursor.show);
    console.log('');
    console.log(`${colors.dim}Stopped following logs.${colors.reset}`);
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Hide cursor
  process.stdout.write(cursor.hide);

  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('               CHADGI LOGS (FOLLOW MODE)                  ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  if (options.level) {
    console.log(`${colors.dim}Filtering: level >= ${options.level}${colors.reset}`);
  }
  if (options.task !== undefined) {
    console.log(`${colors.dim}Filtering: task #${options.task}${colors.reset}`);
  }
  if (options.grep) {
    console.log(`${colors.dim}Filtering: pattern "${options.grep}"${colors.reset}`);
  }

  console.log(`${colors.dim}Press Ctrl+C to stop${colors.reset}`);
  console.log(`${colors.dim}${horizontalLine(78)}${colors.reset}`);

  // Function to read new entries
  const readNewEntries = () => {
    if (!running) return;

    if (!existsSync(logFilePath)) {
      return;
    }

    try {
      const content = readFileSync(logFilePath, 'utf-8');
      const newContent = content.slice(lastPosition);
      lastPosition = content.length;

      if (newContent.trim()) {
        const newEntries = parseLogEntries(newContent);

        // Apply filters (but not limit for follow mode)
        const { filtered } = applyFilters(newEntries, { ...options, limit: undefined });

        for (const entry of filtered) {
          console.log(formatLogEntry(entry, false));
        }

        lastEntries = [...lastEntries, ...filtered].slice(-100); // Keep last 100 for context
      }
    } catch {
      // Ignore read errors
    }
  };

  // Initial read - show last few entries
  if (existsSync(logFilePath)) {
    const content = readTextFile(logFilePath);
    if (content) {
      const allEntries = parseLogEntries(content);
      const { filtered } = applyFilters(allEntries, { ...options, limit: 10 });

      if (filtered.length > 0) {
        console.log(`${colors.dim}--- Showing last ${filtered.length} entries ---${colors.reset}`);
        for (const entry of filtered) {
          console.log(formatLogEntry(entry, false));
        }
        console.log(`${colors.dim}--- Following new entries ---${colors.reset}`);
      }

      lastPosition = content.length;
      lastEntries = filtered;
    }
  }

  // Watch for changes
  watchFile(logFilePath, { interval: 500 }, () => {
    readNewEntries();
  });

  // Also poll periodically (in case watchFile misses events)
  const pollInterval = setInterval(() => {
    if (running) {
      readNewEntries();
    }
  }, 1000);

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

/**
 * List available log files
 */
export async function logsList(options: LogsListOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { configPath, chadgiDir } = resolveConfigPath(options.config, cwd);
  ensureChadgiDirExists(chadgiDir);

  // Load config
  const configContent = existsSync(configPath)
    ? readFileSync(configPath, 'utf-8')
    : '';

  // Find log files
  const logFiles = findLogFiles(chadgiDir, configContent);

  // Count entries in each file (if not too large)
  for (const file of logFiles) {
    if (file.size < 10 * 1024 * 1024) { // < 10MB
      const content = readTextFile(file.path);
      if (content) {
        file.entries = parseLogEntries(content).length;
      }
    }
  }

  // Output as JSON if requested
  if (options.json) {
    console.log(JSON.stringify({ files: logFiles }, null, 2));
    return;
  }

  // Display formatted list
  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('               CHADGI LOG FILES                           ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  if (logFiles.length === 0) {
    console.log(`${colors.yellow}No log files found.${colors.reset}`);
    console.log('');
    console.log('Log files will be created when ChadGI runs.');
    return;
  }

  console.log(`${colors.cyan}Found ${logFiles.length} log file(s)${colors.reset}`);
  console.log('');

  console.log(`${colors.cyan}${colors.bold}Log Files${colors.reset}`);
  console.log(`${colors.dim}${horizontalLine(78)}${colors.reset}`);

  for (const file of logFiles) {
    // Main log file doesn't have a numeric suffix like .1, .2, etc.
    const isMain = !/\.\d+$/.test(file.name);
    const marker = isMain ? `${colors.green}[current]${colors.reset}` : `${colors.dim}[rotated]${colors.reset}`;

    console.log(`${colors.bold}${file.name}${colors.reset} ${marker}`);
    console.log(`  Path:     ${file.path}`);
    console.log(`  Size:     ${formatBytes(file.size)}`);
    console.log(`  Modified: ${formatDate(file.modified)}`);
    if (file.entries !== undefined) {
      console.log(`  Entries:  ${file.entries}`);
    }
    console.log(`${colors.dim}${horizontalLine(78)}${colors.reset}`);
  }

  console.log('');
  console.log(`${colors.purple}${colors.bold}==========================================================`);
  console.log('               Chad does what Chad wants.');
  console.log(`==========================================================${colors.reset}`);
}

/**
 * Clear old log files
 */
export async function logsClear(options: LogsClearOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { configPath, chadgiDir } = resolveConfigPath(options.config, cwd);
  ensureChadgiDirExists(chadgiDir);

  // Load config
  const configContent = existsSync(configPath)
    ? readFileSync(configPath, 'utf-8')
    : '';

  // Find log files
  const logFiles = findLogFiles(chadgiDir, configContent);

  if (logFiles.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ deleted: [], kept: [] }, null, 2));
    } else {
      console.log(`${colors.green}No log files to clear.${colors.reset}`);
    }
    return;
  }

  // Determine which files to delete
  const keepLast = options.keepLast ?? 1;
  const filesToDelete: LogFileInfo[] = [];
  const filesToKeep: LogFileInfo[] = [];

  for (let i = 0; i < logFiles.length; i++) {
    if (i < keepLast) {
      filesToKeep.push(logFiles[i]);
    } else {
      filesToDelete.push(logFiles[i]);
    }
  }

  if (filesToDelete.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({
        deleted: [],
        kept: filesToKeep.map((f) => f.name),
      }, null, 2));
    } else {
      console.log(`${colors.green}No log files to delete (keeping ${keepLast} most recent).${colors.reset}`);
    }
    return;
  }

  // Confirm deletion
  if (!options.yes && !options.json) {
    console.log(`${colors.cyan}${colors.bold}Files to delete:${colors.reset}`);
    for (const file of filesToDelete) {
      console.log(`  ${file.name} (${formatBytes(file.size)})`);
    }
    console.log('');
    console.log(`${colors.cyan}Files to keep:${colors.reset}`);
    for (const file of filesToKeep) {
      console.log(`  ${file.name} (${formatBytes(file.size)})`);
    }
    console.log('');

    const confirmed = await promptConfirmation(
      `${colors.yellow}Delete ${filesToDelete.length} log file(s)?${colors.reset}`
    );
    if (!confirmed) {
      console.log(`${colors.dim}Cancelled.${colors.reset}`);
      return;
    }
  }

  // Delete files
  const deleted: string[] = [];
  const errors: string[] = [];

  for (const file of filesToDelete) {
    try {
      unlinkSync(file.path);
      deleted.push(file.name);
    } catch (error) {
      errors.push(`${file.name}: ${(error as Error).message}`);
    }
  }

  // Output result
  if (options.json) {
    console.log(JSON.stringify({
      deleted,
      kept: filesToKeep.map((f) => f.name),
      errors: errors.length > 0 ? errors : undefined,
    }, null, 2));
  } else {
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('               CHADGI LOGS CLEARED                        ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);

    if (deleted.length > 0) {
      console.log(`${colors.green}Deleted ${deleted.length} log file(s):${colors.reset}`);
      for (const name of deleted) {
        console.log(`  ${colors.dim}-${colors.reset} ${name}`);
      }
    }

    if (errors.length > 0) {
      console.log('');
      console.log(`${colors.red}Errors:${colors.reset}`);
      for (const err of errors) {
        console.log(`  ${colors.red}-${colors.reset} ${err}`);
      }
    }

    console.log('');
    console.log(`${colors.cyan}Kept ${filesToKeep.length} log file(s)${colors.reset}`);

    console.log('');
    console.log(`${colors.purple}${colors.bold}==========================================================`);
    console.log('               Chad does what Chad wants.');
    console.log(`==========================================================${colors.reset}`);
  }
}
