/**
 * PR Status command implementation using the middleware system.
 *
 * Displays the status of pull requests from tasks currently in "In Review" column,
 * showing CI status, review status, merge conflict status, and age.
 */

import {
  withCommand,
  withDirectory,
  withDirectoryValidation,
  withConfig,
  type ConfigContext,
  type CommandResult,
} from './utils/index.js';

import { prStatus } from './pr-status.js';
import type { PRStatusOptions } from './types/index.js';

/**
 * PR Status command handler using middleware pattern.
 *
 * The handler receives config already loaded via the context:
 * - ctx.github contains the GitHub configuration
 * - ctx.configContent contains the raw YAML for additional parsing
 * - ctx.configExists indicates if config file was found
 */
async function prStatusHandler(
  ctx: ConfigContext<PRStatusOptions>
): Promise<CommandResult> {
  const { options } = ctx;

  // Delegate to the main pr-status implementation
  await prStatus(options);

  return { success: true };
}

/**
 * PR Status command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 * 5. withDirectoryValidation - ensures .chadgi directory exists
 * 6. withConfig - loads configuration from file
 */
export const prStatusMiddleware = withCommand<PRStatusOptions, ConfigContext<PRStatusOptions>>(
  [withDirectory, withDirectoryValidation, withConfig] as any,
  prStatusHandler
);
