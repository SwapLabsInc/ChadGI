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
import type { BaseCommandOptions } from '../types/index.js';
import { CoreContext, DirectoryContext, ConfigContext, TimedContext, CommandContext, CommandResult } from './context.js';
/**
 * Middleware function signature.
 * Takes a context and next function, returns a result or void.
 */
export type Middleware<TOptions extends BaseCommandOptions = BaseCommandOptions, TContextIn extends CoreContext<TOptions> = CoreContext<TOptions>, TContextOut extends CoreContext<TOptions> = TContextIn> = (ctx: TContextIn, next: (ctx: TContextOut) => Promise<CommandResult | void>) => Promise<CommandResult | void>;
/**
 * Command handler function signature.
 * Receives a fully-built context and returns an optional result.
 */
export type CommandHandler<TOptions extends BaseCommandOptions = BaseCommandOptions, TContext extends CoreContext<TOptions> = CommandContext<TOptions>> = (ctx: TContext) => Promise<CommandResult | void>;
/**
 * Exit codes for command errors.
 */
export declare const EXIT_CODES: {
    readonly SUCCESS: 0;
    readonly GENERAL_ERROR: 1;
    readonly VALIDATION_ERROR: 2;
};
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
export declare function composeMiddleware<TOptions extends BaseCommandOptions>(middlewares: Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>[]): Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>;
/**
 * Middleware that adds timing information to the context.
 * Provides startTime and getElapsedMs() for performance tracking.
 */
export declare function withTiming<TOptions extends BaseCommandOptions>(ctx: CoreContext<TOptions>, next: (ctx: TimedContext<TOptions>) => Promise<CommandResult | void>): Promise<CommandResult | void>;
/**
 * Middleware that resolves the ChadGI directory and config paths.
 * Adds chadgiDir and configPath to the context.
 */
export declare function withDirectory<TOptions extends BaseCommandOptions>(ctx: CoreContext<TOptions>, next: (ctx: DirectoryContext<TOptions>) => Promise<CommandResult | void>): Promise<CommandResult | void>;
/**
 * Middleware that validates the ChadGI directory exists.
 * Exits with error if directory is missing.
 * Requires withDirectory to have run first.
 */
export declare function withDirectoryValidation<TOptions extends BaseCommandOptions>(ctx: DirectoryContext<TOptions>, next: (ctx: DirectoryContext<TOptions>) => Promise<CommandResult | void>): Promise<CommandResult | void>;
/**
 * Middleware that loads configuration from the config file.
 * Adds config, github, branch, and configContent to the context.
 * Requires withDirectory to have run first.
 */
export declare function withConfig<TOptions extends BaseCommandOptions>(ctx: DirectoryContext<TOptions>, next: (ctx: ConfigContext<TOptions>) => Promise<CommandResult | void>): Promise<CommandResult | void>;
/**
 * Middleware that handles JSON output formatting.
 * If options.json is true, the result is JSON.stringify'd and printed.
 * Otherwise, the result is passed through for custom formatting.
 */
export declare function withJsonOutput<TOptions extends BaseCommandOptions, TContext extends CoreContext<TOptions>>(ctx: TContext, next: (ctx: TContext) => Promise<CommandResult | void>): Promise<CommandResult | void>;
/**
 * Middleware that provides centralized error handling.
 * Catches errors, formats them appropriately, and exits with proper codes.
 */
export declare function withErrorHandler<TOptions extends BaseCommandOptions, TContext extends CoreContext<TOptions>>(ctx: TContext, next: (ctx: TContext) => Promise<CommandResult | void>): Promise<CommandResult | void>;
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
export declare function withCommand<TOptions extends BaseCommandOptions = BaseCommandOptions, TContext extends CoreContext<TOptions> = CommandContext<TOptions>>(middlewares: Middleware<TOptions, CoreContext<TOptions>, CoreContext<TOptions>>[], handler: CommandHandler<TOptions, TContext>, commandOptions?: WithCommandOptions): (options?: TOptions) => Promise<void>;
/**
 * Standard middleware stack for commands that need directory validation.
 * Includes: directory resolution, directory validation
 */
export declare const standardDirectoryMiddleware: readonly [typeof withDirectory, typeof withDirectoryValidation];
/**
 * Standard middleware stack for commands that need full config.
 * Includes: directory resolution, directory validation, config loading
 */
export declare const standardConfigMiddleware: readonly [typeof withDirectory, typeof withDirectoryValidation, typeof withConfig];
/**
 * Create a command with standard directory middleware.
 *
 * @param handler - The command handler function
 * @param options - Optional configuration
 * @returns A function suitable for use as a CLI command action
 */
export declare function withDirectoryCommand<TOptions extends BaseCommandOptions>(handler: CommandHandler<TOptions, DirectoryContext<TOptions>>, options?: WithCommandOptions): (options?: TOptions) => Promise<void>;
/**
 * Create a command with standard config middleware.
 *
 * @param handler - The command handler function
 * @param options - Optional configuration
 * @returns A function suitable for use as a CLI command action
 */
export declare function withConfigCommand<TOptions extends BaseCommandOptions>(handler: CommandHandler<TOptions, ConfigContext<TOptions>>, options?: WithCommandOptions): (options?: TOptions) => Promise<void>;
/**
 * Create a middleware that conditionally runs based on an option.
 *
 * @param optionKey - The option key to check
 * @param middleware - The middleware to run if option is not set
 * @param invert - If true, run middleware when option IS set
 * @returns A middleware that conditionally executes
 */
export declare function conditionalMiddleware<TOptions extends BaseCommandOptions, TContextIn extends CoreContext<TOptions>, TContextOut extends CoreContext<TOptions>>(optionKey: keyof TOptions, middleware: Middleware<TOptions, TContextIn, TContextOut>, invert?: boolean): Middleware<TOptions, TContextIn, TContextOut>;
/**
 * Create a no-op middleware that just passes through.
 * Useful for conditional middleware chains.
 */
export declare function passthrough<TOptions extends BaseCommandOptions, TContext extends CoreContext<TOptions>>(ctx: TContext, next: (ctx: TContext) => Promise<CommandResult | void>): Promise<CommandResult | void>;
//# sourceMappingURL=middleware.d.ts.map