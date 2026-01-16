/**
 * ChadGI Configuration Migration System
 *
 * Provides automatic migration of configuration files between schema versions.
 * Migrations are pure functions that transform config from one version to the next.
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { colors } from '../utils/colors.js';

import type {
  Migration,
  MigrationHistory,
  MigrationHistoryEntry,
  MigrationCheckResult,
  MigrationResult,
} from '../types/index.js';

// Import individual migrations
import { migration_1_0_to_1_1 } from './v1_0_to_v1_1.js';

// ============================================================================
// Constants
// ============================================================================

/** Current configuration schema version */
export const CURRENT_CONFIG_VERSION = '1.1';

/** Default version for configs without version field */
export const DEFAULT_CONFIG_VERSION = '1.0';

/** Migration history file name */
export const MIGRATION_HISTORY_FILE = 'migration-history.json';

/** Backup directory name */
export const BACKUP_DIR = 'config-backups';

// ============================================================================
// Migration Registry
// ============================================================================

/**
 * Registry of all available migrations, ordered by version.
 * Each migration transforms config from fromVersion to toVersion.
 */
export const MIGRATIONS: Migration[] = [
  migration_1_0_to_1_1,
  // Add future migrations here in order:
  // migration_1_1_to_1_2,
  // migration_1_2_to_2_0,
];

// ============================================================================
// Version Comparison Utilities
// ============================================================================

/**
 * Parse a version string into major and minor components.
 */
export function parseVersion(version: string): { major: number; minor: number } {
  const parts = version.split('.');
  return {
    major: parseInt(parts[0], 10) || 0,
    minor: parseInt(parts[1], 10) || 0,
  };
}

/**
 * Compare two version strings.
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const ver1 = parseVersion(v1);
  const ver2 = parseVersion(v2);

  if (ver1.major !== ver2.major) {
    return ver1.major < ver2.major ? -1 : 1;
  }
  if (ver1.minor !== ver2.minor) {
    return ver1.minor < ver2.minor ? -1 : 1;
  }
  return 0;
}

/**
 * Check if a version is valid (matches major.minor format).
 */
export function isValidVersion(version: string): boolean {
  return /^\d+\.\d+$/.test(version);
}

// ============================================================================
// YAML Parsing/Serialization (simple implementation for config files)
// ============================================================================

/**
 * Parse YAML config content into an object.
 * This is a simple parser that handles the config YAML format.
 */
export function parseYamlToObject(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  const stack: { obj: Record<string, unknown>; indent: number }[] = [{ obj: result, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    // Calculate indentation
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Skip if no content
    if (!trimmed) continue;

    // Handle key: value pairs
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      // Handle quoted values first - quoted values are always strings
      let wasQuoted = false;
      if ((value.startsWith('"') && value.includes('"', 1)) ||
          (value.startsWith("'") && value.includes("'", 1))) {
        const quoteChar = value[0];
        const endQuoteIndex = value.indexOf(quoteChar, 1);
        if (endQuoteIndex > 0) {
          value = value.slice(1, endQuoteIndex);
          wasQuoted = true;
        }
      } else {
        // Remove inline comments for unquoted values
        const commentIndex = value.indexOf('#');
        if (commentIndex > 0) {
          value = value.substring(0, commentIndex).trim();
        }
      }

      // Pop from stack while indent is less than or equal to current parent
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].obj;

      if (value === '') {
        // This is a nested object
        const newObj: Record<string, unknown> = {};
        parent[key] = newObj;
        stack.push({ obj: newObj, indent });
      } else if (wasQuoted) {
        // Quoted values are always strings
        parent[key] = value;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Array value like ["a", "b", "c"]
        try {
          parent[key] = JSON.parse(value);
        } catch {
          parent[key] = value;
        }
      } else if (value === 'true') {
        parent[key] = true;
      } else if (value === 'false') {
        parent[key] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        parent[key] = Number(value);
      } else {
        parent[key] = value;
      }
    }
  }

  return result;
}

/**
 * Serialize an object back to YAML format.
 */
