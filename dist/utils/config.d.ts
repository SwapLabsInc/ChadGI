/**
 * Configuration and YAML parsing utilities for ChadGI.
 *
 * Provides functions for parsing YAML configuration files and loading config values.
 */
import type { ChadGIConfig, GitHubConfig, BranchConfig, EnvVarOverride, ConfigWithSources, LoadConfigEnvOptions } from '../types/index.js';
/**
 * Parse a simple YAML value (top-level key: value extraction)
 *
 * @param content - The YAML content string
 * @param key - The key to find
 * @returns The parsed value or null if not found
 */
export declare function parseYamlValue(content: string, key: string): string | null;
/**
 * Parse a nested YAML value (parent.key extraction)
 *
 * @param content - The YAML content string
 * @param parent - The parent key
 * @param key - The nested key to find
 * @returns The parsed value or null if not found
 */
export declare function parseYamlNested(content: string, parent: string, key: string): string | null;
/**
 * Parse a nested YAML boolean value
 *
 * @param content - The YAML content string
 * @param parent - The parent key
 * @param key - The nested key to find
 * @returns true if the value is 'true', false otherwise
 */
export declare function parseYamlBoolean(content: string, parent: string, key: string): boolean;
/**
 * Parse a nested YAML number value
 *
 * @param content - The YAML content string
 * @param parent - The parent key
 * @param key - The nested key to find
 * @returns The parsed number or undefined if not found or invalid
 */
export declare function parseYamlNumber(content: string, parent: string, key: string): number | undefined;
/**
 * Resolve the config file path from options or use default
 *
 * @param configOption - Optional config path from command options
 * @param cwd - Current working directory
 * @returns Object with configPath and chadgiDir
 */
export declare function resolveConfigPath(configOption?: string, cwd?: string): {
    configPath: string;
    chadgiDir: string;
};
/**
 * Load and parse the ChadGI configuration file
 *
 * @param configPath - Path to the config file
 * @returns The configuration object with all values parsed
 */
export declare function loadConfig(configPath: string): {
    content: string;
    github: GitHubConfig;
    branch: BranchConfig;
    exists: boolean;
};
/**
 * Check if the ChadGI directory exists
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns true if the directory exists
 */
export declare function chadgiDirExists(chadgiDir: string): boolean;
/**
 * Options for ensureChadgiDirExists function.
 */
export interface EnsureChadgiDirOptions {
    /** Output error in JSON format instead of console error */
    json?: boolean;
}
/**
 * Ensure the ChadGI directory exists, exiting with an error if not.
 *
 * This utility consolidates the common pattern of checking if the .chadgi
 * directory exists and displaying a consistent error message across all
 * commands that require an initialized ChadGI setup.
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @param options - Optional configuration
 * @param options.json - If true, output JSON error format instead of console error
 *
 * @example
 * ```ts
 * // Standard usage - exits with console error if directory doesn't exist
 * ensureChadgiDirExists(chadgiDir);
 *
 * // JSON mode - outputs JSON error before exiting
 * ensureChadgiDirExists(chadgiDir, { json: true });
 * ```
 */
export declare function ensureChadgiDirExists(chadgiDir: string, options?: EnsureChadgiDirOptions): void;
/**
 * Get the repository owner from a repo string (owner/repo format)
 *
 * @param repo - Repository in owner/repo format
 * @returns The owner part
 */
export declare function getRepoOwner(repo: string): string;
/**
 * Get the repository name from a repo string (owner/repo format)
 *
 * @param repo - Repository in owner/repo format
 * @returns The repository name part
 */
export declare function getRepoName(repo: string): string;
/**
 * Resolve the ChadGI configuration directory path.
 *
 * This is a convenience function for commands that only need the directory path.
 * It consolidates the common pattern of resolving the config directory from
 * either a custom config path or using the default .chadgi directory.
 *
 * @param options - Optional object containing a config path
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns The path to the ChadGI configuration directory
 */
export declare function resolveChadgiDir(options?: {
    config?: string;
}, cwd?: string): string;
/**
 * Default prefix for ChadGI environment variables
 */
export declare const DEFAULT_ENV_PREFIX = "CHADGI_";
/**
 * Separator for nested config paths in environment variable names.
 * Uses double underscore as per Docker convention.
 */
export declare const ENV_PATH_SEPARATOR = "__";
/**
 * Parse a string value into its appropriate type (boolean, number, or string).
 *
 * @param value - The string value to parse
 * @returns The parsed value as boolean, number, or string
 */
export declare function parseEnvValue(value: string): string | number | boolean;
/**
 * Convert an environment variable name to a config path.
 *
 * @param envVar - The full environment variable name (e.g., CHADGI_GITHUB__REPO)
 * @param prefix - The prefix to strip (e.g., CHADGI_)
 * @returns The config path (e.g., github.repo)
 */
export declare function envVarToConfigPath(envVar: string, prefix: string): string;
/**
 * Convert a config path to an environment variable name.
 *
 * @param configPath - The config path (e.g., github.repo)
 * @param prefix - The prefix to use (e.g., CHADGI_)
 * @returns The environment variable name (e.g., CHADGI_GITHUB__REPO)
 */
