/**
 * Migration: v1.0 -> v1.1
 *
 * This is the initial migration that adds the config_version field
 * to existing configuration files.
 *
 * Changes:
 * - Adds config_version: "1.1" field
 * - No schema changes (this migration just stamps the version)
 *
 * This migration serves as a template for future migrations.
 */

import type { Migration } from '../types/index.js';

export const migration_1_0_to_1_1: Migration = {
  fromVersion: '1.0',
  toVersion: '1.1',
  description: 'Add config_version field to configuration (initial migration)',

  migrate: (config: Record<string, unknown>): Record<string, unknown> => {
    // Create a shallow copy to avoid mutating the original
    const migrated = { ...config };

    // Add the config_version field at the top level
    // Note: The actual version update is handled by the migration runner
    // This migration just ensures the field exists
    if (!migrated.config_version) {
      migrated.config_version = '1.1';
    }

    return migrated;
  },
};

/**
 * Example of a more complex migration for future reference:
 *
 * export const migration_1_1_to_1_2: Migration = {
 *   fromVersion: '1.1',
 *   toVersion: '1.2',
 *   description: 'Rename poll_interval to polling.interval_seconds',
 *
 *   migrate: (config: Record<string, unknown>): Record<string, unknown> => {
 *     const migrated = { ...config };
 *
 *     // Example: Move poll_interval to nested polling.interval_seconds
 *     if ('poll_interval' in migrated) {
 *       const pollInterval = migrated.poll_interval;
 *       delete migrated.poll_interval;
 *
 *       if (!migrated.polling) {
 *         migrated.polling = {};
 *       }
 *       (migrated.polling as Record<string, unknown>).interval_seconds = pollInterval;
 *     }
 *
 *     return migrated;
 *   },
 * };
 */
