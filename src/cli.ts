#!/usr/bin/env node

import { Command } from 'commander';
import { init } from './init.js';
import { start } from './start.js';
import { setupProject } from './setup-project.js';
import { validate } from './validate.js';
import { stats } from './stats.js';
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
  .command('start')
  .description('Start the ChadGI automation loop')
  .option('-c, --config <path>', 'Path to config file (default: ./.chadgi/chadgi-config.yaml)')
  .option('-d, --dry-run', 'Run in dry-run mode - show what would happen without making changes')
  .option('-t, --timeout <minutes>', 'Override task timeout in minutes (0 = disabled)', parseInt)
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

program.parse();
