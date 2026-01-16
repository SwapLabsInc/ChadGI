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
import { createNumericParser } from './validation.js';
import { parseSince } from './formatting.js';

/**
 * Standard option names available for CLI commands.
 * Use const assertion for type-safe option name references.
 */
export const STANDARD_OPTION_NAMES = [
  'config',
  'json',
  'limit',
  'since',
  'verbose',
  'dryRun',
  'yes',
  'force',
  'days',
] as const;

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
export const DEFAULT_CONFIG_PATH = './.chadgi/chadgi-config.yaml';

/**
 * Centralized option definitions for common CLI options.
 *
 * These definitions ensure consistent naming, descriptions, and validation
 * across all commands that use these options.
 */
export const OPTION_DEFINITIONS: Record<StandardOptionName, OptionDefinition> = {
  /**
   * Path to configuration file.
   * Used by most commands to load ChadGI settings.
   */
  config: {
    flags: '-c, --config <path>',
    description: `Path to config file (default: ${DEFAULT_CONFIG_PATH})`,
  },

  /**
   * JSON output mode.
   * When enabled, command output is formatted as JSON for machine parsing.
   */
  json: {
    flags: '-j, --json',
    description: 'Output as JSON for machine-readable output',
  },

  /**
   * Limit the number of results.
   * Used by commands that return lists (history, queue, logs, etc.).
   */
  limit: {
    flags: '-l, --limit <n>',
    description: 'Maximum number of items to display',
    parser: createNumericParser('limit', 'limit'),
  },

  /**
   * Filter results by time.
   * Supports relative formats (7d, 2w, 1m) and absolute dates (2024-01-01).
   */
  since: {
    flags: '-s, --since <time>',
    description: 'Filter by time (e.g., 7d, 2w, 1m, 2024-01-01)',
    parser: parseSinceOption,
  },

  /**
   * Enable verbose output for debugging.
   * Shows additional details about command execution.
   */
  verbose: {
    flags: '-v, --verbose',
    description: 'Enable verbose output for debugging',
  },

  /**
   * Dry run mode - preview without making changes.
   * Shows what would happen without actually modifying anything.
   */
  dryRun: {
    flags: '-d, --dry-run',
    description: 'Preview changes without making modifications',
  },

  /**
   * Skip confirmation prompts.
   * Automatically answer yes to all confirmation dialogs.
   */
  yes: {
    flags: '-y, --yes',
    description: 'Skip confirmation prompts',
  },

  /**
   * Force operation even if it would normally be blocked.
   * Overrides safety checks and existing files.
   */
  force: {
    flags: '-f, --force',
    description: 'Force operation, overriding safety checks',
  },

  /**
   * Number of days for time-based filtering.
   * Used by commands that filter by age (cleanup, insights, etc.).
   */
  days: {
    flags: '--days <n>',
    description: 'Number of days for time-based filtering',
    parser: createNumericParser('days', 'days'),
  },
} as const;

/**
 * Parser for the --since option that validates the time format.
 * Returns the original string value for downstream parsing.
 *
 * @param value - The time value string (e.g., '7d', '2024-01-01')
 * @returns The validated time string
 */
function parseSinceOption(value: string): string {
  // Validate that the format is parseable
  const parsed = parseSince(value);
  if (parsed === null) {
    // Return the value anyway - let the command handler show a more contextual warning
    // This matches the existing behavior in history-middleware.ts
    return value;
  }
  return value;
}

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
export function addStandardOption<T extends Command>(
  command: T,
  optionName: StandardOptionName
): T {
  const definition = OPTION_DEFINITIONS[optionName];

  if (definition.parser) {
    if (definition.defaultValue !== undefined) {
      command.option(definition.flags, definition.description, definition.parser, definition.defaultValue);
    } else {
      command.option(definition.flags, definition.description, definition.parser);
    }
  } else if (definition.defaultValue !== undefined) {
    command.option(definition.flags, definition.description, String(definition.defaultValue));
  } else {
    command.option(definition.flags, definition.description);
  }

  return command;
}

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
export function addStandardOptions<T extends Command>(
  command: T,
  optionNames: StandardOptionName[]
): T {
  for (const optionName of optionNames) {
    addStandardOption(command, optionName);
  }
  return command;
}

/**
 * Get the option definition for a standard option.
 * Useful when you need to inspect or customize a definition.
 *
 * @param optionName - The standard option name
 * @returns The option definition
 */
export function getOptionDefinition(optionName: StandardOptionName): OptionDefinition {
  return OPTION_DEFINITIONS[optionName];
}

