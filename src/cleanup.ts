import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { colors } from './utils/colors.js';
import { parseYamlNested, ensureChadgiDirExists } from './utils/config.js';
import { createProgressBar } from './utils/progress.js';

export interface CleanupOptions {
  config?: string;
  branches?: boolean;
  diagnostics?: boolean;
  logs?: boolean;
  all?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  days?: number;
  json?: boolean;
}

interface CleanupResult {
  timestamp: string;
  dryRun: boolean;
  branches: {
    local: string[];
    remote: string[];
  };
  diagnostics: string[];
  logs: string[];
  summary: {
    branchesDeleted: number;
    diagnosticsDeleted: number;
    logsDeleted: number;
    totalDeleted: number;
  };
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

/**
 * Get orphaned branches (feature branches without open PRs)
 * Reuses logic from doctor.ts
 */
function getOrphanedBranches(repo: string, branchPrefix: string): { local: string[]; remote: string[] } {
  const result = { local: [] as string[], remote: [] as string[] };

  try {
    // Get local branches matching the prefix
    const localBranchesOutput = execSync('git branch', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const localBranches = localBranchesOutput
      .split('\n')
      .map(b => b.trim().replace(/^\*\s*/, ''))
      .filter(b => b.includes(branchPrefix));

    // Get remote branches matching the prefix
    const remoteBranchesOutput = execSync('git branch -r', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const remoteBranches = remoteBranchesOutput
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.includes(branchPrefix) && !b.includes('HEAD'))
      .map(b => b.replace(/^origin\//, ''));

    if (localBranches.length === 0 && remoteBranches.length === 0) {
      return result;
    }

    // Get open PRs for this repo
    let openPRBranches: string[] = [];
    try {
      const prsOutput = execSync(`gh pr list --repo ${repo} --state open --json headRefName`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const prs = JSON.parse(prsOutput);
      openPRBranches = prs.map((pr: { headRefName: string }) => pr.headRefName);
    } catch {
      // If we can't check PRs, return empty (can't determine orphaned)
      return result;
    }

    // Get current branch to avoid deleting it
    let currentBranch = '';
    try {
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch {
      // Ignore if we can't get current branch
    }

    // Find orphaned local branches (no open PR, not current branch)
    result.local = localBranches.filter(b => !openPRBranches.includes(b) && b !== currentBranch);

    // Find orphaned remote branches (no open PR)
    result.remote = remoteBranches.filter(b => !openPRBranches.includes(b));

    return result;
  } catch {
    return result;
  }
}

/**
 * Delete local branch
 */
function deleteLocalBranch(branch: string, dryRun: boolean): boolean {
  if (dryRun) {
    return true;
  }
  try {
    execSync(`git branch -D "${branch}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete remote branch
 */
function deleteRemoteBranch(branch: string, dryRun: boolean): boolean {
  if (dryRun) {
    return true;
  }
  try {
    execSync(`git push origin --delete "${branch}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get old diagnostic folders
 */
function getOldDiagnostics(chadgiDir: string, retentionDays: number): string[] {
  const diagnosticsDir = join(chadgiDir, 'diagnostics');
  if (!existsSync(diagnosticsDir)) {
    return [];
  }

  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const oldDiagnostics: string[] = [];

  try {
    const entries = readdirSync(diagnosticsDir);
    for (const entry of entries) {
      const entryPath = join(diagnosticsDir, entry);
      const stats = statSync(entryPath);
      if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
        oldDiagnostics.push(entry);
      }
    }
  } catch {
    // Ignore errors reading diagnostics
  }

  return oldDiagnostics;
}

/**
 * Delete diagnostic folder
 */
function deleteDiagnostic(chadgiDir: string, name: string, dryRun: boolean): boolean {
  if (dryRun) {
    return true;
  }
  try {
    const entryPath = join(chadgiDir, 'diagnostics', name);
    rmSync(entryPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get rotated log files beyond retention limit
 */
function getOldLogFiles(chadgiDir: string, configContent: string): string[] {
  const logFile = parseYamlNested(configContent, 'output', 'log_file') || './chadgi.log';
  const maxLogFiles = parseInt(parseYamlNested(configContent, 'output', 'max_log_files') || '5', 10);

  const baseLogPath = logFile.startsWith('/') ? logFile : join(chadgiDir, logFile);
  const logDir = dirname(baseLogPath);
  const logBaseName = baseLogPath.split('/').pop() || 'chadgi.log';

  if (!existsSync(logDir)) {
    return [];
  }

  const oldLogs: string[] = [];

  try {
    const entries = readdirSync(logDir);
    // Find rotated log files (e.g., chadgi.log.1, chadgi.log.2, etc.)
    const rotatedLogs = entries
      .filter(e => e.startsWith(logBaseName + '.') && /\.\d+$/.test(e))
      .sort((a, b) => {
        const numA = parseInt(a.split('.').pop() || '0', 10);
        const numB = parseInt(b.split('.').pop() || '0', 10);
        return numA - numB;
      });

    // Files beyond the retention limit
    if (rotatedLogs.length > maxLogFiles) {
      for (let i = maxLogFiles; i < rotatedLogs.length; i++) {
        oldLogs.push(rotatedLogs[i]);
      }
    }
  } catch {
    // Ignore errors reading log directory
  }

  return oldLogs;
}

/**
 * Delete log file
 */
function deleteLogFile(chadgiDir: string, configContent: string, name: string, dryRun: boolean): boolean {
  if (dryRun) {
    return true;
  }
  try {
    const logFile = parseYamlNested(configContent, 'output', 'log_file') || './chadgi.log';
    const baseLogPath = logFile.startsWith('/') ? logFile : join(chadgiDir, logFile);
    const logDir = dirname(baseLogPath);
    const filePath = join(logDir, name);
    unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Print cleanup report
 */
function printReport(result: CleanupResult, dryRun: boolean): void {
  const actionWord = dryRun ? 'Would clean up' : 'Cleaned up';
  const actionVerb = dryRun ? 'would be' : 'were';

  console.log(`${colors.purple}${colors.bold}`);
  console.log('==========================================================');
  console.log('                    CHADGI CLEANUP                         ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  if (dryRun) {
    console.log(`${colors.yellow}${colors.bold}DRY RUN${colors.reset} - No changes will be made\n`);
  }

  // Branches
  const totalBranches = result.branches.local.length + result.branches.remote.length;
  if (totalBranches > 0) {
    console.log(`${colors.cyan}${colors.bold}Branches${colors.reset}`);
    if (result.branches.local.length > 0) {
      console.log(`  ${colors.dim}Local branches ${actionVerb} deleted:${colors.reset}`);
      for (const branch of result.branches.local) {
        console.log(`    ${colors.green}-${colors.reset} ${branch}`);
      }
    }
    if (result.branches.remote.length > 0) {
      console.log(`  ${colors.dim}Remote branches ${actionVerb} deleted:${colors.reset}`);
      for (const branch of result.branches.remote) {
        console.log(`    ${colors.green}-${colors.reset} origin/${branch}`);
      }
    }
    console.log('');
  }

  // Diagnostics
  if (result.diagnostics.length > 0) {
    console.log(`${colors.cyan}${colors.bold}Diagnostics${colors.reset}`);
    console.log(`  ${colors.dim}Diagnostic folders ${actionVerb} deleted:${colors.reset}`);
    for (const diag of result.diagnostics) {
      console.log(`    ${colors.green}-${colors.reset} ${diag}`);
    }
    console.log('');
  }

  // Logs
  if (result.logs.length > 0) {
    console.log(`${colors.cyan}${colors.bold}Log Files${colors.reset}`);
    console.log(`  ${colors.dim}Log files ${actionVerb} deleted:${colors.reset}`);
    for (const log of result.logs) {
      console.log(`    ${colors.green}-${colors.reset} ${log}`);
    }
    console.log('');
  }

  // Summary
  console.log(`${colors.cyan}${colors.bold}Summary${colors.reset}`);
  console.log(`  ${actionWord}:`);
  console.log(`    Branches: ${result.summary.branchesDeleted}`);
  console.log(`    Diagnostics: ${result.summary.diagnosticsDeleted}`);
  console.log(`    Log files: ${result.summary.logsDeleted}`);
  console.log(`    ${colors.bold}Total: ${result.summary.totalDeleted}${colors.reset}`);
  console.log('');

  if (result.summary.totalDeleted === 0) {
    console.log(`${colors.green}Nothing to clean up!${colors.reset}`);
  } else if (dryRun) {
    console.log(`${colors.yellow}Run without --dry-run to perform cleanup.${colors.reset}`);
  } else {
    console.log(`${colors.green}Cleanup complete!${colors.reset}`);
  }

  console.log('');
  console.log(`${colors.purple}${colors.bold}==========================================================`);
  console.log('               Chad does what Chad wants.');
  console.log(`==========================================================${colors.reset}`);
}

/**
 * Main cleanup command
 */
export async function cleanup(options: CleanupOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const chadgiDir = dirname(configPath);
  const dryRun = options.dryRun || false;
  const skipConfirmation = options.yes || false;
  const retentionDays = options.days ?? 30;
  ensureChadgiDirExists(chadgiDir);

  // Load config
  if (!existsSync(configPath)) {
    console.error(`${colors.red}Error: Config file not found at ${configPath}${colors.reset}`);
    process.exit(1);
  }

  const configContent = readFileSync(configPath, 'utf-8');
  const repo = parseYamlNested(configContent, 'github', 'repo') || 'owner/repo';
  const branchPrefix = parseYamlNested(configContent, 'branch', 'prefix') || 'feature/issue-';

  // Determine which cleanup operations to run
  const cleanBranches = options.branches || options.all || false;
  const cleanDiagnostics = options.diagnostics || options.all || false;
  const cleanLogs = options.logs || options.all || false;

  // If no flags specified, show help
  if (!cleanBranches && !cleanDiagnostics && !cleanLogs) {
    console.log(`${colors.cyan}${colors.bold}ChadGI Cleanup${colors.reset}`);
    console.log('');
    console.log('Clean up stale branches, old diagnostics, and rotated log files.');
    console.log('');
    console.log(`${colors.bold}Usage:${colors.reset}`);
    console.log('  chadgi cleanup [options]');
    console.log('');
    console.log(`${colors.bold}Options:${colors.reset}`);
    console.log('  --branches       Delete orphaned feature branches (no open PR)');
    console.log('  --diagnostics    Remove diagnostic artifacts older than N days');
    console.log('  --logs           Remove rotated log files beyond retention limit');
    console.log('  --all            Run all cleanup operations');
    console.log('  --dry-run        Preview what would be deleted without making changes');
    console.log('  --yes            Skip confirmation prompts');
    console.log('  --days <n>       Retention days for diagnostics (default: 30)');
    console.log('  --json           Output results as JSON');
    console.log('  -c, --config     Path to config file');
    console.log('');
    console.log(`${colors.bold}Examples:${colors.reset}`);
    console.log('  chadgi cleanup --branches --dry-run    # Preview orphaned branch cleanup');
    console.log('  chadgi cleanup --diagnostics --days 14 # Delete diagnostics older than 14 days');
    console.log('  chadgi cleanup --all --yes             # Full cleanup without confirmation');
    return;
  }

  // Initialize result
  const result: CleanupResult = {
    timestamp: new Date().toISOString(),
    dryRun,
    branches: { local: [], remote: [] },
    diagnostics: [],
    logs: [],
    summary: {
      branchesDeleted: 0,
      diagnosticsDeleted: 0,
      logsDeleted: 0,
      totalDeleted: 0,
    },
  };

  // Gather items to clean
  let orphanedBranches = { local: [] as string[], remote: [] as string[] };
  let oldDiagnostics: string[] = [];
  let oldLogs: string[] = [];

  if (cleanBranches && repo !== 'owner/repo') {
    orphanedBranches = getOrphanedBranches(repo, branchPrefix);
  }

  if (cleanDiagnostics) {
    oldDiagnostics = getOldDiagnostics(chadgiDir, retentionDays);
  }

  if (cleanLogs) {
    oldLogs = getOldLogFiles(chadgiDir, configContent);
  }

  const totalItems =
    orphanedBranches.local.length +
    orphanedBranches.remote.length +
    oldDiagnostics.length +
    oldLogs.length;

  // If nothing to clean, report and exit
  if (totalItems === 0) {
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`${colors.green}Nothing to clean up!${colors.reset}`);
    }
    return;
  }

  // Show what will be cleaned
  if (!options.json && !dryRun) {
    console.log(`${colors.cyan}${colors.bold}Items to clean up:${colors.reset}`);

    if (orphanedBranches.local.length > 0) {
      console.log(`  Local branches: ${orphanedBranches.local.length}`);
    }
    if (orphanedBranches.remote.length > 0) {
      console.log(`  Remote branches: ${orphanedBranches.remote.length}`);
    }
    if (oldDiagnostics.length > 0) {
      console.log(`  Diagnostic folders: ${oldDiagnostics.length} (older than ${retentionDays} days)`);
    }
    if (oldLogs.length > 0) {
      console.log(`  Log files: ${oldLogs.length}`);
    }
    console.log('');
  }

  // Confirm if not in dry-run mode and not skipping confirmation
  if (!dryRun && !skipConfirmation) {
    const confirmed = await promptConfirmation(
      `${colors.yellow}This will permanently delete ${totalItems} item(s). Continue?${colors.reset}`
    );
    if (!confirmed) {
      console.log(`${colors.dim}Cleanup cancelled.${colors.reset}`);
      return;
    }
    console.log('');
  }

  // Perform cleanup with progress bar
  const progress = createProgressBar(totalItems, { label: 'Cleaning' }, options.json);
  let progressCount = 0;

  // Clean branches
  if (cleanBranches) {
    for (const branch of orphanedBranches.local) {
      progressCount++;
      progress?.update(progressCount, `local: ${branch}`);
      if (deleteLocalBranch(branch, dryRun)) {
        result.branches.local.push(branch);
      }
    }
    for (const branch of orphanedBranches.remote) {
      progressCount++;
      progress?.update(progressCount, `remote: ${branch}`);
      if (deleteRemoteBranch(branch, dryRun)) {
        result.branches.remote.push(branch);
      }
    }
  }

  // Clean diagnostics
  if (cleanDiagnostics) {
    for (const diag of oldDiagnostics) {
      progressCount++;
      progress?.update(progressCount, `diagnostic: ${diag}`);
      if (deleteDiagnostic(chadgiDir, diag, dryRun)) {
        result.diagnostics.push(diag);
      }
    }
  }

  // Clean logs
  if (cleanLogs) {
    for (const log of oldLogs) {
      progressCount++;
      progress?.update(progressCount, `log: ${log}`);
      if (deleteLogFile(chadgiDir, configContent, log, dryRun)) {
        result.logs.push(log);
      }
    }
  }

  // Complete the progress bar
  progress?.complete();

  // Calculate summary
  result.summary.branchesDeleted = result.branches.local.length + result.branches.remote.length;
  result.summary.diagnosticsDeleted = result.diagnostics.length;
  result.summary.logsDeleted = result.logs.length;
  result.summary.totalDeleted =
    result.summary.branchesDeleted + result.summary.diagnosticsDeleted + result.summary.logsDeleted;

  // Output results
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result, dryRun);
  }
}
