import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess, execSync } from 'child_process';
import { validate } from './validate.js';
import { hasPendingMigrations, getMigrationStatusMessage } from './config-migrate.js';
import {
  getWorkspaceConfigPath,
  loadWorkspaceConfig,
  validateRepoPath,
  WorkspaceConfig,
  WorkspaceRepoConfig,
} from './workspace.js';
import { setMaskingDisabled } from './utils/secrets.js';
import { colors } from './utils/colors.js';
import { atomicWriteJson } from './utils/fileOps.js';
import {
  initTelemetry,
  isTelemetryEnabled,
  startTaskSpan,
  endSpanSuccess,
  endSpanError,
  recordTaskCompletion,
  withSpanAsync,
} from './utils/telemetry.js';
import { loadConfig } from './utils/config.js';
import type { ProgressData, ParallelWorkerTask, ParallelSessionProgress, TelemetryConfig } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StartOptions {
  config?: string;
  dryRun?: boolean;
  timeout?: number;
  debug?: boolean;
  ignoreDeps?: boolean;
  workspace?: boolean;
  repo?: string;
  parallel?: number;
  interactive?: boolean;
  mask?: boolean;  // --no-mask flag sets this to false
  forceClaim?: boolean;  // --force-claim flag to override stale locks
  resume?: boolean;  // --resume flag to continue interrupted task
}

interface WorkerInfo {
  id: number;
  repoName: string;
  repoPath: string;
  worktreePath: string;
  process: ChildProcess | null;
  status: 'idle' | 'in_progress' | 'completed' | 'failed';
  costUsd: number;
  tasksCompleted: number;
  startedAt?: string;
}

