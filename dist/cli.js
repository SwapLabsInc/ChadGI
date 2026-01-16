#!/usr/bin/env node
import { Command } from 'commander';
import { init } from './init.js';
import { setup } from './setup.js';
import { start } from './start.js';
import { setupProject } from './setup-project.js';
import { stats } from './stats.js';
import { pause } from './pause.js';
import { resume } from './resume.js';
import { status } from './status.js';
import { watch } from './watch.js';
import { cleanup } from './cleanup.js';
import { estimate } from './estimate.js';
// Middleware-based commands (refactored for reduced boilerplate)
import { validateMiddleware } from './validate-middleware.js';
import { historyMiddleware } from './history-middleware.js';
import { insightsMiddleware } from './insights-middleware.js';
import { doctorMiddleware } from './doctor-middleware.js';
import { queueMiddleware } from './queue-middleware.js';
// Keep queue skip/promote from old module for now (will be migrated later)
import { queueSkip, queuePromote } from './queue.js';
import { configExport, configImport } from './config-export-import.js';
import { configMigrate, printMigrationHistory } from './config-migrate.js';
import { completion, getInstallationInstructions } from './completion.js';
import { replay, replayLast, replayAllFailed } from './replay.js';
import { diff } from './diff.js';
import { approve, reject } from './approve.js';
import { benchmark } from './benchmark.js';
import { logs, logsList, logsClear } from './logs.js';
import { version } from './version.js';
import { unlock } from './unlock.js';
import { workspaceInit, workspaceAdd, workspaceRemove, workspaceList, workspaceStatus, } from './workspace.js';
import { snapshotSave, snapshotRestore, snapshotList, snapshotDiff, snapshotDelete, } from './snapshot.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createNumericParser, validateNumeric } from './utils/validation.js';
import { colors } from './utils/colors.js';
import { wrapCommand, wrapCommandWithArg } from './utils/cli-error-handler.js';
import { initDebugFromEnv, enableVerbose, enableTrace, isVerbose, isTrace, } from './utils/debug.js';
import { addStandardOptions, validateOptionConflicts } from './utils/cli-options.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Get the full command name including parent commands for subcommands.
 * For example, "logs view" for the view subcommand of logs.
 *
 * @param command - The Commander command object
 * @returns Full command name (e.g., "cleanup", "logs view")
 */
function getFullCommandName(command) {
    const names = [];
    let current = command;
    while (current) {
        const name = current.name();
        // Stop at the root program (named 'chadgi')
        if (name === 'chadgi' || !name) {
            break;
        }
        names.unshift(name);
        current = current.parent;
    }
    return names.join(' ');
}
// Read version from package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const program = new Command();
// Initialize debug settings from environment variables first
initDebugFromEnv();
program
    .name('chadgi')
    .description('ChadGI - Autonomous Task Worker powered by Claude Code')
    .version(packageJson.version)
    .option('-v, --verbose', 'Enable verbose output for debugging')
    .option('--trace', 'Enable trace output (includes verbose, shows API payloads)')
    .hook('preAction', (thisCommand, actionCommand) => {
    // Apply global verbose/trace flags from CLI
    const opts = program.opts();
    if (opts.trace) {
        enableTrace();
    }
    else if (opts.verbose) {
        enableVerbose();
    }
    // Show verbose/trace status if enabled
    if (isTrace()) {
        console.error(`${colors.magenta}[TRACE]${colors.reset} Trace mode enabled - showing detailed API calls and timing`);
    }
    else if (isVerbose()) {
        console.error(`${colors.cyan}[DEBUG]${colors.reset} Verbose mode enabled - showing debug output`);
    }
    // Validate option conflicts for the command being executed
    // Build command name including parent for subcommands (e.g., "logs view")
    const commandName = getFullCommandName(actionCommand);
    const commandOpts = actionCommand.opts();
    // Also include positional arguments as options for conflict checking
    // (e.g., issueNumber from 'replay [issue-number]')
    const args = actionCommand.processedArgs || [];
    const optsWithArgs = { ...commandOpts };
    // Check if the command has a positional argument that looks like an issue number
    if (args.length > 0 && args[0] !== undefined) {
        // First positional arg is typically issue number for commands like replay, diff, unlock
        optsWithArgs.issueNumber = args[0];
    }
    const conflictResult = validateOptionConflicts(commandName, optsWithArgs);
    if (!conflictResult.valid) {
        for (const error of conflictResult.errors) {
            console.error(`${colors.red}Error:${colors.reset} ${error}`);
        }
        process.exit(1);
    }
});
program
    .command('version')
    .description('Display version information and check for updates')
    .option('-j, --json', 'Output version info as JSON')
    .option('-c, --check', 'Check npm registry for newer version')
    .action(wrapCommand(version));
