/**
 * ChadGI Config Migration Command
 *
 * Provides CLI interface for migrating configuration files between schema versions.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { createInterface } from 'readline';
import { colors } from './utils/colors.js';
import {
  checkMigrations,
  runMigrations,
  previewMigrations,
  restoreFromBackup,
  getLatestBackup,
  loadMigrationHistory,
  CURRENT_CONFIG_VERSION,
  DEFAULT_CONFIG_VERSION,
  parseYamlToObject,
  objectToYaml,
} from './migrations/index.js';

import type { BaseCommandOptions } from './types/index.js';

export interface ConfigMigrateOptions extends BaseCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
  rollback?: boolean;
}

/**
 * Prompt for user confirmation
 */
async function confirm(message: string): Promise<boolean> {
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
 * Handle rollback to previous config version
 */
async function handleRollback(configPath: string, options: ConfigMigrateOptions): Promise<void> {
  const latestBackup = getLatestBackup(configPath);

  if (!latestBackup) {
    console.error(`${colors.red}Error:${colors.reset} No backup found to rollback to.`);
    console.log(`${colors.dim}Backups are created automatically when running migrations.${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.cyan}${colors.bold}ChadGI Config Rollback${colors.reset}\n`);

  // Show backup info
  const backupContent = readFileSync(latestBackup, 'utf-8');
  const backupConfig = parseYamlToObject(backupContent);
  const backupVersion = backupConfig.config_version || DEFAULT_CONFIG_VERSION;

  console.log(`${colors.cyan}Backup Details:${colors.reset}`);
  console.log(`  File: ${latestBackup}`);
  console.log(`  Version: ${backupVersion}`);
  console.log('');

  // Confirm unless --yes flag
  if (!options.yes) {
    const confirmed = await confirm('Restore this backup?');
    if (!confirmed) {
      console.log(`${colors.yellow}Rollback cancelled.${colors.reset}`);
      return;
    }
  }

  // Perform rollback
  const success = restoreFromBackup(configPath);

  if (success) {
    console.log(`${colors.green}Configuration restored from backup.${colors.reset}`);
  } else {
    console.error(`${colors.red}Error:${colors.reset} Failed to restore from backup.`);
    process.exit(1);
  }
}

/**
 * Main config migrate command
 */
export async function configMigrate(options: ConfigMigrateOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const chadgiDir = dirname(configPath);

  // Handle rollback
  if (options.rollback) {
    await handleRollback(configPath, options);
    return;
  }

  // Check if config file exists
  if (!existsSync(configPath)) {
    console.error(`${colors.red}Error:${colors.reset} Configuration file not found: ${configPath}`);
    console.log(`Run "${colors.cyan}chadgi init${colors.reset}" first to create a configuration.`);
    process.exit(1);
  }

  console.log(`${colors.cyan}${colors.bold}ChadGI Config Migration${colors.reset}\n`);

  // Preview migrations
  const preview = previewMigrations(configPath);

  console.log(`${colors.cyan}Current Version:${colors.reset} ${preview.currentVersion || `${DEFAULT_CONFIG_VERSION} (implicit)`}`);
  console.log(`${colors.cyan}Target Version:${colors.reset}  ${preview.targetVersion}`);
  console.log('');

  if (preview.migrations.length === 0) {
    console.log(`${colors.green}Configuration is already up to date!${colors.reset}`);
    return;
  }

  // Show pending migrations
  console.log(`${colors.yellow}Pending Migrations:${colors.reset}`);
  for (const migration of preview.migrations) {
    console.log(`  ${colors.cyan}${migration.from}${colors.reset} -> ${colors.cyan}${migration.to}${colors.reset}`);
    console.log(`    ${colors.dim}${migration.description}${colors.reset}`);
  }
  console.log('');

  // Dry run mode
  if (options.dryRun) {
    console.log(`${colors.yellow}Dry run mode:${colors.reset} No changes will be made.`);
    console.log(`Run without ${colors.cyan}--dry-run${colors.reset} to apply migrations.`);
    return;
  }

  // Confirm unless --yes flag
  if (!options.yes) {
    console.log(`${colors.dim}A backup will be created before migration.${colors.reset}`);
    const confirmed = await confirm('Apply these migrations?');
    if (!confirmed) {
      console.log(`${colors.yellow}Migration cancelled.${colors.reset}`);
      return;
    }
  }

  console.log('');

  // Run migrations
  const result = runMigrations(configPath, {
    dryRun: false,
    silent: false,
  });

  console.log('');

  if (result.success) {
    console.log(`${colors.green}${colors.bold}Migration completed successfully!${colors.reset}`);
    console.log(`  Migrations applied: ${result.migrationsApplied}`);
    console.log(`  Final version: ${result.finalVersion}`);
    if (result.backupPath) {
      console.log(`  Backup: ${result.backupPath}`);
    }
  } else {
    console.error(`${colors.red}${colors.bold}Migration failed!${colors.reset}`);
    console.error(`  Error: ${result.error}`);
    if (result.backupPath) {
      console.log(`\n${colors.yellow}To restore from backup, run:${colors.reset}`);
      console.log(`  chadgi config migrate --rollback`);
    }
    process.exit(1);
  }
}

/**
 * Check for pending migrations (used by other commands)
 */
export function hasPendingMigrations(configPath: string): boolean {
  if (!existsSync(configPath)) {
    return false;
  }
  const check = checkMigrations(configPath);
  return check.needsMigration;
}

/**
 * Get migration status message (used by other commands)
 */
export function getMigrationStatusMessage(configPath: string): string | null {
  if (!existsSync(configPath)) {
    return null;
  }

  const check = checkMigrations(configPath);
  if (!check.needsMigration) {
    return null;
  }

  const currentVersion = check.currentVersion || DEFAULT_CONFIG_VERSION;
  return `Configuration needs migration (${currentVersion} -> ${check.targetVersion}). ` +
         `Run '${colors.cyan}chadgi config migrate${colors.reset}' to update.`;
}

/**
 * Print migration history
 */
export async function printMigrationHistory(options: BaseCommandOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const chadgiDir = dirname(configPath);

  const history = loadMigrationHistory(chadgiDir);

  console.log(`${colors.cyan}${colors.bold}Migration History${colors.reset}\n`);

  console.log(`${colors.cyan}Current Version:${colors.reset} ${history.currentVersion}`);
  console.log(`${colors.cyan}Last Updated:${colors.reset} ${history.lastUpdated}`);
  console.log('');

  if (history.migrations.length === 0) {
    console.log(`${colors.dim}No migrations have been applied yet.${colors.reset}`);
    return;
  }

  console.log(`${colors.yellow}Applied Migrations:${colors.reset}`);
  for (const entry of history.migrations) {
    const status = entry.success
      ? `${colors.green}SUCCESS${colors.reset}`
      : `${colors.red}FAILED${colors.reset}`;

    console.log(`  ${colors.dim}${entry.timestamp}${colors.reset}`);
    console.log(`    ${entry.fromVersion} -> ${entry.toVersion} [${status}]`);
    if (entry.error) {
      console.log(`    ${colors.red}Error: ${entry.error}${colors.reset}`);
    }
  }
}