export async function start(options: StartOptions = {}): Promise<void> {
  // Check for root user - Claude CLI blocks --dangerously-skip-permissions with root
  if (process.getuid && process.getuid() === 0) {
    // Try to find chadgi user and re-exec as that user
    try {
      execSync('id chadgi', { stdio: 'pipe' });
      // chadgi user exists, re-exec as that user
      console.log(`${colors.yellow}Running as root - switching to 'chadgi' user...${colors.reset}\n`);
      const args = process.argv.slice(2);
      const chadgiPath = process.argv[1];
      const child = spawn('runuser', ['-u', 'chadgi', '--', process.argv[0], chadgiPath, ...args], {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      child.on('close', (code) => process.exit(code ?? 0));
      child.on('error', () => {
        console.error(`${colors.red}Failed to switch to chadgi user${colors.reset}`);
        process.exit(1);
      });
      return; // Exit this process, let the child run
    } catch {
      // chadgi user doesn't exist, show error
      console.error(`${colors.red}${colors.bold}ERROR: ChadGI cannot run as root/sudo${colors.reset}\n`);
      console.error(`Claude Code's --dangerously-skip-permissions flag is blocked when running`);
      console.error(`with root/sudo privileges for security reasons.\n`);
      console.error(`Solutions:`);
      console.error(`  1. Run as a non-root user: ${colors.cyan}su - myuser -c 'chadgi start'${colors.reset}`);
      console.error(`  2. Create a dedicated user: ${colors.cyan}useradd -m chadgi && su - chadgi${colors.reset}\n`);
      process.exit(1);
    }
  }

  // Handle --no-mask flag (Commander sets mask=false when --no-mask is used)
  const noMask = options.mask === false;
  if (noMask) {
    setMaskingDisabled(true);
    console.log(`${colors.yellow}WARNING: Secret masking is DISABLED. Sensitive data may be exposed in logs.${colors.reset}\n`);
  }

  // Check for workspace mode
  if (options.workspace) {
    await startWorkspace(options);
    return;
  }

  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const dryRun = options.dryRun ?? false;
  const timeout = options.timeout;
  const debugMode = options.debug ?? false;
  const ignoreDeps = options.ignoreDeps ?? false;
  const interactiveMode = options.interactive ?? false;
  const forceClaim = options.forceClaim ?? false;

  if (interactiveMode) {
    console.log('Starting ChadGI in INTERACTIVE mode...\n');
    console.log('  [INTERACTIVE] Human-in-the-loop approval enabled');
    console.log('  [INTERACTIVE] Will pause for approval before PR creation');
    console.log('  [INTERACTIVE] Use Ctrl+C or keyboard shortcuts to respond\n');
  } else if (dryRun) {
    console.log('Starting ChadGI in DRY-RUN mode...\n');
    console.log('  [DRY-RUN] No changes will be made to GitHub or git');
    console.log('  [DRY-RUN] Tasks will be read but not moved');
    console.log('  [DRY-RUN] Claude will explore but not execute write operations');
    console.log('  [DRY-RUN] Will exit after processing one task\n');
  } else {
    console.log('Starting ChadGI automation loop...\n');
  }

  if (timeout !== undefined) {
    if (timeout === 0) {
      console.log('Task timeout: DISABLED (via --timeout flag)\n');
    } else {
      console.log(`Task timeout: ${timeout} minutes (via --timeout flag)\n`);
    }
  }

  if (debugMode) {
    console.log('Debug mode: ENABLED (log level set to DEBUG)\n');
  }

  if (ignoreDeps) {
    console.log('Dependency checking: DISABLED (via --ignore-deps flag)\n');
  }

  if (options.resume) {
    console.log('Resume mode: ENABLED (will continue on existing branch from progress file)\n');
  }

  // Check for pending migrations
  if (hasPendingMigrations(configPath)) {
    const migrationMessage = getMigrationStatusMessage(configPath);
    console.log(`${colors.yellow}Warning:${colors.reset} ${migrationMessage}\n`);
  }

  // Validate configuration first
  console.log('Validating configuration...');
  const isValid = await validate({ config: configPath, quiet: true });

  if (!isValid) {
    console.log('\nConfiguration validation failed. Please fix the issues above and try again.');
    console.log('Run `chadgi validate` for more details.\n');
    process.exit(1);
  }
  console.log('Configuration valid!\n');

  // Initialize telemetry with config file settings
  try {
    const config = loadConfig(configPath);
    if (config.exists && config.content) {
      // Parse telemetry config from YAML content
      const telemetryEnabled = config.content.match(/telemetry:\s*\n\s+enabled:\s*true/);
      if (telemetryEnabled) {
        const traceExporterMatch = config.content.match(/telemetry:[\s\S]*?trace_exporter:\s*(\w+)/);
        const metricsExporterMatch = config.content.match(/telemetry:[\s\S]*?metrics_exporter:\s*(\w+)/);
        const otlpEndpointMatch = config.content.match(/telemetry:[\s\S]*?otlp_endpoint:\s*["']?([^"'\n]+)/);
        const prometheusPortMatch = config.content.match(/telemetry:[\s\S]*?prometheus_port:\s*(\d+)/);
        const serviceNameMatch = config.content.match(/telemetry:[\s\S]*?service_name:\s*["']?([^"'\n]+)/);
        const logCorrelationMatch = config.content.match(/telemetry:[\s\S]*?log_correlation:\s*true/);
        const samplingRatioMatch = config.content.match(/telemetry:[\s\S]*?sampling_ratio:\s*([\d.]+)/);

        const telemetryConfig: TelemetryConfig = {
          enabled: true,
          trace_exporter: (traceExporterMatch?.[1] || 'none') as TelemetryConfig['trace_exporter'],
          metrics_exporter: (metricsExporterMatch?.[1] || 'none') as TelemetryConfig['metrics_exporter'],
          otlp_endpoint: otlpEndpointMatch?.[1]?.trim(),
          prometheus_port: prometheusPortMatch ? parseInt(prometheusPortMatch[1], 10) : undefined,
          service_name: serviceNameMatch?.[1]?.trim(),
          log_correlation: !!logCorrelationMatch,
          sampling_ratio: samplingRatioMatch ? parseFloat(samplingRatioMatch[1]) : undefined,
        };

        const telemetryInitialized = initTelemetry(telemetryConfig);
        if (telemetryInitialized && isTelemetryEnabled()) {
          console.log(`${colors.dim}Telemetry: ENABLED (${telemetryConfig.trace_exporter} traces, ${telemetryConfig.metrics_exporter} metrics)${colors.reset}\n`);
        }
      }
    }
  } catch (e) {
    // Non-fatal: telemetry initialization failure shouldn't stop the session
    console.error(`${colors.yellow}Warning: Failed to initialize telemetry: ${(e as Error).message}${colors.reset}\n`);
  }

  // Determine the chadgi directory from config path
  const chadgiDir = dirname(configPath);

  // Find the bash script
  const scriptPath = join(__dirname, '..', 'scripts', 'chadgi.sh');

  if (!existsSync(scriptPath)) {
    console.error(`Error: Could not find chadgi.sh script at ${scriptPath}`);
    process.exit(1);
  }

  // Set up environment variables
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CHADGI_DIR: chadgiDir,
    CONFIG_FILE: configPath,
    DRY_RUN: dryRun ? 'true' : 'false',
    DEBUG_MODE: debugMode ? 'true' : 'false',
    IGNORE_DEPS: ignoreDeps ? 'true' : 'false',
    INTERACTIVE_MODE: interactiveMode ? 'true' : 'false',
    NO_MASK: noMask ? 'true' : 'false',
    FORCE_CLAIM: forceClaim ? 'true' : 'false',
    RESUME_MODE: options.resume ? 'true' : 'false',
  };

  // Add timeout override if specified via CLI
  if (timeout !== undefined) {
    env.TASK_TIMEOUT = String(timeout);
  }

  // Spawn the bash script
  const child = spawn('bash', [scriptPath], {
    env,
    cwd,
    stdio: 'inherit'  // Inherit stdio to show output directly
  });

  // Handle process exit
  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  // Handle signals
  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}

// Run a single repo task and return exit code
function runRepoTask(
  repoPath: string,
  configPath: string,
  options: StartOptions
): Promise<number> {
  return new Promise((resolve) => {
    const scriptPath = join(__dirname, '..', 'scripts', 'chadgi.sh');
    const chadgiDir = dirname(configPath);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CHADGI_DIR: chadgiDir,
      CONFIG_FILE: configPath,
      DRY_RUN: options.dryRun ? 'true' : 'false',
      DEBUG_MODE: options.debug ? 'true' : 'false',
      IGNORE_DEPS: options.ignoreDeps ? 'true' : 'false',
      INTERACTIVE_MODE: options.interactive ? 'true' : 'false',
      NO_MASK: options.mask === false ? 'true' : 'false',
      FORCE_CLAIM: options.forceClaim ? 'true' : 'false',
      RESUME_MODE: options.resume ? 'true' : 'false',
      WORKSPACE_MODE: 'true',
      WORKSPACE_SINGLE_TASK: 'true', // Process only one task then exit
    };

    if (options.timeout !== undefined) {
      env.TASK_TIMEOUT = String(options.timeout);
    }

    const child = spawn('bash', [scriptPath], {
      env,
      cwd: repoPath,
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });

    child.on('error', () => {
      resolve(1);
    });
  });
}

// Workspace mode: process tasks across multiple repositories
async function startWorkspace(options: StartOptions): Promise<void> {
  const cwd = process.cwd();
  const workspaceConfigPath = getWorkspaceConfigPath({ config: options.config });

  console.log(`\n${colors.bold}${colors.magenta}==========================================================`);
  console.log(`                CHADGI WORKSPACE MODE`);
  console.log(`==========================================================${colors.reset}\n`);

  // Load workspace configuration
  const workspaceConfig = loadWorkspaceConfig(workspaceConfigPath);
  if (!workspaceConfig) {
    console.error(`${colors.red}Error:${colors.reset} Workspace not initialized.`);
    console.log(`Run ${colors.cyan}chadgi workspace init${colors.reset} first.`);
    process.exit(1);
  }

  console.log(`${colors.cyan}Workspace:${colors.reset} ${workspaceConfig.name || 'Unnamed'}`);
  console.log(`${colors.cyan}Strategy:${colors.reset} ${workspaceConfig.strategy}`);

  // Get enabled repositories
  const enabledRepos = Object.entries(workspaceConfig.repos)
    .filter(([, config]) => config.enabled !== false);

  if (enabledRepos.length === 0) {
    console.error(`${colors.red}Error:${colors.reset} No enabled repositories in workspace.`);
    console.log(`Add repositories with ${colors.cyan}chadgi workspace add <repo>${colors.reset}`);
    process.exit(1);
  }

  // Filter by specific repo if provided
  let reposToProcess = enabledRepos;
  if (options.repo) {
    reposToProcess = enabledRepos.filter(([name]) =>
      name === options.repo || name.endsWith('/' + options.repo)
    );
    if (reposToProcess.length === 0) {
      console.error(`${colors.red}Error:${colors.reset} Repository not found: ${options.repo}`);
      console.log(`\nAvailable repositories:`);
      for (const [name] of enabledRepos) {
        console.log(`  - ${name}`);
      }
      process.exit(1);
    }
  }

  console.log(`${colors.cyan}Repositories:${colors.reset} ${reposToProcess.length}`);

  // Sort by priority
  reposToProcess.sort((a, b) => {
    const priorityA = a[1].priority ?? 999;
    const priorityB = b[1].priority ?? 999;
    return priorityA - priorityB;
  });

  // Validate all repositories
  console.log(`\n${colors.dim}Validating repositories...${colors.reset}`);
  const validRepos: Array<[string, WorkspaceRepoConfig]> = [];

  for (const [name, config] of reposToProcess) {
    const validation = validateRepoPath(config.path);
    if (validation.valid) {
      const configPath = join(config.path, '.chadgi', 'chadgi-config.yaml');
      const isValid = await validate({ config: configPath, quiet: true });
      if (isValid) {
        validRepos.push([name, config]);
        console.log(`  ${colors.green}✓${colors.reset} ${name}`);
      } else {
        console.log(`  ${colors.red}✗${colors.reset} ${name} - invalid configuration`);
      }
    } else {
      console.log(`  ${colors.red}✗${colors.reset} ${name} - ${validation.error}`);
    }
  }

  if (validRepos.length === 0) {
    console.error(`\n${colors.red}Error:${colors.reset} No valid repositories to process.`);
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(`\n${colors.yellow}DRY-RUN mode enabled${colors.reset}`);
    console.log(`  Tasks will be read but not processed\n`);
  }

  // Determine parallel processing
  const maxParallel = options.parallel ?? workspaceConfig.settings?.max_parallel_tasks ?? 1;

  if (maxParallel > 1) {
    // Parallel mode
    await startWorkspaceParallel(options, workspaceConfig, validRepos, maxParallel, cwd);
  } else {
    // Sequential mode (existing behavior)
    await startWorkspaceSequential(options, workspaceConfig, validRepos);
  }
}

// Sequential workspace processing (existing behavior)
async function startWorkspaceSequential(
  options: StartOptions,
  workspaceConfig: WorkspaceConfig,
  validRepos: Array<[string, WorkspaceRepoConfig]>
): Promise<void> {
  // Process loop
  console.log(`\n${colors.bold}Starting workspace task processing...${colors.reset}\n`);
  console.log(`Press ${colors.dim}Ctrl+C${colors.reset} to stop gracefully.\n`);
  console.log('─'.repeat(60));

  let currentRepoIndex = 0;
  let totalTasksProcessed = 0;
  let consecutiveEmptyRounds = 0;
  const maxEmptyRounds = 3;
  let running = true;

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(`\n\n${colors.yellow}Shutting down workspace mode...${colors.reset}`);
    running = false;
  });

  process.on('SIGTERM', () => {
    running = false;
  });

  while (running) {
    // Get current repo based on strategy
    let currentRepo: [string, WorkspaceRepoConfig];

    if (workspaceConfig.strategy === 'round-robin') {
      currentRepo = validRepos[currentRepoIndex];
      currentRepoIndex = (currentRepoIndex + 1) % validRepos.length;
    } else if (workspaceConfig.strategy === 'priority') {
      // Priority is already sorted, just iterate
      currentRepo = validRepos[currentRepoIndex];
      currentRepoIndex = (currentRepoIndex + 1) % validRepos.length;
    } else {
      // Sequential: stay on same repo until no tasks
      currentRepo = validRepos[currentRepoIndex];
    }

    const [repoName, repoConfig] = currentRepo;
    const configPath = join(repoConfig.path, '.chadgi', 'chadgi-config.yaml');

    console.log(`\n${colors.cyan}Processing:${colors.reset} ${repoName}`);
    console.log(`${colors.dim}Path:${colors.reset} ${repoConfig.path}`);

    // Run single task for this repo
    const exitCode = await runRepoTask(repoConfig.path, configPath, options);

    if (exitCode === 0) {
      totalTasksProcessed++;
      consecutiveEmptyRounds = 0;
      console.log(`${colors.green}Task completed${colors.reset} in ${repoName}`);
    } else if (exitCode === 2) {
      // Exit code 2 typically means no tasks available
      console.log(`${colors.dim}No tasks available${colors.reset} in ${repoName}`);

      // For sequential mode, move to next repo when current is empty
      if (workspaceConfig.strategy === 'sequential') {
        currentRepoIndex = (currentRepoIndex + 1) % validRepos.length;
        if (currentRepoIndex === 0) {
          consecutiveEmptyRounds++;
        }
      } else {
        // For round-robin, count empty rounds
        if (currentRepoIndex === 0) {
          consecutiveEmptyRounds++;
        }
      }
    } else {
      console.log(`${colors.yellow}Task failed${colors.reset} in ${repoName} (exit code: ${exitCode})`);
    }

    // Check if we should exit
    if (consecutiveEmptyRounds >= maxEmptyRounds) {
      console.log(`\n${colors.dim}No tasks found in any repository after ${maxEmptyRounds} rounds.${colors.reset}`);
      break;
    }

    // Small delay between repos to prevent hammering
    if (running) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log(`\n${colors.bold}Workspace Session Summary${colors.reset}`);
  console.log(`  Tasks processed: ${totalTasksProcessed}`);
  console.log(`  Repositories: ${validRepos.length}`);

  if (!running) {
    console.log(`\n${colors.yellow}Session interrupted by user.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}Session complete.${colors.reset}`);
  }
}

// Create a git worktree for isolated parallel execution
function createWorktree(repoPath: string, workerId: number): string {
  const worktreeDir = join(dirname(repoPath), `.chadgi-worktrees`);
  const worktreePath = join(worktreeDir, `worker-${workerId}-${basename(repoPath)}`);

  // Create worktrees directory if needed
  if (!existsSync(worktreeDir)) {
    mkdirSync(worktreeDir, { recursive: true });
  }

  // Remove existing worktree if present
  if (existsSync(worktreePath)) {
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: repoPath,
        stdio: 'pipe'
      });
    } catch {
      // Force remove directory if worktree command fails
      try {
        rmSync(worktreePath, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
  }

  // Get current branch/commit
  let ref = 'HEAD';
  try {
    ref = execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    // Fall back to HEAD
  }

  // Create new worktree
  try {
    execSync(`git worktree add "${worktreePath}" ${ref} --detach`, {
      cwd: repoPath,
      stdio: 'pipe'
    });
  } catch (err) {
    throw new Error(`Failed to create worktree for worker ${workerId}: ${(err as Error).message}`);
  }

  // Copy .chadgi directory to worktree
  const srcChadgiDir = join(repoPath, '.chadgi');
  const dstChadgiDir = join(worktreePath, '.chadgi');
  if (existsSync(srcChadgiDir)) {
    mkdirSync(dstChadgiDir, { recursive: true });
    // Copy config files but not progress/stats
    const filesToCopy = ['chadgi-config.yaml', 'chadgi-task.md', 'chadgi-generate-task.md'];
    for (const file of filesToCopy) {
      const srcFile = join(srcChadgiDir, file);
      const dstFile = join(dstChadgiDir, file);
      if (existsSync(srcFile)) {
        writeFileSync(dstFile, readFileSync(srcFile));
      }
    }
  }

  return worktreePath;
}

// Clean up worktree after use
function cleanupWorktree(repoPath: string, worktreePath: string): void {
  try {
    execSync(`git worktree remove "${worktreePath}" --force`, {
      cwd: repoPath,
      stdio: 'pipe'
    });
  } catch {
    // Try to force remove directory
    try {
      rmSync(worktreePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures
    }
  }
}

// Run a task in a worker using a worktree
function runWorkerTask(
  workerInfo: WorkerInfo,
  configPath: string,
  options: StartOptions,
  onProgress: (workerId: number, update: Partial<ParallelWorkerTask>) => void
): Promise<{ exitCode: number; cost: number }> {
  return new Promise((resolve) => {
    const scriptPath = join(__dirname, '..', 'scripts', 'chadgi.sh');
    const chadgiDir = dirname(configPath);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CHADGI_DIR: chadgiDir,
      CONFIG_FILE: configPath,
      DRY_RUN: options.dryRun ? 'true' : 'false',
      DEBUG_MODE: options.debug ? 'true' : 'false',
      IGNORE_DEPS: options.ignoreDeps ? 'true' : 'false',
      INTERACTIVE_MODE: options.interactive ? 'true' : 'false',
      NO_MASK: options.mask === false ? 'true' : 'false',
      FORCE_CLAIM: options.forceClaim ? 'true' : 'false',
      WORKSPACE_MODE: 'true',
      WORKSPACE_SINGLE_TASK: 'true',
      PARALLEL_WORKER_ID: String(workerInfo.id),
    };

    if (options.timeout !== undefined) {
      env.TASK_TIMEOUT = String(options.timeout);
    }

    // Track cost from stdout/stderr
    let taskCost = 0;
    let stdoutBuffer = '';

    const child = spawn('bash', [scriptPath], {
      env,
      cwd: workerInfo.worktreePath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    workerInfo.process = child;

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdoutBuffer += text;

      // Parse cost from output (look for total_cost_usd in JSON)
      const costMatch = text.match(/"total_cost_usd":\s*([\d.]+)/);
      if (costMatch) {
        taskCost = parseFloat(costMatch[1]);
      }

      // Parse task info for progress updates
      const issueMatch = text.match(/Found issue #(\d+)/);
      if (issueMatch) {
        onProgress(workerInfo.id, {
          task: {
            id: issueMatch[1],
            title: '',
            branch: '',
            started_at: new Date().toISOString()
          },
          status: 'in_progress'
        });
      }

      // Output to console with worker prefix
      const lines = text.split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        console.log(`${colors.dim}[W${workerInfo.id}]${colors.reset} ${line}`);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      const lines = text.split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        console.log(`${colors.dim}[W${workerInfo.id}]${colors.reset} ${colors.red}${line}${colors.reset}`);
      }
    });

    child.on('close', (code) => {
      workerInfo.process = null;
      resolve({ exitCode: code ?? 0, cost: taskCost });
    });

    child.on('error', () => {
      workerInfo.process = null;
      resolve({ exitCode: 1, cost: taskCost });
    });
  });
}

// Update progress file for parallel mode
function updateParallelProgress(
  chadgiDir: string,
  workers: WorkerInfo[],
  sessionInfo: { startedAt: string; totalCost: number; tasksCompleted: number },
  maxWorkers: number
): void {
  const progressFile = join(chadgiDir, 'chadgi-progress.json');

  const activeWorkers = workers.filter(w => w.status === 'in_progress').length;

  const parallelWorkers: ParallelWorkerTask[] = workers.map(w => ({
    worker_id: w.id,
    repo_name: w.repoName,
    repo_path: w.repoPath,
    status: w.status,
    cost_usd: w.costUsd,
    started_at: w.startedAt
  }));

  const parallelSession: ParallelSessionProgress = {
    started_at: sessionInfo.startedAt,
    tasks_completed: sessionInfo.tasksCompleted,
    total_cost_usd: sessionInfo.totalCost,
    active_workers: activeWorkers,
    max_workers: maxWorkers,
    aggregate_cost_usd: workers.reduce((sum, w) => sum + w.costUsd, 0)
  };

  const progressData: ProgressData = {
    status: activeWorkers > 0 ? 'in_progress' : 'idle',
    last_updated: new Date().toISOString(),
    parallel_mode: true,
    parallel_workers: parallelWorkers,
    parallel_session: parallelSession
  };

  try {
    atomicWriteJson(progressFile, progressData);
  } catch {
    // Ignore progress file errors
  }
}

// Parallel workspace processing
async function startWorkspaceParallel(
  options: StartOptions,
  workspaceConfig: WorkspaceConfig,
  validRepos: Array<[string, WorkspaceRepoConfig]>,
  maxParallel: number,
  cwd: string
): Promise<void> {
  console.log(`\n${colors.bold}${colors.cyan}PARALLEL MODE${colors.reset}: Up to ${maxParallel} concurrent workers`);
  console.log(`\n${colors.bold}Starting parallel workspace task processing...${colors.reset}\n`);
  console.log(`Press ${colors.dim}Ctrl+C${colors.reset} to stop gracefully (waits for in-progress tasks).\n`);
  console.log('─'.repeat(60));

  // Session tracking
  const sessionStartedAt = new Date().toISOString();
  let totalTasksProcessed = 0;
  let totalCostUsd = 0;
  let consecutiveEmptyRounds = 0;
  const maxEmptyRounds = 3;
  let running = true;
  let shuttingDown = false;

  // Worker management
  const workers: WorkerInfo[] = [];
  const repoQueue: Array<[string, WorkspaceRepoConfig]> = [...validRepos];
  let currentRepoIndex = 0;

  // Progress file location
  const workspaceDir = dirname(getWorkspaceConfigPath({ config: options.config }));

  // Progress update callback
  const updateWorkerProgress = (workerId: number, update: Partial<ParallelWorkerTask>) => {
    const worker = workers.find(w => w.id === workerId);
    if (worker && update.task) {
      // Update tracked task info
    }
    updateParallelProgress(workspaceDir, workers, {
      startedAt: sessionStartedAt,
      totalCost: totalCostUsd,
      tasksCompleted: totalTasksProcessed
    }, maxParallel);
  };

  // Get next repo based on strategy
  const getNextRepo = (): [string, WorkspaceRepoConfig] | null => {
    if (validRepos.length === 0) return null;

    // Round-robin through repos
    const repo = validRepos[currentRepoIndex];
    currentRepoIndex = (currentRepoIndex + 1) % validRepos.length;
    return repo;
  };

  // Start a worker for a repo
  const startWorker = async (workerId: number): Promise<void> => {
    const repo = getNextRepo();
    if (!repo) return;

    const [repoName, repoConfig] = repo;

    // Create worktree for isolation
    let worktreePath: string;
    try {
      worktreePath = createWorktree(repoConfig.path, workerId);
    } catch (err) {
      console.log(`${colors.red}[W${workerId}] Failed to create worktree:${colors.reset} ${(err as Error).message}`);
      return;
    }

    const configPath = join(worktreePath, '.chadgi', 'chadgi-config.yaml');

    const workerInfo: WorkerInfo = {
      id: workerId,
      repoName,
      repoPath: repoConfig.path,
      worktreePath,
      process: null,
      status: 'in_progress',
      costUsd: 0,
      tasksCompleted: 0,
      startedAt: new Date().toISOString()
    };

    workers.push(workerInfo);

    console.log(`\n${colors.cyan}[W${workerId}] Starting:${colors.reset} ${repoName}`);

    updateParallelProgress(workspaceDir, workers, {
      startedAt: sessionStartedAt,
      totalCost: totalCostUsd,
      tasksCompleted: totalTasksProcessed
    }, maxParallel);

    // Run task
    const result = await runWorkerTask(workerInfo, configPath, options, updateWorkerProgress);

    // Update worker status
    workerInfo.costUsd += result.cost;
    totalCostUsd += result.cost;

    if (result.exitCode === 0) {
      workerInfo.status = 'completed';
      workerInfo.tasksCompleted++;
      totalTasksProcessed++;
      consecutiveEmptyRounds = 0;
      console.log(`${colors.green}[W${workerId}] Task completed${colors.reset} in ${repoName} (cost: $${result.cost.toFixed(4)})`);
    } else if (result.exitCode === 2) {
      workerInfo.status = 'idle';
      console.log(`${colors.dim}[W${workerId}] No tasks available${colors.reset} in ${repoName}`);
    } else {
      workerInfo.status = 'failed';
      console.log(`${colors.yellow}[W${workerId}] Task failed${colors.reset} in ${repoName} (exit code: ${result.exitCode})`);
    }

    // Clean up worktree
    cleanupWorktree(repoConfig.path, worktreePath);

    // Remove worker from list
    const idx = workers.indexOf(workerInfo);
    if (idx !== -1) {
      workers.splice(idx, 1);
    }

    updateParallelProgress(workspaceDir, workers, {
      startedAt: sessionStartedAt,
      totalCost: totalCostUsd,
      tasksCompleted: totalTasksProcessed
    }, maxParallel);
  };

  // Handle graceful shutdown
  const handleShutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    running = false;

    console.log(`\n\n${colors.yellow}Shutting down workspace mode...${colors.reset}`);

    if (workers.length > 0) {
      console.log(`${colors.yellow}Waiting for ${workers.length} in-progress task(s) to complete...${colors.reset}`);

      // Send SIGINT to all running processes
      for (const worker of workers) {
        if (worker.process) {
          worker.process.kill('SIGINT');
        }
      }
    }
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  // Main processing loop
  let nextWorkerId = 1;

  while (running || workers.length > 0) {
    // Start new workers if capacity available and not shutting down
    while (!shuttingDown && running && workers.length < maxParallel) {
      // Check if all repos have been processed this round
      if (currentRepoIndex === 0 && workers.length === 0) {
        // Full round complete, check for consecutive empty
        const allEmpty = workers.every(w => w.status === 'idle');
        if (allEmpty && totalTasksProcessed === 0) {
          consecutiveEmptyRounds++;
        }
      }

      if (consecutiveEmptyRounds >= maxEmptyRounds) {
        running = false;
        break;
      }

      // Start a new worker
      startWorker(nextWorkerId++);

      // Small delay between starting workers to avoid race conditions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if all workers have finished
    if (shuttingDown && workers.length === 0) {
      break;
    }
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log(`\n${colors.bold}Workspace Session Summary${colors.reset}`);
  console.log(`  Mode: ${colors.cyan}Parallel (${maxParallel} workers)${colors.reset}`);
  console.log(`  Tasks processed: ${totalTasksProcessed}`);
  console.log(`  Total cost: $${totalCostUsd.toFixed(4)}`);
  console.log(`  Repositories: ${validRepos.length}`);

  // Update final progress
  updateParallelProgress(workspaceDir, [], {
    startedAt: sessionStartedAt,
    totalCost: totalCostUsd,
    tasksCompleted: totalTasksProcessed
  }, maxParallel);

  if (shuttingDown) {
    console.log(`\n${colors.yellow}Session interrupted by user.${colors.reset}`);
  } else if (consecutiveEmptyRounds >= maxEmptyRounds) {
    console.log(`\n${colors.dim}No tasks found in any repository after ${maxEmptyRounds} rounds.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}Session complete.${colors.reset}`);
  }
}
