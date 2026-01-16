/**
 * Command context types and factory for ChadGI middleware system.
 *
 * The context object provides a typed interface for commands to access
 * common resources like configuration, paths, and options without
 * needing to resolve them manually.
 */
import type { BaseCommandOptions, ChadGIConfig, GitHubConfig, BranchConfig } from '../types/index.js';
/**
 * Core context properties available to all commands.
 * This is the minimal context that every command receives.
 */
export interface CoreContext<T extends BaseCommandOptions = BaseCommandOptions> {
    /** Command options passed from CLI */
    options: T;
    /** Current working directory */
    cwd: string;
}
/**
 * Context with resolved ChadGI directory paths.
 */
export interface DirectoryContext<T extends BaseCommandOptions = BaseCommandOptions> extends CoreContext<T> {
    /** Path to the .chadgi directory */
    chadgiDir: string;
    /** Path to the config file */
    configPath: string;
}
/**
 * Context with loaded configuration.
 */
export interface ConfigContext<T extends BaseCommandOptions = BaseCommandOptions> extends DirectoryContext<T> {
    /** Raw YAML content of the config file */
    configContent: string;
    /** Parsed GitHub configuration */
    github: GitHubConfig;
    /** Parsed branch configuration */
    branch: BranchConfig;
    /** Whether the config file exists */
    configExists: boolean;
    /** Full parsed configuration (when available) */
    config?: ChadGIConfig;
}
/**
 * Context with timing information.
 */
export interface TimedContext<T extends BaseCommandOptions = BaseCommandOptions> extends CoreContext<T> {
    /** Timestamp when command execution started */
    startTime: number;
    /** Function to get elapsed time in milliseconds */
    getElapsedMs: () => number;
}
/**
 * Full command context combining all context types.
 * Commands can declare which subset of context they need.
 */
export interface CommandContext<T extends BaseCommandOptions = BaseCommandOptions> extends ConfigContext<T>, TimedContext<T> {
}
/**
 * Partial context type for middleware that builds up context incrementally.
 * Each middleware adds its portion to the context.
 */
export type PartialContext<T extends BaseCommandOptions = BaseCommandOptions> = Partial<CommandContext<T>> & CoreContext<T>;
/**
 * Result type for commands that can return data for JSON output.
 */
export interface CommandResult<T = unknown> {
    /** The result data (will be JSON.stringify'd if json option is true) */
    data?: T;
    /** Optional success flag (defaults to true) */
    success?: boolean;
    /** Optional message to display */
    message?: string;
}
/**
 * Options for creating a new command context.
 */
export interface CreateContextOptions<T extends BaseCommandOptions = BaseCommandOptions> {
    /** Command options from CLI */
    options?: T;
    /** Override current working directory */
    cwd?: string;
}
/**
 * Create a new core context with minimal setup.
 *
 * @param createOptions - Options for creating the context
 * @returns A new CoreContext instance
 */
export declare function createCoreContext<T extends BaseCommandOptions = BaseCommandOptions>(createOptions?: CreateContextOptions<T>): CoreContext<T>;
/**
 * Type guard to check if context has directory information.
 */
export declare function hasDirectoryContext<T extends BaseCommandOptions>(ctx: CoreContext<T>): ctx is DirectoryContext<T>;
/**
 * Type guard to check if context has config information.
 */
export declare function hasConfigContext<T extends BaseCommandOptions>(ctx: CoreContext<T>): ctx is ConfigContext<T>;
/**
 * Type guard to check if context has timing information.
 */
export declare function hasTimingContext<T extends BaseCommandOptions>(ctx: CoreContext<T>): ctx is TimedContext<T>;
/**
 * Type guard to check if context has full command context.
 */
export declare function hasFullContext<T extends BaseCommandOptions>(ctx: CoreContext<T>): ctx is CommandContext<T>;
//# sourceMappingURL=context.d.ts.map