program
    .command('init')
    .description('Initialize ChadGI in the current directory')
    .option('-f, --force', 'Overwrite existing configuration files')
    .action(wrapCommand(init));
program
    .command('setup')
    .description('Interactive configuration wizard for ChadGI')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-n, --non-interactive', 'Run with sensible defaults for CI environments')
    .option('-r, --reconfigure <section>', 'Reconfigure a specific section (github, branch, budget, notifications)')
    .action(wrapCommand(setup));
program
    .command('start')
    .description('Start the ChadGI automation loop')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-d, --dry-run', 'Run in dry-run mode - show what would happen without making changes')
    .option('-t, --timeout <minutes>', 'Override task timeout in minutes (0 = disabled)', createNumericParser('timeout', 'timeout'))
    .option('--debug', 'Enable debug log level (overrides config log_level)')
    .option('--ignore-deps', 'Process tasks regardless of dependency status')
    .option('-w, --workspace', 'Process tasks across all workspace repositories')
    .option('-r, --repo <name>', 'Process only a specific repository in workspace mode')
    .option('--parallel <n>', 'Process up to N tasks concurrently in workspace mode', createNumericParser('parallel', 'parallel'))
    .option('-i, --interactive', 'Enable human-in-the-loop approval mode for reviewing changes')
    .option('--no-mask', 'Disable secret masking in logs (warning: exposes sensitive data)')
    .option('--force-claim', 'Override stale task locks when claiming tasks')
    .option('--resume', 'Resume work on existing branch from interrupted session')
    .action(wrapCommand(start));
program
    .command('setup-project')
    .description('Create a GitHub Project v2 with the required Status field')
    .option('-r, --repo <owner/repo>', 'Repository to create project for')
    .option('-n, --name <name>', 'Project name (default: ChadGI Tasks)')
    .action(wrapCommand(setupProject));
program
    .command('validate')
    .description('Validate dependencies and configuration')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('--notify-test', 'Test webhook connectivity for configured notifications')
    .option('--strict', 'Treat unknown template variables as errors (exit with non-zero status)')
    .option('--show-merged', 'Display final merged config when using config inheritance')
    .option('--no-mask', 'Disable secret masking in output (warning: exposes sensitive data)')
    .option('-v, --verbose', 'Show detailed information including env var sources')
    .option('--env-prefix <prefix>', 'Custom environment variable prefix (default: CHADGI_)')
    .option('-j, --json', 'Output validation results as JSON')
    .action(wrapCommand(async (options) => {
    const result = await validateMiddleware(options);
    // Exit code based on validation success
    const isValid = result && (result.data === true || result.success === true);
    process.exit(isValid ? 0 : 1);
}));
program
    .command('stats')
    .description('View historical session statistics')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-l, --last <n>', 'Show only the last N sessions', createNumericParser('last', 'sessionCount'))
    .option('-j, --json', 'Output statistics as JSON')
    .action(wrapCommand(stats));
addStandardOptions(program
    .command('history')
    .description('View task execution history'), ['config', 'json', 'limit', 'since'])
    .option('--status <outcome>', 'Filter by outcome (success, failed, skipped)')
    .action(wrapCommand(historyMiddleware));
addStandardOptions(program
    .command('insights')
    .description('Display aggregated performance analytics and profiling'), ['config', 'json', 'days'])
    .option('-e, --export <path>', 'Export metrics data to file')
    .option('--category <type>', 'Filter insights by task category (e.g., bug, feature, refactor)')
    .action(wrapCommand(insightsMiddleware));
program
    .command('pause')
    .description('Pause ChadGI after the current task completes')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-f, --for <duration>', 'Auto-resume after duration (e.g., 30m, 2h)')
    .option('-r, --reason <reason>', 'Reason for pausing')
    .action(wrapCommand(pause));
program
    .command('resume')
    .description('Resume a paused ChadGI session')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('--restart', 'Start ChadGI if not currently running')
    .action(wrapCommand(resume));
addStandardOptions(program
    .command('status')
    .description('Show current ChadGI session state'), ['config', 'json']).action(wrapCommand(status));
program
    .command('watch')
    .description('Monitor a running ChadGI session in real-time')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output status as JSON (requires --once)')
    .option('-o, --once', 'Show current status once without auto-refresh')
    .option('-i, --interval <ms>', 'Refresh interval in milliseconds (default: 2000, min: 100)', createNumericParser('interval', 'interval'))
    .action(wrapCommand(watch));