/**
 * Check if an option name is a valid standard option.
 *
 * @param name - The option name to check
 * @returns True if the name is a valid standard option
 */
export function isStandardOption(name: string): name is StandardOptionName {
  return STANDARD_OPTION_NAMES.includes(name as StandardOptionName);
}

/**
 * Type guard for checking if options object has a standard option property.
 *
 * @param options - The options object to check
 * @param optionName - The option name to check for
 * @returns True if the options object has the specified option
 */
export function hasOption<T extends Record<string, unknown>>(
  options: T,
  optionName: StandardOptionName
): boolean {
  return optionName in options && options[optionName] !== undefined;
}

// ============================================================================
// Option Conflict Detection
// ============================================================================

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
export const OPTION_CONFLICTS: Record<string, ConflictRule[]> = {
  /**
   * cleanup command conflicts:
   * --all includes branches, diagnostics, and logs, so specifying them
   * together is redundant and potentially confusing.
   */
  cleanup: [
    {
      exclusive: ['all', 'branches'],
      message: '--all already includes branches cleanup',
    },
    {
      exclusive: ['all', 'diagnostics'],
      message: '--all already includes diagnostics cleanup',
    },
    {
      exclusive: ['all', 'logs'],
      message: '--all already includes logs cleanup',
    },
  ],

  /**
   * replay command conflicts:
   * Only one task selector can be specified at a time.
   */
  replay: [
    {
      exclusive: ['last', 'allFailed'],
      message: 'specify only one task selector: --last or --all-failed',
    },
    {
      exclusive: ['last', 'issueNumber'],
      message: 'specify only one task selector: --last or issue number',
    },
    {
      exclusive: ['allFailed', 'issueNumber'],
      message: 'specify only one task selector: --all-failed or issue number',
    },
  ],

  /**
   * diff command conflicts:
   * PR number and issue number target different sources.
   */
  diff: [
    {
      exclusive: ['pr', 'issueNumber'],
      message: '--pr and issue number cannot be used together; they specify different diff sources',
    },
  ],

  /**
   * unlock command conflicts:
   * --all targets all locks, so specifying a specific issue is contradictory.
   */
  unlock: [
    {
      exclusive: ['all', 'issueNumber'],
      message: '--all cannot be used with a specific issue number',
    },
  ],

  /**
   * logs view command conflicts:
   * --follow streams real-time output which is incompatible with --json formatting.
   */
  'logs view': [
    {
      exclusive: ['follow', 'json'],
      message: '--follow cannot be used with --json; follow mode streams real-time output',
    },
  ],
};

/**
 * Checks if an option value is considered "set" (truthy or explicitly provided).
 *
 * @param value - The option value to check
 * @returns True if the option is set/active
 */
function isOptionSet(value: unknown): boolean {
  // For boolean flags, check if true
  if (typeof value === 'boolean') {
    return value;
  }
  // For other values, check if defined and not null/undefined
  return value !== undefined && value !== null;
}

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
export function validateOptionConflicts(
  commandName: string,
  options: Record<string, unknown>
): ConflictValidationResult {
  const rules = OPTION_CONFLICTS[commandName];

  // No conflict rules defined for this command
  if (!rules || rules.length === 0) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  for (const rule of rules) {
    // Find which options from this exclusive group are actually set
    const setOptions = rule.exclusive.filter((optName) =>
      isOptionSet(options[optName])
    );

    // Conflict detected if more than one option in the exclusive group is set
    if (setOptions.length > 1) {
      // Convert camelCase back to CLI flag format for error message
      const flagNames = setOptions.map((name) => {
        // Convert camelCase to kebab-case and prepend --
        const kebabCase = name.replace(/([A-Z])/g, '-$1').toLowerCase();
        // Handle special case for positional arguments (e.g., issueNumber)
        if (name === 'issueNumber') {
          return '<issue-number>';
        }
        return `--${kebabCase}`;
      });

      errors.push(
        `Options ${flagNames.join(' and ')} cannot be used together: ${rule.message}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the conflict rules for a specific command.
 * Useful for documentation or testing.
 *
 * @param commandName - The command name to get rules for
 * @returns Array of conflict rules, or empty array if none defined
 */
export function getConflictRules(commandName: string): ConflictRule[] {
  return OPTION_CONFLICTS[commandName] || [];
}

/**
 * Check if a command has any conflict rules defined.
 *
 * @param commandName - The command name to check
 * @returns True if the command has conflict rules
 */
export function hasConflictRules(commandName: string): boolean {
  const rules = OPTION_CONFLICTS[commandName];
  return Array.isArray(rules) && rules.length > 0;
}
