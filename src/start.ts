import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { validate } from './validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StartOptions {
  config?: string;
  dryRun?: boolean;
  timeout?: number;
  debug?: boolean;
  ignoreDeps?: boolean;
}

export async function start(options: StartOptions = {}): Promise<void> {
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