export function objectToYaml(obj: Record<string, unknown>, indent: number = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${prefix}${key}:`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${prefix}${key}:`);
      lines.push(objectToYaml(value as Record<string, unknown>, indent + 1));
    } else if (Array.isArray(value)) {
      const arrayStr = JSON.stringify(value);
      lines.push(`${prefix}${key}: ${arrayStr}`);
    } else if (typeof value === 'string') {
      if (value.includes(':') || value.includes('#') || value.includes('"') ||
          value.includes("'") || value.startsWith(' ') || value.endsWith(' ')) {
        lines.push(`${prefix}${key}: "${value.replace(/"/g, '\\"')}"`);
      } else if (value === '') {
        lines.push(`${prefix}${key}: ""`);
      } else {
        lines.push(`${prefix}${key}: ${value}`);
      }
    } else {
      lines.push(`${prefix}${key}: ${value}`);
    }
  }

  return lines.filter(l => l !== '').join('\n');
}

// ============================================================================
// Config Version Detection
// ============================================================================

/**
 * Extract the config_version from a config file or object.
 * Returns null if no version is found.
 */
export function getConfigVersion(configOrPath: string | Record<string, unknown>): string | null {
  let config: Record<string, unknown>;

  if (typeof configOrPath === 'string') {
    // It's a file path
    if (!existsSync(configOrPath)) {
      return null;
    }
    const content = readFileSync(configOrPath, 'utf-8');
    config = parseYamlToObject(content);
  } else {
    config = configOrPath;
  }

  const version = config.config_version;
  if (typeof version === 'string' && isValidVersion(version)) {
    return version;
  }
  return null;
}

// ============================================================================
// Migration Check
// ============================================================================

/**
 * Check if a config file needs migration.
 * Returns information about pending migrations.
 */
export function checkMigrations(configPath: string): MigrationCheckResult {
  const currentVersion = getConfigVersion(configPath) || DEFAULT_CONFIG_VERSION;

  // Find migrations that need to be applied
  const pendingMigrations = MIGRATIONS.filter(m => {
    return compareVersions(m.fromVersion, currentVersion) >= 0 &&
           compareVersions(m.toVersion, CURRENT_CONFIG_VERSION) <= 0;
  });

  return {
    needsMigration: pendingMigrations.length > 0 || currentVersion !== CURRENT_CONFIG_VERSION,
    currentVersion: getConfigVersion(configPath),
    targetVersion: CURRENT_CONFIG_VERSION,
    pendingMigrations,
  };
}

// ============================================================================
// Backup Management
// ============================================================================

/**
 * Create a backup of the config file before migration.
 * Returns the path to the backup file.
 */
export function createBackup(configPath: string): string {
  const chadgiDir = dirname(configPath);
  const backupDir = join(chadgiDir, BACKUP_DIR);

  // Create backup directory if it doesn't exist
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  // Generate backup filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const configName = basename(configPath, '.yaml');
  const backupName = `${configName}-${timestamp}.yaml`;
  const backupPath = join(backupDir, backupName);

  // Copy the config file
  copyFileSync(configPath, backupPath);

  return backupPath;
}

/**
 * Get the most recent backup file for a config.
 */
export function getLatestBackup(configPath: string): string | null {
  const chadgiDir = dirname(configPath);
  const backupDir = join(chadgiDir, BACKUP_DIR);

  if (!existsSync(backupDir)) {
    return null;
  }

  const files = readdirSync(backupDir) as string[];
  const configName = basename(configPath, '.yaml');

  const backups = files
    .filter((f: string) => f.startsWith(configName) && f.endsWith('.yaml'))
    .sort()
    .reverse();

  if (backups.length === 0) {
    return null;
  }

  return join(backupDir, backups[0]);
}

/**
 * Restore config from the most recent backup.
 */
export function restoreFromBackup(configPath: string): boolean {
  const latestBackup = getLatestBackup(configPath);

  if (!latestBackup) {
    return false;
  }

  copyFileSync(latestBackup, configPath);
  return true;
}

// ============================================================================
// Migration History
// ============================================================================

/**
 * Load migration history from the history file.
 */
