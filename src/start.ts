import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { validate } from './validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StartOptions {
  config?: string;
}

export async function start(options: StartOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;

  console.log('Starting ChadGI automation loop...\n');

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
  const env = {
    ...process.env,
    CHADGI_DIR: chadgiDir,
    CONFIG_FILE: configPath
  };

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
