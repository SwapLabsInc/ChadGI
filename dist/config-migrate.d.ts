/**
 * ChadGI Config Migration Command
 *
 * Provides CLI interface for migrating configuration files between schema versions.
 */
import type { BaseCommandOptions } from './types/index.js';
export interface ConfigMigrateOptions extends BaseCommandOptions {
    dryRun?: boolean;
    yes?: boolean;
    rollback?: boolean;
}
/**
 * Main config migrate command
 */
export declare function configMigrate(options?: ConfigMigrateOptions): Promise<void>;
/**
 * Check for pending migrations (used by other commands)
 */
export declare function hasPendingMigrations(configPath: string): boolean;
/**
 * Get migration status message (used by other commands)
 */
export declare function getMigrationStatusMessage(configPath: string): string | null;
/**
 * Print migration history
 */
export declare function printMigrationHistory(options?: BaseCommandOptions): Promise<void>;
//# sourceMappingURL=config-migrate.d.ts.map