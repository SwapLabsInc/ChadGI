import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { validate } from './validate.js';
import {
  getWorkspaceConfigPath,
  loadWorkspaceConfig,
  validateRepoPath,
  WorkspaceConfig,
  WorkspaceRepoConfig,
} from './workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

interface StartOptions {
  config?: string;
  dryRun?: boolean;
  timeout?: number;
  debug?: boolean;
  ignoreDeps?: boolean;
  workspace?: boolean;
  repo?: string;
}

export async function start(options: StartOptions = {}): Promise<void> {
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

  if (dryRun) {
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

  // Validate configuration first
  console.log('Validating configuration...');
  const isValid = await validate({ config: configPath, quiet: true });

  if (!isValid) {
    console.log('\nConfiguration validation failed. Please fix the issues above and try again.');
    console.log('Run `chadgi validate` for more details.\n');
    process.exit(1);
  }
  console.log('Configuration valid!\n');

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
    IGNORE_DEPS: ignoreDeps ? 'true' : 'false'
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
