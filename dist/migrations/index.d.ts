/**
 * ChadGI Configuration Migration System
 *
 * Provides automatic migration of configuration files between schema versions.
 * Migrations are pure functions that transform config from one version to the next.
 */
import type { Migration, MigrationHistory, MigrationHistoryEntry, MigrationCheckResult, MigrationResult } from '../types/index.js';
/** Current configuration schema version */
export declare const CURRENT_CONFIG_VERSION = "1.1";
/** Default version for configs without version field */
export declare const DEFAULT_CONFIG_VERSION = "1.0";
/** Migration history file name */
export declare const MIGRATION_HISTORY_FILE = "migration-history.json";
/** Backup directory name */
export declare const BACKUP_DIR = "config-backups";
/**
 * Registry of all available migrations, ordered by version.
 * Each migration transforms config from fromVersion to toVersion.
 */
export declare const MIGRATIONS: Migration[];
/**
 * Parse a version string into major and minor components.
 */
export declare function parseVersion(version: string): {
    major: number;
    minor: number;
};
/**
 * Compare two version strings.
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export declare function compareVersions(v1: string, v2: string): number;
/**
 * Check if a version is valid (matches major.minor format).
 */
export declare function isValidVersion(version: string): boolean;
/**
 * Parse YAML config content into an object.
 * This is a simple parser that handles the config YAML format.
 */
export declare function parseYamlToObject(content: string): Record<string, unknown>;
/**
 * Serialize an object back to YAML format.
 */
export declare function objectToYaml(obj: Record<string, unknown>, indent?: number): string;
/**
 * Extract the config_version from a config file or object.
 * Returns null if no version is found.
 */
export declare function getConfigVersion(configOrPath: string | Record<string, unknown>): string | null;
/**
 * Check if a config file needs migration.
 * Returns information about pending migrations.
 */
export declare function checkMigrations(configPath: string): MigrationCheckResult;
/**
 * Create a backup of the config file before migration.
 * Returns the path to the backup file.
 */
export declare function createBackup(configPath: string): string;
/**
 * Get the most recent backup file for a config.
 */
export declare function getLatestBackup(configPath: string): string | null;
/**
 * Restore config from the most recent backup.
 */
export declare function restoreFromBackup(configPath: string): boolean;
/**
 * Load migration history from the history file.
 */
export declare function loadMigrationHistory(chadgiDir: string): MigrationHistory;
/**
 * Save migration history to the history file.
 */
export declare function saveMigrationHistory(chadgiDir: string, history: MigrationHistory): void;
/**
 * Add an entry to the migration history.
 */
export declare function addMigrationHistoryEntry(chadgiDir: string, entry: MigrationHistoryEntry): void;
/**
 * Run migrations on a config file.
 * Creates a backup before migrating.
 *
 * @param configPath Path to the config file
 * @param options Migration options
 * @returns Result of the migration
 */
export declare function runMigrations(configPath: string, options?: {
    dryRun?: boolean;
    skipBackup?: boolean;
    silent?: boolean;
}): MigrationResult;
/**
 * Preview what migrations would be applied without actually running them.
 */
export declare function previewMigrations(configPath: string): {
    currentVersion: string | null;
    targetVersion: string;
    migrations: Array<{
        from: string;
        to: string;
        description: string;
    }>;
};
//# sourceMappingURL=index.d.ts.map