addStandardOptions(program
    .command('doctor')
    .description('Run comprehensive health checks and diagnostics'), ['config', 'json'])
    .option('--fix', 'Auto-remediate simple issues (clear stale locks, etc.)')
    .option('--no-mask', 'Disable secret masking in output (warning: exposes sensitive data)')
    .action(wrapCommand(doctorMiddleware));
addStandardOptions(program
    .command('cleanup')
    .description('Clean up stale branches, old diagnostics, and rotated log files'), ['config', 'json', 'dryRun', 'yes', 'days'])
    .option('--branches', 'Delete orphaned feature branches (local and remote)')
    .option('--diagnostics', 'Remove diagnostic artifacts older than N days')
    .option('--logs', 'Remove rotated log files beyond retention limit')
    .option('--all', 'Run all cleanup operations')
    .action(wrapCommand(cleanup));
program
    .command('estimate')
    .description('Estimate API costs for tasks in the Ready queue')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output estimate as JSON')
    .option('-b, --budget <amount>', 'Show how many tasks fit within budget', createNumericParser('budget', 'budget'))
    .option('-d, --days <n>', 'Use only historical data from the last N days', createNumericParser('days', 'days'))
    .option('--category <type>', 'Filter estimates by task category (e.g., bug, feature, refactor)')
    .action(wrapCommand(estimate));
// Logs command with subcommands
const logsCommand = program
    .command('logs')
    .description('View and manage ChadGI execution logs');
logsCommand
    .command('view', { isDefault: true })
    .description('View execution logs (default)')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-l, --limit <n>', 'Number of entries to show (default: 100)', createNumericParser('limit', 'limit'))
    .option('-s, --since <time>', 'Show logs since (e.g., 1h, 7d, 2w, 2024-01-01)')
    .option('-f, --follow', 'Follow log file in real-time (like tail -f)')
    .option('--level <level>', 'Filter by log level (debug, info, warn, error)')
    .option('-t, --task <n>', 'Filter logs for specific task/issue number', createNumericParser('task', 'issueNumber'))
    .option('-g, --grep <pattern>', 'Filter lines by regex pattern')
    .option('-j, --json', 'Output logs as JSON')
    .action(wrapCommand(logs));
logsCommand
    .command('list')
    .description('List available log files')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output as JSON')
    .action(wrapCommand(logsList));
logsCommand
    .command('clear')
    .description('Remove old log files')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output as JSON')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-k, --keep-last <n>', 'Keep N most recent log files (default: 1)', createNumericParser('keep-last', 'limit'))
    .action(wrapCommand(logsClear));
// Queue command with subcommands
const queueCommand = program
    .command('queue')
    .description('View and manage the task queue');
addStandardOptions(queueCommand
    .command('list', { isDefault: true })
    .description('List tasks in the Ready column'), ['config', 'json', 'limit']).action(wrapCommand(queueMiddleware));
queueCommand
    .command('skip <issue-number>')
    .description('Move a task back to Backlog')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output result as JSON')
    .action(wrapCommandWithArg(async (issueNumber, options) => {
    const result = validateNumeric(issueNumber, 'issue-number', 'issueNumber');
    if (!result.valid) {
        console.error(`${colors.red}Error: ${result.error}${colors.reset}`);
        process.exit(1);
    }
    await queueSkip({ ...options, issueNumber: result.value });
}));
queueCommand
    .command('promote <issue-number>')
    .description('Move a task to the front of the queue')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output result as JSON')
    .action(wrapCommandWithArg(async (issueNumber, options) => {
    const result = validateNumeric(issueNumber, 'issue-number', 'issueNumber');
    if (!result.valid) {
        console.error(`${colors.red}Error: ${result.error}${colors.reset}`);
        process.exit(1);
    }
    await queuePromote({ ...options, issueNumber: result.value });
}));
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
    .action(wrapCommand(async (options) => {
    if (options?.format && !['json', 'yaml'].includes(options.format)) {
        console.error('Error: Format must be "json" or "yaml"');
        process.exit(1);
    }
    await configExport(options);
}));
configCommand
    .command('import <file>')
    .description('Import configuration from an exported bundle')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-m, --merge', 'Merge imported config with existing (instead of replacing)')
    .option('-d, --dry-run', 'Preview changes without writing files')
    .action(wrapCommandWithArg(async (file, options) => {
    await configImport({ ...options, file });
}));
configCommand
    .command('migrate')
    .description('Migrate configuration to the latest schema version')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-d, --dry-run', 'Preview migrations without applying changes')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('--rollback', 'Restore configuration from the most recent backup')
    .action(wrapCommand(configMigrate));