export function loadMigrationHistory(chadgiDir: string): MigrationHistory {
  const historyPath = join(chadgiDir, MIGRATION_HISTORY_FILE);

  if (!existsSync(historyPath)) {
    return {
      migrations: [],
      currentVersion: DEFAULT_CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    return JSON.parse(readFileSync(historyPath, 'utf-8'));
  } catch {
    return {
      migrations: [],
      currentVersion: DEFAULT_CONFIG_VERSION,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Save migration history to the history file.
 */
export function saveMigrationHistory(chadgiDir: string, history: MigrationHistory): void {
  const historyPath = join(chadgiDir, MIGRATION_HISTORY_FILE);
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * Add an entry to the migration history.
 */
export function addMigrationHistoryEntry(
  chadgiDir: string,
  entry: MigrationHistoryEntry
): void {
  const history = loadMigrationHistory(chadgiDir);
  history.migrations.push(entry);
  history.currentVersion = entry.success ? entry.toVersion : entry.fromVersion;
  history.lastUpdated = new Date().toISOString();
  saveMigrationHistory(chadgiDir, history);
}

// ============================================================================
// Migration Execution
// ============================================================================

/**
 * Run migrations on a config file.
 * Creates a backup before migrating.
 *
 * @param configPath Path to the config file
 * @param options Migration options
 * @returns Result of the migration
 */
export function runMigrations(
  configPath: string,
  options: {
    dryRun?: boolean;
    skipBackup?: boolean;
    silent?: boolean;
  } = {}
): MigrationResult {
  const { dryRun = false, skipBackup = false, silent = false } = options;

  // Check if file exists
  if (!existsSync(configPath)) {
    return {
      success: false,
      migrationsApplied: 0,
      finalVersion: DEFAULT_CONFIG_VERSION,
      error: `Config file not found: ${configPath}`,
    };
  }

  const chadgiDir = dirname(configPath);

  // Get current version and check for migrations
  const checkResult = checkMigrations(configPath);

  if (!checkResult.needsMigration) {
    return {
      success: true,
      migrationsApplied: 0,
      finalVersion: checkResult.targetVersion,
    };
  }

  // Create backup if not dry run and not skipped
  let backupPath: string | undefined;
  if (!dryRun && !skipBackup) {
    backupPath = createBackup(configPath);
    if (!silent) {
      console.log(`${colors.dim}Backup created: ${backupPath}${colors.reset}`);
    }
  }

  // Load the config
  const content = readFileSync(configPath, 'utf-8');
  let config = parseYamlToObject(content);
  let currentVersion = checkResult.currentVersion || DEFAULT_CONFIG_VERSION;

  // Apply each pending migration in order
  let migrationsApplied = 0;

  for (const migration of checkResult.pendingMigrations) {
    if (!silent) {
      console.log(`${colors.cyan}Migrating:${colors.reset} ${migration.fromVersion} -> ${migration.toVersion}`);
      console.log(`  ${colors.dim}${migration.description}${colors.reset}`);
    }

    try {
      // Apply the migration
      config = migration.migrate(config);
      currentVersion = migration.toVersion;
      migrationsApplied++;

      // Record in history (if not dry run)
      if (!dryRun) {
        addMigrationHistoryEntry(chadgiDir, {
          timestamp: new Date().toISOString(),
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          backupPath: backupPath || '',
          success: true,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record failure in history (if not dry run)
      if (!dryRun) {
        addMigrationHistoryEntry(chadgiDir, {
          timestamp: new Date().toISOString(),
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          backupPath: backupPath || '',
          success: false,
          error: errorMessage,
        });
      }

      return {
        success: false,
        migrationsApplied,
        finalVersion: currentVersion,
        backupPath,
        error: `Migration ${migration.fromVersion} -> ${migration.toVersion} failed: ${errorMessage}`,
      };
    }
  }

  // Update the config_version field
  config.config_version = CURRENT_CONFIG_VERSION;

  // Write the updated config (if not dry run)
  if (!dryRun) {
    const yamlContent = objectToYaml(config);
    writeFileSync(configPath, yamlContent);
  }

  return {
    success: true,
    migrationsApplied,
    finalVersion: CURRENT_CONFIG_VERSION,
    backupPath,
  };
}

/**
 * Preview what migrations would be applied without actually running them.
 */
export function previewMigrations(configPath: string): {
  currentVersion: string | null;
  targetVersion: string;
  migrations: Array<{
    from: string;
    to: string;
    description: string;
  }>;
} {
  const checkResult = checkMigrations(configPath);

  return {
    currentVersion: checkResult.currentVersion,
    targetVersion: checkResult.targetVersion,
    migrations: checkResult.pendingMigrations.map(m => ({
      from: m.fromVersion,
      to: m.toVersion,
      description: m.description,
    })),
  };
}
