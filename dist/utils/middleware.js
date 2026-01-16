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
import { existsSync } from 'fs';
import { createCoreContext, } from './context.js';
import { colors } from './colors.js';
import { getErrorCode, getErrorMessage, ValidationError } from './errors.js';
import { loadConfig as loadConfigFromFile, } from './config.js';
import { debugLog, startTiming } from './debug.js';
/**
 * Exit codes for command errors.
 */
export const EXIT_CODES = {
    SUCCESS: 0,
    GENERAL_ERROR: 1,
    VALIDATION_ERROR: 2,
};
/**
 * Compose multiple middleware functions into a single middleware chain.
 *
 * @param middlewares - Array of middleware functions to compose
 * @returns A composed middleware function
 */
export function composeMiddleware(middlewares) {
    return async (ctx, next) => {
        // Build the chain from right to left
        let index = middlewares.length;
        const dispatch = async (i, currentCtx) => {
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
export function withTiming(ctx, next) {
    const startTime = Date.now();
    const endTimingFn = startTiming('command');
    const timedCtx = {
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
export function withDirectory(ctx, next) {
    const { options, cwd } = ctx;
    let configPath;
    let chadgiDir;
    if (options.config) {
        configPath = resolve(options.config);
        chadgiDir = dirname(configPath);
    }
    else {
        chadgiDir = join(cwd, '.chadgi');
        configPath = join(chadgiDir, 'chadgi-config.yaml');
    }
    debugLog('Resolved paths', { chadgiDir, configPath });
    const directoryCtx = {
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
export function withDirectoryValidation(ctx, next) {
    const { chadgiDir, options } = ctx;
    if (!existsSync(chadgiDir)) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: '.chadgi directory not found' }));
        }
        else {
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
export function withConfig(ctx, next) {
    const { configPath } = ctx;
    const loadedConfig = loadConfigFromFile(configPath);
    const configCtx = {
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
export function withJsonOutput(ctx, next) {
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
export function withErrorHandler(ctx, next) {
    return next(ctx).catch((error) => {
        const isJson = ctx.options.json;
        const exitCode = error instanceof ValidationError ? EXIT_CODES.VALIDATION_ERROR : EXIT_CODES.GENERAL_ERROR;
        if (isJson) {
            console.log(JSON.stringify({
                error: true,
                code: getErrorCode(error),
                message: getErrorMessage(error),
            }, null, 2));
        }
        else {
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
export function withCommand(middlewares, handler, commandOptions = {}) {
    return async (options) => {
        // Create initial context
        const ctx = createCoreContext({ options });
        // Build the full middleware chain
        const allMiddlewares = [];
        // Always add timing first (outermost)
        allMiddlewares.push(withTiming);
        // Add error handler unless skipped
        if (!commandOptions.skipErrorHandler) {
            allMiddlewares.push(withErrorHandler);
        }
        // Add JSON output handler unless skipped
        if (!commandOptions.skipJsonOutput) {
            allMiddlewares.push(withJsonOutput);
        }
        // Add user-provided middlewares
        allMiddlewares.push(...middlewares);
        // Compose all middlewares
        const composed = composeMiddleware(allMiddlewares);
        // Execute the composed middleware chain with the handler as the final step
        await composed(ctx, handler);
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
];
/**
 * Standard middleware stack for commands that need full config.
 * Includes: directory resolution, directory validation, config loading
 */
export const standardConfigMiddleware = [
    withDirectory,
    withDirectoryValidation,
    withConfig,
];
/**
 * Create a command with standard directory middleware.
 *
 * @param handler - The command handler function
 * @param options - Optional configuration
 * @returns A function suitable for use as a CLI command action
 */
export function withDirectoryCommand(handler, options) {
    return withCommand([...standardDirectoryMiddleware], handler, options);
}
/**
 * Create a command with standard config middleware.
 *
 * @param handler - The command handler function
 * @param options - Optional configuration
 * @returns A function suitable for use as a CLI command action
 */
export function withConfigCommand(handler, options) {
    return withCommand([...standardConfigMiddleware], handler, options);
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
export function conditionalMiddleware(optionKey, middleware, invert = false) {
    return async (ctx, next) => {
        const shouldRun = invert
            ? Boolean(ctx.options[optionKey])
            : !ctx.options[optionKey];
        if (shouldRun) {
            return middleware(ctx, next);
        }
        // Skip this middleware, pass context through
        return next(ctx);
    };
}
/**
 * Create a no-op middleware that just passes through.
 * Useful for conditional middleware chains.
 */
export function passthrough(ctx, next) {
    return next(ctx);
}
//# sourceMappingURL=middleware.js.map