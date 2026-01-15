import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ResumeOptions {
  config?: string;
  restart?: boolean;
}

interface ProgressData {
  status: string;
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
  last_updated: string;
}

interface PauseLockData {
  paused_at: string;
  reason?: string;
  resume_at?: string;
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

export async function resume(options: ResumeOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const chadgiDir = dirname(configPath);

  // Ensure .chadgi directory exists
  if (!existsSync(chadgiDir)) {
    console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
    console.error('Run `chadgi init` first to initialize ChadGI.');
    process.exit(1);
  }

  const pauseLockFile = join(chadgiDir, 'pause.lock');
  const progressFile = join(chadgiDir, 'chadgi-progress.json');

  // Check if paused
  if (!existsSync(pauseLockFile)) {
    // Check if ChadGI is running or stopped
    let progress: ProgressData | null = null;
    if (existsSync(progressFile)) {
      try {
        progress = JSON.parse(readFileSync(progressFile, 'utf-8'));
      } catch {
        // Ignore parse errors
      }
    }

    if (progress && progress.status === 'in_progress') {
      console.log(`${colors.cyan}ChadGI is currently running.${colors.reset}`);
      if (progress.current_task?.id) {
        console.log(`  Working on: Issue #${progress.current_task.id}`);
        console.log(`  Title: ${progress.current_task.title}`);
      }
      console.log('\nNo pause lock found - nothing to resume.');
      return;
    }

    if (options.restart) {
      console.log(`${colors.cyan}Starting ChadGI...${colors.reset}`);
      await startChadGI(configPath);
      return;
    }

    console.log(`${colors.yellow}ChadGI is not paused.${colors.reset}`);
    console.log('');

    if (progress && (progress.status === 'idle' || progress.status === 'stopped' || progress.status === 'error')) {
      console.log('ChadGI appears to be stopped.');
      console.log(`Use ${colors.green}chadgi resume --restart${colors.reset} to start a new session.`);
      console.log(`Or use ${colors.green}chadgi start${colors.reset} to start normally.`);
    } else {
      console.log('No pause lock file found.');
      console.log(`Use ${colors.green}chadgi start${colors.reset} to begin processing tasks.`);
    }
    return;
  }

  // Read pause lock info before removing
  let pauseInfo: PauseLockData | null = null;
  try {
    pauseInfo = JSON.parse(readFileSync(pauseLockFile, 'utf-8'));
  } catch {
    // Ignore parse errors
  }

  // Remove the pause lock file
  unlinkSync(pauseLockFile);

  console.log(`${colors.green}${colors.bold}`);
  console.log('==========================================================');
  console.log('                   CHADGI RESUMED                          ');
  console.log('==========================================================');
  console.log(`${colors.reset}`);

  if (pauseInfo) {
    const pausedAt = new Date(pauseInfo.paused_at);
    const pauseDuration = Date.now() - pausedAt.getTime();
    const pauseMinutes = Math.floor(pauseDuration / 60000);
    const pauseSeconds = Math.floor((pauseDuration % 60000) / 1000);

    console.log(`Paused for: ${pauseMinutes}m ${pauseSeconds}s`);
    if (pauseInfo.reason) {
      console.log(`Pause reason: ${pauseInfo.reason}`);
    }
  }

  console.log('');
  console.log('Pause lock removed. ChadGI will continue processing.');

  // Check current progress state
  let progress: ProgressData | null = null;
  if (existsSync(progressFile)) {
    try {
      progress = JSON.parse(readFileSync(progressFile, 'utf-8'));
    } catch {
      // Ignore parse errors
    }
  }

  if (progress && progress.status === 'paused') {
    console.log('');
    console.log(`${colors.cyan}Session was in paused state - ChadGI should resume automatically.${colors.reset}`);
    if (progress.session?.tasks_completed) {
      console.log(`  Tasks completed this session: ${progress.session.tasks_completed}`);
    }
  } else if (options.restart || (progress && (progress.status === 'stopped' || progress.status === 'idle' || progress.status === 'error'))) {
    if (options.restart) {
      console.log('');
      console.log(`${colors.cyan}Starting ChadGI...${colors.reset}`);
      await startChadGI(configPath);
    } else {
      console.log('');
      console.log(`${colors.yellow}ChadGI doesn't appear to be running.${colors.reset}`);
      console.log(`Use ${colors.green}chadgi resume --restart${colors.reset} to start a new session.`);
    }
  }
}

async function startChadGI(configPath: string): Promise<void> {
  const scriptPath = join(__dirname, '..', 'scripts', 'chadgi.sh');

  if (!existsSync(scriptPath)) {
    console.error(`${colors.red}Error: Could not find chadgi.sh script${colors.reset}`);
    process.exit(1);
  }

  const chadgiDir = dirname(configPath);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CHADGI_DIR: chadgiDir,
    CONFIG_FILE: configPath,
    DRY_RUN: 'false',
  };

  const child = spawn('bash', [scriptPath], {
    env,
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}
