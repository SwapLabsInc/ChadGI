#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './init.js';
import { setup } from './setup.js';
import { start } from './start.js';
import { setupProject } from './setup-project.js';
import { validate } from './validate.js';
import { stats } from './stats.js';
import { history } from './history.js';
import { insights } from './insights.js';
import { pause } from './pause.js';
import { resume } from './resume.js';
import { status } from './status.js';
import { watch } from './watch.js';
import { doctor } from './doctor.js';
import { cleanup } from './cleanup.js';
import { estimate } from './estimate.js';
import { queue, queueSkip, queuePromote } from './queue.js';
import { configExport, configImport } from './config-export-import.js';
import { completion, getInstallationInstructions } from './completion.js';
import { replay, replayLast, replayAllFailed } from './replay.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

program
  .name('chadgi')
  .description('ChadGI - Autonomous Task Worker powered by Claude Code')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize ChadGI in the current directory')
  .option('-f, --force', 'Overwrite existing configuration files')
  .action(async (options) => {
    try {
      await init(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Interactive configuration wizard for ChadGI')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-n, --non-interactive', 'Run with sensible defaults for CI environments')
  .option('-r, --reconfigure <section>', 'Reconfigure a specific section (github, branch, budget, notifications)')
  .action(async (options) => {
    try {
      await setup(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Start the ChadGI automation loop')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-d, --dry-run', 'Run in dry-run mode - show what would happen without making changes')
  .option('-t, --timeout <minutes>', 'Override task timeout in minutes (0 = disabled)', parseInt)
  .option('--debug', 'Enable debug log level (overrides config log_level)')
  .option('--ignore-deps', 'Process tasks regardless of dependency status')
  .action(async (options) => {
    try {
      await start(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('setup-project')
  .description('Create a GitHub Project v2 with the required Status field')
  .option('-r, --repo <owner/repo>', 'Repository to create project for')
  .option('-n, --name <name>', 'Project name (default: ChadGI Tasks)')
  .action(async (options) => {
    try {
      await setupProject(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate dependencies and configuration')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('--notify-test', 'Test webhook connectivity for configured notifications')
  .option('--strict', 'Treat unknown template variables as errors (exit with non-zero status)')
  .option('--show-merged', 'Display final merged config when using config inheritance')
  .action(async (options) => {
    try {
      const isValid = await validate(options);
      process.exit(isValid ? 0 : 1);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('View historical session statistics')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-l, --last <n>', 'Show only the last N sessions', parseInt)
  .option('-j, --json', 'Output statistics as JSON')
  .action(async (options) => {
    try {
      await stats(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('View task execution history')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-l, --limit <n>', 'Number of entries to show (default: 10)', parseInt)
  .option('-s, --since <time>', 'Show tasks since (e.g., 7d, 2w, 1m, 2024-01-01)')
  .option('--status <outcome>', 'Filter by outcome (success, failed, skipped)')
  .option('-j, --json', 'Output history as JSON')
  .action(async (options) => {
    try {
      await history(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('insights')
  .description('Display aggregated performance analytics and profiling')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output insights as JSON')
  .option('-e, --export <path>', 'Export metrics data to file')
  .option('-d, --days <n>', 'Show only data from the last N days', parseInt)
  .option('--category <type>', 'Filter insights by task category (e.g., bug, feature, refactor)')
  .action(async (options) => {
    try {
      await insights(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('pause')
  .description('Pause ChadGI after the current task completes')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-f, --for <duration>', 'Auto-resume after duration (e.g., 30m, 2h)')
  .option('-r, --reason <reason>', 'Reason for pausing')
  .action(async (options) => {
    try {
      await pause(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume a paused ChadGI session')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('--restart', 'Start ChadGI if not currently running')
  .action(async (options) => {
    try {
      await resume(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current ChadGI session state')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output status as JSON')
  .action(async (options) => {
    try {
      await status(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Monitor a running ChadGI session in real-time')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output status as JSON (requires --once)')
  .option('-o, --once', 'Show current status once without auto-refresh')
  .option('-i, --interval <ms>', 'Refresh interval in milliseconds (default: 2000)', parseInt)
  .action(async (options) => {
    try {
      await watch(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('Run comprehensive health checks and diagnostics')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output health report as JSON')
  .option('--fix', 'Auto-remediate simple issues (clear stale locks, etc.)')
  .action(async (options) => {
    try {
      await doctor(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Clean up stale branches, old diagnostics, and rotated log files')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('--branches', 'Delete orphaned feature branches (local and remote)')
  .option('--diagnostics', 'Remove diagnostic artifacts older than N days')
  .option('--logs', 'Remove rotated log files beyond retention limit')
  .option('--all', 'Run all cleanup operations')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('--yes', 'Skip confirmation prompts')
  .option('--days <n>', 'Retention days for diagnostics (default: 30)', parseInt)
  .option('-j, --json', 'Output results as JSON')
  .action(async (options) => {
    try {
      await cleanup(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('estimate')
  .description('Estimate API costs for tasks in the Ready queue')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output estimate as JSON')
  .option('-b, --budget <amount>', 'Show how many tasks fit within budget', parseFloat)
  .option('-d, --days <n>', 'Use only historical data from the last N days', parseInt)
  .option('--category <type>', 'Filter estimates by task category (e.g., bug, feature, refactor)')
  .action(async (options) => {
    try {
      await estimate(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Queue command with subcommands
const queueCommand = program
  .command('queue')
  .description('View and manage the task queue');

queueCommand
  .command('list', { isDefault: true })
  .description('List tasks in the Ready column')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output queue as JSON')
  .option('-l, --limit <n>', 'Show only the first N tasks', parseInt)
  .action(async (options) => {
    try {
      await queue(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

queueCommand
  .command('skip <issue-number>')
  .description('Move a task back to Backlog')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output result as JSON')
  .action(async (issueNumber: string, options) => {
    try {
      const num = parseInt(issueNumber, 10);
      if (isNaN(num)) {
        console.error('Error: Issue number must be a valid number');
        process.exit(1);
      }
      await queueSkip({ ...options, issueNumber: num });
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

queueCommand
  .command('promote <issue-number>')
  .description('Move a task to the front of the queue')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output result as JSON')
  .action(async (issueNumber: string, options) => {
    try {
      const num = parseInt(issueNumber, 10);
      if (isNaN(num)) {
        console.error('Error: Issue number must be a valid number');
        process.exit(1);
      }
      await queuePromote({ ...options, issueNumber: num });
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Config command with subcommands
const configCommand = program
  .command('config')
  .description('Manage ChadGI configuration');

configCommand
  .command('export')
  .description('Export configuration to a portable format for sharing')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-e, --exclude-secrets', 'Strip webhook URLs and sensitive data from export')
  .option('-o, --output <file>', 'Output file path (default: stdout)')
  .option('-f, --format <format>', 'Output format: json or yaml (default: json)', 'json')
  .action(async (options) => {
    try {
      if (options.format && !['json', 'yaml'].includes(options.format)) {
        console.error('Error: Format must be "json" or "yaml"');
        process.exit(1);
      }
      await configExport(options);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

configCommand
  .command('import <file>')
  .description('Import configuration from an exported bundle')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-m, --merge', 'Merge imported config with existing (instead of replacing)')
  .option('-d, --dry-run', 'Preview changes without writing files')
  .action(async (file: string, options) => {
    try {
      await configImport({ ...options, file });
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Completion command with subcommands for each shell
const completionCommand = program
  .command('completion')
  .description('Generate shell completion scripts');

completionCommand
  .command('bash')
  .description('Generate Bash completion script')
  .action(async () => {
    try {
      await completion('bash');
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

completionCommand
  .command('zsh')
  .description('Generate Zsh completion script')
  .action(async () => {
    try {
      await completion('zsh');
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

completionCommand
  .command('fish')
  .description('Generate Fish completion script')
  .action(async () => {
    try {
      await completion('fish');
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

completionCommand
  .command('install-instructions')
  .description('Show installation instructions for all shells')
  .action(() => {
    console.log(getInstallationInstructions());
  });

// Replay command for retrying failed tasks
program
  .command('replay [issue-number]')
  .description('Retry failed tasks')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-j, --json', 'Output results as JSON')
  .option('--last', 'Retry the most recent failed task')
  .option('--all-failed', 'Retry all failed tasks from the last session')
  .option('--fresh', 'Start from a clean branch (discard previous work)')
  .option('--continue', 'Continue from where the task left off')
  .option('--dry-run', 'Preview what would happen without making changes')
  .option('--yes', 'Skip confirmation prompts')
  .action(async (issueNumberArg: string | undefined, options) => {
    try {
      if (options.last) {
        await replayLast(options);
      } else if (options.allFailed) {
        await replayAllFailed(options);
      } else if (issueNumberArg) {
        const num = parseInt(issueNumberArg, 10);
        if (isNaN(num)) {
          console.error('Error: Issue number must be a valid number');
          process.exit(1);
        }
        await replay(num, options);
      } else {
        // No arguments - show list of failed tasks
        await replay(undefined, options);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
