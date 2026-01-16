/**
 * Centralized CLI option definitions for consistent option declarations across commands.
 *
 * This module eliminates duplicate option declarations by providing:
 * 1. OPTION_DEFINITIONS - Standard option configurations with flags, descriptions, and parsers
 * 2. addStandardOptions - Helper to apply multiple standard options to a command
 *
 * Usage:
 * ```ts
 * import { addStandardOptions, OPTION_DEFINITIONS } from './utils/cli-options.js';
 *
 * const cmd = program.command('mycommand');
 * addStandardOptions(cmd, ['config', 'json', 'limit']);
 * ```
 *
 * @module utils/cli-options
 */
import type { Command } from 'commander';
/**
 * Standard option names available for CLI commands.
 * Use const assertion for type-safe option name references.
 */
export declare const STANDARD_OPTION_NAMES: readonly ["config", "json", "limit", "since", "verbose", "dryRun", "yes", "force", "days"];
export type StandardOptionName = (typeof STANDARD_OPTION_NAMES)[number];
/**
 * Configuration for a CLI option definition.
 */
export interface OptionDefinition {
    /** Short and long flags (e.g., '-c, --config <path>') */
    flags: string;
    /** Description shown in help text */
    description: string;
    /** Default value if any */
    defaultValue?: unknown;
    /** Parser function for option values (e.g., numeric parsing with validation) */
    parser?: (value: string, previous: unknown) => unknown;
}
/**
 * Default config file path used across commands.
 */
export declare const DEFAULT_CONFIG_PATH = "./.chadgi/chadgi-config.yaml";
/**
 * Centralized option definitions for common CLI options.
 *
 * These definitions ensure consistent naming, descriptions, and validation
 * across all commands that use these options.
 */
export declare const OPTION_DEFINITIONS: Record<StandardOptionName, OptionDefinition>;
/**
 * Adds a single standard option to a command.
 *
 * @param command - The Commander command to add the option to
 * @param optionName - The standard option name to add
 * @returns The command (for chaining)
 *
 * @example
 * ```ts
 * addStandardOption(program.command('status'), 'config');
 * ```
 */
export declare function addStandardOption<T extends Command>(command: T, optionName: StandardOptionName): T;
/**
 * Adds multiple standard options to a command.
 *
 * This is the primary helper function for reducing duplicate option declarations.
 * It applies each specified option with consistent flags, descriptions, and parsers.
 *
 * @param command - The Commander command to add options to
 * @param optionNames - Array of standard option names to add
 * @returns The command (for chaining)
 *
 * @example
 * ```ts
 * // Add config, json, and limit options
 * const cmd = program.command('history');
 * addStandardOptions(cmd, ['config', 'json', 'limit']);
 *
 * // Chain with additional command-specific options
 * addStandardOptions(program.command('queue'), ['config', 'json'])
 *   .option('--priority <level>', 'Filter by priority');
 * ```
 */
export declare function addStandardOptions<T extends Command>(command: T, optionNames: StandardOptionName[]): T;
/**
 * Get the option definition for a standard option.
 * Useful when you need to inspect or customize a definition.
 *
 * @param optionName - The standard option name
 * @returns The option definition
 */
export declare function getOptionDefinition(optionName: StandardOptionName): OptionDefinition;
/**
 * Check if an option name is a valid standard option.
 *
 * @param name - The option name to check
 * @returns True if the name is a valid standard option
 */
export declare function isStandardOption(name: string): name is StandardOptionName;
/**
 * Type guard for checking if options object has a standard option property.
 *
 * @param options - The options object to check
 * @param optionName - The option name to check for
 * @returns True if the options object has the specified option
 */
export declare function hasOption<T extends Record<string, unknown>>(options: T, optionName: StandardOptionName): boolean;
/**
 * Defines a conflict rule between mutually exclusive options.
 *
 * @property exclusive - Array of option names that cannot be used together
 * @property message - User-friendly error message explaining the conflict
 */
export interface ConflictRule {
    /** Option names that are mutually exclusive */
    exclusive: string[];
    /** Error message to display when conflict is detected */
    message: string;
}
/**
 * Result of option conflict validation.
 */
export interface ConflictValidationResult {
    /** Whether the options are valid (no conflicts) */
    valid: boolean;
    /** Array of conflict error messages if invalid */
    errors: string[];
}
/**
 * Declarative conflict rules for CLI commands.
 *
 * Each command can have multiple conflict rules that define which options
 * cannot be used together and why.
 *
 * Option names should use camelCase as Commander.js converts kebab-case
 * flags (--dry-run) to camelCase properties (dryRun).
 */
export declare const OPTION_CONFLICTS: Record<string, ConflictRule[]>;
/**
 * Validates that no conflicting options are used together for a command.
 *
 * @param commandName - The name of the command being executed
 * @param options - The parsed options object from Commander
 * @returns Validation result with any conflict errors
 *
 * @example
 * ```ts
 * const result = validateOptionConflicts('cleanup', { all: true, branches: true });
 * if (!result.valid) {
 *   console.error(result.errors[0]); // "Options --all and --branches cannot be used together"
 *   process.exit(1);
 * }
 * ```
 */
export declare function validateOptionConflicts(commandName: string, options: Record<string, unknown>): ConflictValidationResult;
/**
 * Get the conflict rules for a specific command.
 * Useful for documentation or testing.
 *
 * @param commandName - The command name to get rules for
 * @returns Array of conflict rules, or empty array if none defined
 */
export declare function getConflictRules(commandName: string): ConflictRule[];
/**
 * Check if a command has any conflict rules defined.
 *
 * @param commandName - The command name to check
 * @returns True if the command has conflict rules
 */
export declare function hasConflictRules(commandName: string): boolean;
//# sourceMappingURL=cli-options.d.ts.map