configCommand
    .command('history')
    .description('View migration history for the configuration')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .action(wrapCommand(printMigrationHistory));
// Completion command with subcommands for each shell
const completionCommand = program
    .command('completion')
    .description('Generate shell completion scripts');
completionCommand
    .command('bash')
    .description('Generate Bash completion script')
    .action(wrapCommand(async () => completion('bash')));
completionCommand
    .command('zsh')
    .description('Generate Zsh completion script')
    .action(wrapCommand(async () => completion('zsh')));
completionCommand
    .command('fish')
    .description('Generate Fish completion script')
    .action(wrapCommand(async () => completion('fish')));
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
    .action(wrapCommandWithArg(async (issueNumberArg, options) => {
    if (options?.last) {
        await replayLast(options);
    }
    else if (options?.allFailed) {
        await replayAllFailed(options);
    }
    else if (issueNumberArg) {
        const result = validateNumeric(issueNumberArg, 'issue-number', 'issueNumber');
        if (!result.valid) {
            console.error(`${colors.red}Error: ${result.error}${colors.reset}`);
            process.exit(1);
        }
        await replay(result.value, options);
    }
    else {
        // No arguments - show list of failed tasks
        await replay(undefined, options);
    }
}));
// Diff command for previewing pending PR changes
program
    .command('diff [issue-number]')
    .description('Preview pending PR changes for a task')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output diff data as JSON')
    .option('-s, --stat', 'Show condensed file statistics view')
    .option('-f, --files', 'List only the modified files')
    .option('-p, --pr <number>', 'Show diff from an existing PR', createNumericParser('pr', 'issueNumber'))
    .option('-o, --output <file>', 'Save diff to a file')
    .action(wrapCommandWithArg(async (issueNumberArg, options) => {
    if (options?.pr !== undefined) {
        // --pr flag takes precedence
        await diff(undefined, options);
    }
    else if (issueNumberArg) {
        const result = validateNumeric(issueNumberArg, 'issue-number', 'issueNumber');
        if (!result.valid) {
            console.error(`${colors.red}Error: ${result.error}${colors.reset}`);
            process.exit(1);
        }
        await diff(result.value, options);
    }
    else {
        // No arguments - show diff for current branch
        await diff(undefined, options);
    }
}));
// Approve command for interactive approval mode
program
    .command('approve [issue-number]')
    .description('Approve a pending task in interactive mode')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-m, --message <message>', 'Add an approval comment or feedback')
    .option('-j, --json', 'Output result as JSON')
    .action(wrapCommandWithArg(async (issueNumberArg, options) => {
    let issueNumber;
    if (issueNumberArg) {
        const result = validateNumeric(issueNumberArg, 'issue-number', 'issueNumber');
        if (!result.valid) {
            console.error(`${colors.red}Error: ${result.error}${colors.reset}`);
            process.exit(1);
        }
        issueNumber = result.value;
    }
    await approve({ ...options, issueNumber });
}));
// Reject command for interactive approval mode
program
    .command('reject [issue-number]')
    .description('Reject a pending task in interactive mode')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-m, --message <message>', 'Add a rejection reason or feedback for Claude')
    .option('-j, --json', 'Output result as JSON')
    .option('--skip', 'Move task back to Ready column instead of keeping in progress')
    .action(wrapCommandWithArg(async (issueNumberArg, options) => {
    let issueNumber;
    if (issueNumberArg) {
        const result = validateNumeric(issueNumberArg, 'issue-number', 'issueNumber');
        if (!result.valid) {
            console.error(`${colors.red}Error: ${result.error}${colors.reset}`);
            process.exit(1);
        }
        issueNumber = result.value;
    }
    await reject({ ...options, issueNumber });
}));
// Unlock command for manual lock release
program
    .command('unlock [issue-number]')
    .description('Manually release task locks')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output result as JSON')
    .option('-a, --all', 'Release all locks (use with --force for active locks)')
    .option('-s, --stale', 'Release only stale locks')
    .option('-f, --force', 'Force release of active locks')
    .action(wrapCommandWithArg(async (issueNumberArg, options) => {
    let issueNumber;
    if (issueNumberArg) {
        const result = validateNumeric(issueNumberArg, 'issue-number', 'issueNumber');
        if (!result.valid) {
            console.error(`${colors.red}Error: ${result.error}${colors.reset}`);
            process.exit(1);
        }
        issueNumber = result.value;
    }
    await unlock(issueNumber, options);
}));
// Workspace command with subcommands for multi-repo support
const workspaceCommand = program
    .command('workspace')
    .description('Manage multi-repo workspace configuration');
