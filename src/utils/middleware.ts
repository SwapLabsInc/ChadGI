/**
 * Command execution middleware for consistent cross-cutting concerns.
 *
 * This module provides a middleware system that reduces boilerplate across
 * command handlers by extracting common patterns like:
 * - Config path resolution
 * - Directory validation
 * - Configuration loading
 * - Error handling
 * - JSON output formatting
 * - Execution timing
 *
 * @example
 * ```ts
 * // Before (repeated in every command)
 * export async function statusCommand(options: StatusOptions) {
 *   try {
 *     const chadgiDir = resolveChadgiDir(options);
 *     ensureChadgiDirExists(chadgiDir);
 *     const config = loadConfig(configPath);
 *     // ... actual logic
 *     if (options.json) console.log(JSON.stringify(result));
 *   } catch (error) {
 *     console.error(error);
 *     process.exit(1);
 *   }
 * }
 *
 * // After (with middleware)
 * export const statusCommand = withCommand(
 *   [withDirectory, withConfig],
 *   async (ctx: CommandContext<StatusOptions>) => {
 *     // ... actual logic only
 *     return result; // middleware handles JSON output
 *   }
 * );
 * ```
 */

import { join, dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { BaseCommandOptions } from '../types/index.js';
import {
  CoreContext,
  DirectoryContext,
  ConfigContext,
  TimedContext,
  CommandContext,
  CommandResult,
  createCoreContext,
} from './context.js';
import { colors } from './colors.js';
import { getErrorCode, getErrorMessage, ValidationError } from './errors.js';
import {
  parseYamlNested,
  loadConfig as loadConfigFromFile,
} from './config.js';
import { debugLog, startTiming } from './debug.js';

/**
 * Middleware function signature.
 * Takes a context and next function, returns a result or void.
 */
export type Middleware<
  TOptions extends BaseCommandOptions = BaseCommandOptions,
  TContextIn extends CoreContext<TOptions> = CoreContext<TOptions>,
  TContextOut extends CoreContext<TOptions> = TContextIn,
> = (
  ctx: TContextIn,
  next: (ctx: TContextOut) => Promise<CommandResult | void>
) => Promise<CommandResult | void>;

/**
 * Command handler function signature.
 * Receives a fully-built context and returns an optional result.
 */
export type CommandHandler<
  TOptions extends BaseCommandOptions = BaseCommandOptions,
  TContext extends CoreContext<TOptions> = CommandContext<TOptions>,
> = (ctx: TContext) => Promise<CommandResult | void>;

/**
 * Exit codes for command errors.
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  VALIDATION_ERROR: 2,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * Options for withCommand configuration.
 */
export interface WithCommandOptions {
  /** Skip JSON output handling (for commands that handle it themselves) */
  skipJsonOutput?: boolean;
  /** Skip error handling (for commands wrapped elsewhere) */
  skipErrorHandler?: boolean;
}

/**
 * Compose multiple middleware functions into a single middleware chain.
 *
 * @param middlewares - Array of middleware functions to compose
 * @returns A composed middleware function
 */
export function composeMiddleware<TOptions extends BaseCommandOptions>(
  middlewares: Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>[]
): Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>> {
  return async (ctx, next) => {
    // Build the chain from right to left
    let index = middlewares.length;
    const dispatch = async (i: number, currentCtx: CoreContext<TOptions>): Promise<CommandResult | void> => {
      if (i === middlewares.length) {
        // End of middleware chain, call the final handler
        return next(currentCtx);
      }
      const middleware = middlewares[i];
      return middleware(currentCtx, (nextCtx) => dispatch(i + 1, nextCtx));
    };
    return dispatch(0, ctx);
  };
}

// ============================================================================
// Built-in Middlewares
// ============================================================================

/**
 * Middleware that adds timing information to the context.
 * Provides startTime and getElapsedMs() for performance tracking.
 */
export function withTiming<TOptions extends BaseCommandOptions>(
  ctx: CoreContext<TOptions>,
  next: (ctx: TimedContext<TOptions>) => Promise<CommandResult | void>
): Promise<CommandResult | void> {
  const startTime = Date.now();
  const endTimingFn = startTiming('command');

  const timedCtx: TimedContext<TOptions> = {
    ...ctx,
    startTime,
    getElapsedMs: () => Date.now() - startTime,
  };

  return next(timedCtx).finally(() => {
    endTimingFn();
    debugLog('Command execution time', { elapsedMs: timedCtx.getElapsedMs() });
  });
}

/**
 * Middleware that resolves the ChadGI directory and config paths.
 * Adds chadgiDir and configPath to the context.
 */
export function withDirectory<TOptions extends BaseCommandOptions>(
  ctx: CoreContext<TOptions>,
  next: (ctx: DirectoryContext<TOptions>) => Promise<CommandResult | void>
): Promise<CommandResult | void> {
  const { options, cwd } = ctx;

  let configPath: string;
  let chadgiDir: string;

  if (options.config) {
    configPath = resolve(options.config);
    chadgiDir = dirname(configPath);
  } else {
    chadgiDir = join(cwd, '.chadgi');
    configPath = join(chadgiDir, 'chadgi-config.yaml');
  }

  debugLog('Resolved paths', { chadgiDir, configPath });

  const directoryCtx: DirectoryContext<TOptions> = {
    ...ctx,
    chadgiDir,
    configPath,
  };

  return next(directoryCtx);
}

/**
 * Middleware that validates the ChadGI directory exists.
 * Exits with error if directory is missing.
 * Requires withDirectory to have run first.
 */
export function withDirectoryValidation<TOptions extends BaseCommandOptions>(
  ctx: DirectoryContext<TOptions>,
  next: (ctx: DirectoryContext<TOptions>) => Promise<CommandResult | void>
): Promise<CommandResult | void> {
  const { chadgiDir, options } = ctx;

  if (!existsSync(chadgiDir)) {
    if (options.json) {
      console.log(JSON.stringify({ success: false, error: '.chadgi directory not found' }));
    } else {
      console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
      console.error('Run `chadgi init` first to initialize ChadGI.');
    }
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }

  return next(ctx);
}

/**
 * Middleware that loads configuration from the config file.
 * Adds config, github, branch, and configContent to the context.
 * Requires withDirectory to have run first.
 */
export function withConfig<TOptions extends BaseCommandOptions>(
  ctx: DirectoryContext<TOptions>,
  next: (ctx: ConfigContext<TOptions>) => Promise<CommandResult | void>
): Promise<CommandResult | void> {
  const { configPath } = ctx;

  const loadedConfig = loadConfigFromFile(configPath);

  const configCtx: ConfigContext<TOptions> = {
    ...ctx,
    configContent: loadedConfig.content,
    github: loadedConfig.github,
    branch: loadedConfig.branch,
    configExists: loadedConfig.exists,
  };

  debugLog('Config loaded via middleware', {
    exists: loadedConfig.exists,
    repo: loadedConfig.github.repo,
  });

  return next(configCtx);
}

/**
 * Middleware that handles JSON output formatting.
 * If options.json is true, the result is JSON.stringify'd and printed.
 * Otherwise, the result is passed through for custom formatting.
 */
export function withJsonOutput<
  TOptions extends BaseCommandOptions,
  TContext extends CoreContext<TOptions>,
>(
  ctx: TContext,
  next: (ctx: TContext) => Promise<CommandResult | void>
): Promise<CommandResult | void> {
  return next(ctx).then((result) => {
    if (result && ctx.options.json && result.data !== undefined) {
      console.log(JSON.stringify(result.data, null, 2));
      return { ...result, data: undefined }; // Clear data to prevent double output
    }
    return result;
  });
}

/**
 * Middleware that provides centralized error handling.
 * Catches errors, formats them appropriately, and exits with proper codes.
 */
export function withErrorHandler<
  TOptions extends BaseCommandOptions,
  TContext extends CoreContext<TOptions>,
>(
  ctx: TContext,
  next: (ctx: TContext) => Promise<CommandResult | void>
): Promise<CommandResult | void> {
  return next(ctx).catch((error: unknown) => {
    const isJson = ctx.options.json;
    const exitCode =
      error instanceof ValidationError ? EXIT_CODES.VALIDATION_ERROR : EXIT_CODES.GENERAL_ERROR;

    if (isJson) {
      console.log(
        JSON.stringify(
          {
            error: true,
            code: getErrorCode(error),
            message: getErrorMessage(error),
          },
          null,
          2
        )
      );
    } else {
      console.error(`${colors.red}Error:${colors.reset} ${getErrorMessage(error)}`);
    }

    process.exit(exitCode);
  });
}

// ============================================================================
// Higher-Order Command Wrapper
// ============================================================================

/**
 * Create a command function with middleware applied.
 *
 * This is the main entry point for creating commands with middleware.
 * It wraps a command handler with a chain of middleware functions.
 *
 * @param middlewares - Array of middleware to apply (executed in order)
 * @param handler - The command handler function
 * @param commandOptions - Optional configuration for the wrapper
 * @returns A function suitable for use as a CLI command action
 *
 * @example
 * ```ts
 * export const statusCommand = withCommand(
 *   [withDirectory, withDirectoryValidation, withConfig],
 *   async (ctx) => {
 *     const { github, chadgiDir } = ctx;
 *     // ... command logic
 *     return { data: statusInfo };
 *   }
 * );
 * ```
 */
export function withCommand<
  TOptions extends BaseCommandOptions = BaseCommandOptions,
  TContext extends CoreContext<TOptions> = CommandContext<TOptions>,
>(
  middlewares: Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>[],
  handler: CommandHandler<TOptions, TContext>,
  commandOptions: WithCommandOptions = {}
): (options?: TOptions) => Promise<void> {
  return async (options?: TOptions): Promise<void> => {
    // Create initial context
    const ctx = createCoreContext<TOptions>({ options });

    // Build the full middleware chain
    const allMiddlewares: Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>[] = [];

    // Always add timing first (outermost)
    allMiddlewares.push(withTiming as Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>);

    // Add error handler unless skipped
    if (!commandOptions.skipErrorHandler) {
      allMiddlewares.push(withErrorHandler as Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>);
    }

    // Add JSON output handler unless skipped
    if (!commandOptions.skipJsonOutput) {
      allMiddlewares.push(withJsonOutput as Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>);
    }

    // Add user-provided middlewares
    allMiddlewares.push(...middlewares);

    // Compose all middlewares
    const composed = composeMiddleware(allMiddlewares);

    // Execute the composed middleware chain with the handler as the final step
    await composed(ctx, handler as CommandHandler<TOptions, CoreContext<TOptions>>);
  };
}

// ============================================================================
// Convenience Presets
// ============================================================================

/**
 * Standard middleware stack for commands that need directory validation.
 * Includes: directory resolution, directory validation
 */
export const standardDirectoryMiddleware = [
  withDirectory,
  withDirectoryValidation,
] as const;

/**
 * Standard middleware stack for commands that need full config.
 * Includes: directory resolution, directory validation, config loading
 */
export const standardConfigMiddleware = [
  withDirectory,
  withDirectoryValidation,
  withConfig,
] as const;

/**
 * Create a command with standard directory middleware.
 *
 * @param handler - The command handler function
 * @param options - Optional configuration
 * @returns A function suitable for use as a CLI command action
 */
export function withDirectoryCommand<TOptions extends BaseCommandOptions>(
  handler: CommandHandler<TOptions, DirectoryContext<TOptions>>,
  options?: WithCommandOptions
): (options?: TOptions) => Promise<void> {
  return withCommand(
    [...standardDirectoryMiddleware] as Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>[],
    handler as CommandHandler<TOptions, CoreContext<TOptions>>,
    options
  );
}

/**
 * Create a command with standard config middleware.
 *
 * @param handler - The command handler function
 * @param options - Optional configuration
 * @returns A function suitable for use as a CLI command action
 */
export function withConfigCommand<TOptions extends BaseCommandOptions>(
  handler: CommandHandler<TOptions, ConfigContext<TOptions>>,
  options?: WithCommandOptions
): (options?: TOptions) => Promise<void> {
  return withCommand(
    [...standardConfigMiddleware] as Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>[],
    handler as CommandHandler<TOptions, CoreContext<TOptions>>,
    options
  );
}

// ============================================================================
// Opt-out Helpers
// ============================================================================

/**
 * Create a middleware that conditionally runs based on an option.
 *
 * @param optionKey - The option key to check
 * @param middleware - The middleware to run if option is not set
 * @param invert - If true, run middleware when option IS set
 * @returns A middleware that conditionally executes
 */
export function conditionalMiddleware<
  TOptions extends BaseCommandOptions,
  TContextIn extends CoreContext<TOptions>,
  TContextOut extends CoreContext<TOptions>,
>(
  optionKey: keyof TOptions,
  middleware: Middleware<TOptions, TContextIn, TContextOut>,
  invert = false
): Middleware<TOptions, TContextIn, TContextOut> {
  return async (ctx, next) => {
    const shouldRun = invert
      ? Boolean(ctx.options[optionKey])
      : !ctx.options[optionKey];

    if (shouldRun) {
      return middleware(ctx, next);
    }
    // Skip this middleware, pass context through
    return next(ctx as unknown as TContextOut);
  };
}

/**
 * Create a no-op middleware that just passes through.
 * Useful for conditional middleware chains.
 */
export function passthrough<
  TOptions extends BaseCommandOptions,
  TContext extends CoreContext<TOptions>,
>(ctx: TContext, next: (ctx: TContext) => Promise<CommandResult | void>): Promise<CommandResult | void> {
  return next(ctx);
}