export declare function configPathToEnvVar(configPath: string, prefix: string): string;
/**
 * Set a value at a nested path in an object.
 *
 * @param obj - The object to modify
 * @param path - Dot-separated path (e.g., "github.repo")
 * @param value - The value to set
 */
export declare function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void;
/**
 * Get a value at a nested path in an object.
 *
 * @param obj - The object to read from
 * @param path - Dot-separated path (e.g., "github.repo")
 * @returns The value at the path, or undefined if not found
 */
export declare function getNestedValue(obj: Record<string, unknown>, path: string): unknown;
/**
 * Find all environment variables that match the given prefix.
 *
 * @param prefix - The prefix to match (e.g., CHADGI_)
 * @param env - Environment object to scan (defaults to process.env)
 * @returns Array of matching environment variable names
 */
export declare function findEnvVarsWithPrefix(prefix: string, env?: Record<string, string | undefined>): string[];
/**
 * Parse environment variables with the given prefix into override objects.
 *
 * @param prefix - The prefix to match (e.g., CHADGI_)
 * @param env - Environment object to scan (defaults to process.env)
 * @returns Array of parsed environment variable overrides
 */
export declare function parseEnvOverrides(prefix: string, env?: Record<string, string | undefined>): EnvVarOverride[];
/**
 * Apply environment variable overrides to a configuration object.
 *
 * @param config - The base configuration object (will be mutated)
 * @param overrides - Array of environment variable overrides to apply
 */
export declare function applyEnvOverrides(config: Record<string, unknown>, overrides: EnvVarOverride[]): void;
/**
 * Load configuration with environment variable overrides.
 *
 * This function loads the YAML config file and applies any environment
 * variable overrides. Environment variables take precedence over file values.
 *
 * Environment variables should be named with the prefix (default: CHADGI_)
 * followed by the config path in uppercase with dots replaced by double
 * underscores. For example:
 * - CHADGI_GITHUB__REPO -> github.repo
 * - CHADGI_ITERATION__MAX_ITERATIONS -> iteration.max_iterations
 * - CHADGI_BUDGET__PER_TASK_LIMIT -> budget.per_task_limit
 *
 * @param configPath - Path to the YAML config file
 * @param options - Options including custom env prefix and env object
 * @returns Configuration with source tracking information
 */
export declare function loadConfigWithEnv(configPath: string, options?: LoadConfigEnvOptions): ConfigWithSources;
/**
 * List of all supported environment variable config paths.
 * Used for documentation and validation.
 */
export declare const SUPPORTED_ENV_CONFIG_PATHS: readonly ["github.repo", "github.project_number", "github.ready_column", "github.in_progress_column", "github.review_column", "github.done_column", "branch.base", "branch.prefix", "task_source", "prompt_template", "generate_template", "progress_file", "poll_interval", "consecutive_empty_threshold", "on_empty_queue", "iteration.max_iterations", "iteration.completion_promise", "iteration.ready_promise", "iteration.test_command", "iteration.build_command", "iteration.on_max_iterations", "iteration.gigachad_mode", "iteration.gigachad_commit_prefix", "budget.per_task_limit", "budget.per_session_limit", "budget.on_task_budget_exceeded", "budget.on_session_budget_exceeded", "budget.warning_threshold", "output.show_tool_details", "output.show_cost", "output.truncate_length", "output.hyperlinks"];
/**
 * Get all supported environment variable names for a given prefix.
 *
 * @param prefix - The prefix to use (default: CHADGI_)
 * @returns Array of environment variable names
 */
export declare function getSupportedEnvVars(prefix?: string): string[];
/**
 * Format environment variable documentation for help output.
 *
 * @param prefix - The prefix to use (default: CHADGI_)
 * @returns Formatted string with environment variable documentation
 */
export declare function formatEnvVarHelp(prefix?: string): string;
/**
 * Validation error indicating a logical constraint violation
 */
export interface ConfigValidationError {
    /** The config field(s) that caused the error */
    fields: string[];
    /** Human-readable error message */
    message: string;
    /** Error severity: 'error' means invalid config, 'warning' is informational */
    severity: 'error' | 'warning';
}
/**
 * Result of configuration logic validation
 */
export interface ConfigValidationResult {
    /** Whether the configuration is valid (no errors) */
    valid: boolean;
    /** List of validation errors found */
    errors: ConfigValidationError[];
    /** List of validation warnings found */
    warnings: ConfigValidationError[];
}
/**
 * Validates cross-field logical constraints in the configuration.
 *
 * This function runs after schema validation to catch logically invalid
 * configurations that are technically valid YAML but would cause runtime
 * errors or unexpected behavior.
 *
 * Validates:
 * - Budget constraints (per_task_limit <= per_session_limit, warning_threshold 0-100, no negatives)
 * - Column name uniqueness (ready, in_progress, review, done must be different)
 * - Iteration constraints (max_iterations >= 1, poll_interval >= 100)
 * - Branch prefix doesn't conflict with base branch
 *
 * @param config - The configuration object to validate
 * @returns Validation result with errors and warnings
 */
export declare function validateConfigLogic(config: ChadGIConfig): ConfigValidationResult;
/**
 * Formats validation errors for display.
 *
 * @param result - The validation result to format
 * @returns Array of formatted error strings
 */
export declare function formatConfigValidationErrors(result: ConfigValidationResult): string[];
//# sourceMappingURL=config.d.ts.map