workspaceCommand
    .command('init')
    .description('Initialize a multi-repo workspace')
    .option('-c, --config <path>', 'Path to workspace config (default: ./.chadgi/workspace.yaml)')
    .option('-f, --force', 'Overwrite existing workspace configuration')
    .option('-n, --name <name>', 'Workspace name')
    .action(wrapCommand(workspaceInit));
workspaceCommand
    .command('add <repo>')
    .description('Add a repository to the workspace')
    .option('-c, --config <path>', 'Path to workspace config (default: ./.chadgi/workspace.yaml)')
    .option('-p, --path <path>', 'Local path for the repository')
    .option('--remote <url>', 'Git remote URL for cloning')
    .option('--priority <n>', 'Processing priority (lower = higher priority)', createNumericParser('priority', 'priority'))
    .option('--disabled', 'Add repository in disabled state')
    .action(wrapCommandWithArg(async (repo, options) => {
    await workspaceAdd(repo, {
        ...options,
        enabled: !options?.disabled,
    });
}));
workspaceCommand
    .command('remove <repo>')
    .description('Remove a repository from the workspace')
    .option('-c, --config <path>', 'Path to workspace config (default: ./.chadgi/workspace.yaml)')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(wrapCommandWithArg(workspaceRemove));
workspaceCommand
    .command('list', { isDefault: true })
    .description('List all configured repositories')
    .option('-c, --config <path>', 'Path to workspace config (default: ./.chadgi/workspace.yaml)')
    .option('-j, --json', 'Output as JSON')
    .action(wrapCommand(workspaceList));
workspaceCommand
    .command('status')
    .description('Show combined queue view across all workspace repositories')
    .option('-c, --config <path>', 'Path to workspace config (default: ./.chadgi/workspace.yaml)')
    .option('-j, --json', 'Output as JSON')
    .option('-l, --limit <n>', 'Limit number of tasks shown', createNumericParser('limit', 'limit'))
    .action(wrapCommand(workspaceStatus));
// Benchmark command for measuring Claude performance
program
    .command('benchmark')
    .description('Run benchmarks to measure Claude performance on standardized tasks')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output results as JSON')
    .option('-q, --quick', 'Run quick benchmark suite (default, 3 tasks)')
    .option('-f, --full', 'Run full benchmark suite (all standard + custom tasks)')
    .option('-m, --model <model>', 'Test against specific Claude model (e.g., claude-3-opus)')
    .option('-t, --tasks <ids>', 'Run specific tasks by ID (comma-separated)')
    .option('-o, --output <file>', 'Save markdown report to file')
    .option('--compare <run-id>', 'Compare results with a specific previous run')
    .option('-l, --list', 'List available benchmark tasks')
    .option('-i, --iterations <n>', 'Number of iterations to run each task', createNumericParser('iterations', 'iterations'))
    .option('--timeout <seconds>', 'Override task timeout in seconds', createNumericParser('timeout', 'timeout'))
    .option('-d, --dry-run', 'Simulate benchmark run without calling Claude')
    .action(wrapCommand(benchmark));
// Snapshot command with subcommands for configuration state management
const snapshotCommand = program
    .command('snapshot')
    .description('Save and restore configuration states');
snapshotCommand
    .command('save <name>')
    .description('Save current configuration as a named snapshot')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-d, --description <text>', 'Add a description to the snapshot')
    .option('-a, --alias <alias>', 'Set an alias for quick reference')
    .action(wrapCommandWithArg(snapshotSave));
snapshotCommand
    .command('restore <name>')
    .description('Restore configuration from a saved snapshot')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-f, --force', 'Overwrite without prompting for confirmation')
    .action(wrapCommandWithArg(snapshotRestore));
snapshotCommand
    .command('list', { isDefault: true })
    .description('List all saved snapshots with metadata')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output snapshots as JSON')
    .action(wrapCommand(snapshotList));
snapshotCommand
    .command('diff <name>')
    .description('Compare current configuration with a snapshot')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-j, --json', 'Output diff as JSON')
    .action(wrapCommandWithArg(snapshotDiff));
snapshotCommand
    .command('delete <name>')
    .description('Delete a saved snapshot')
    .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
    .option('-f, --force', 'Delete without prompting for confirmation')
    .action(wrapCommandWithArg(snapshotDelete));
program.parse();
//# sourceMappingURL=cli.js.map