/**
 * Configuration and YAML parsing utilities for ChadGI.
 *
 * Provides functions for parsing YAML configuration files and loading config values.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import type {
  ChadGIConfig,
  GitHubConfig,
  BranchConfig,
  EnvVarOverride,
  ConfigWithSources,
  LoadConfigEnvOptions,
} from '../types/index.js';
import { colors } from './colors.js';
import { debugLog, debugFileOp } from './debug.js';

/**
 * Parse a simple YAML value (top-level key: value extraction)
 *
 * @param content - The YAML content string
 * @param key - The key to find
 * @returns The parsed value or null if not found
 */
export function parseYamlValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (match) {
    return match[1].replace(/["']/g, '').replace(/#.*$/, '').trim();
  }
  return null;
}

/**
 * Parse a nested YAML value (parent.key extraction)
 *
 * @param content - The YAML content string
 * @param parent - The parent key
 * @param key - The nested key to find
 * @returns The parsed value or null if not found
 */
export function parseYamlNested(content: string, parent: string, key: string): string | null {
  const lines = content.split('\n');
  let inParent = false;

  for (const line of lines) {
    if (line.match(new RegExp(`^${parent}:`))) {
      inParent = true;
      continue;
    }
    if (inParent && line.match(/^[a-z]/)) {
      inParent = false;
    }
    if (inParent && line.match(new RegExp(`^\\s+${key}:`))) {
      const value = line.split(':')[1];
      if (value) {
        return value.replace(/["']/g, '').replace(/#.*$/, '').trim();
      }
    }
  }
  return null;
}

/**
 * Parse a nested YAML boolean value
 *
 * @param content - The YAML content string
 * @param parent - The parent key
 * @param key - The nested key to find
 * @returns true if the value is 'true', false otherwise
 */
export function parseYamlBoolean(content: string, parent: string, key: string): boolean {
  const value = parseYamlNested(content, parent, key);
  return value === 'true';
}

/**
 * Parse a nested YAML number value
 *
 * @param content - The YAML content string
 * @param parent - The parent key
 * @param key - The nested key to find
 * @returns The parsed number or undefined if not found or invalid
 */
export function parseYamlNumber(content: string, parent: string, key: string): number | undefined {
  const value = parseYamlNested(content, parent, key);
  if (value === null) return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Resolve the config file path from options or use default
 *
 * @param configOption - Optional config path from command options
 * @param cwd - Current working directory
 * @returns Object with configPath and chadgiDir
 */
export function resolveConfigPath(
  configOption?: string,
  cwd: string = process.cwd()
): { configPath: string; chadgiDir: string } {
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = configOption ? resolve(configOption) : defaultConfigPath;
  const chadgiDir = dirname(configPath);

  return { configPath, chadgiDir };
}

/**
 * Load and parse the ChadGI configuration file
 *
 * @param configPath - Path to the config file
 * @returns The configuration object with all values parsed
 */
export function loadConfig(configPath: string): {
  content: string;
  github: GitHubConfig;
  branch: BranchConfig;
  exists: boolean;
} {
  debugFileOp('check', configPath);
  const exists = existsSync(configPath);

  if (!exists) {
    debugLog('Config file not found, using defaults', { path: configPath });
    return {
      content: '',
      github: {
        repo: 'owner/repo',
        project_number: '1',
        ready_column: 'Ready',
        in_progress_column: 'In Progress',
        review_column: 'In Review',
      },
      branch: {
        base: 'main',
        prefix: 'feature/issue-',
      },
      exists: false,
    };
  }

  debugFileOp('read', configPath);
  const content = readFileSync(configPath, 'utf-8');

  const config = {
    content,
    github: {
      repo: parseYamlNested(content, 'github', 'repo') || 'owner/repo',
      project_number: parseYamlNested(content, 'github', 'project_number') || '1',
      ready_column: parseYamlNested(content, 'github', 'ready_column') || 'Ready',
      in_progress_column: parseYamlNested(content, 'github', 'in_progress_column') || 'In Progress',
      review_column: parseYamlNested(content, 'github', 'review_column') || 'In Review',
      done_column: parseYamlNested(content, 'github', 'done_column') || 'Done',
    },
    branch: {
      base: parseYamlNested(content, 'branch', 'base') || 'main',
      prefix: parseYamlNested(content, 'branch', 'prefix') || 'feature/issue-',
    },
    exists: true,
  };

  debugLog('Config loaded', {
    path: configPath,
    repo: config.github.repo,
    projectNumber: config.github.project_number,
    baseBranch: config.branch.base,
  });

  return config;
}

/**
 * Check if the ChadGI directory exists
 *
 * @param chadgiDir - Path to the .chadgi directory
 * @returns true if the directory exists
 */
export function chadgiDirExists(chadgiDir: string): boolean {
  return existsSync(chadgiDir);
}

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
export function ensureChadgiDirExists(
  chadgiDir: string,
  options?: EnsureChadgiDirOptions
): void {
  if (existsSync(chadgiDir)) {
    return;
  }

  if (options?.json) {
    console.log(JSON.stringify({ success: false, error: '.chadgi directory not found' }));
  } else {
    console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
    console.error('Run `chadgi init` first to initialize ChadGI.');
  }

  process.exit(1);
}

/**
 * Get the repository owner from a repo string (owner/repo format)
 *
 * @param repo - Repository in owner/repo format
 * @returns The owner part
 */
export function getRepoOwner(repo: string): string {
  return repo.split('/')[0];
}

/**
 * Get the repository name from a repo string (owner/repo format)
 *
 * @param repo - Repository in owner/repo format
 * @returns The repository name part
 */
export function getRepoName(repo: string): string {
  return repo.split('/')[1] || repo;
}

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
export function resolveChadgiDir(
  options?: { config?: string },
  cwd: string = process.cwd()
): string {
  if (options?.config) {
    return dirname(resolve(options.config));
  }
  return join(cwd, '.chadgi');
}

// ============================================================================
// Environment Variable Configuration Overrides
// ============================================================================

/**
 * Default prefix for ChadGI environment variables
 */
export const DEFAULT_ENV_PREFIX = 'CHADGI_';

/**
 * Separator for nested config paths in environment variable names.
 * Uses double underscore as per Docker convention.
 */
export const ENV_PATH_SEPARATOR = '__';

/**
 * Parse a string value into its appropriate type (boolean, number, or string).
 *
 * @param value - The string value to parse
 * @returns The parsed value as boolean, number, or string
 */
export function parseEnvValue(value: string): string | number | boolean {
  // Handle boolean values (case-insensitive)
  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true') return true;
  if (lowerValue === 'false') return false;

  // Handle numeric values
  // Only parse as number if it looks like a valid number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const num = parseFloat(value);
    if (!isNaN(num)) return num;
  }

  // Return as string
  return value;
}

/**
 * Convert an environment variable name to a config path.
 *
 * @param envVar - The full environment variable name (e.g., CHADGI_GITHUB__REPO)
 * @param prefix - The prefix to strip (e.g., CHADGI_)
 * @returns The config path (e.g., github.repo)
 */
export function envVarToConfigPath(envVar: string, prefix: string): string {
  // Remove prefix
  const withoutPrefix = envVar.slice(prefix.length);

  // Convert to lowercase and replace double underscores with dots
  return withoutPrefix.toLowerCase().replace(/__/g, '.');
}

/**
 * Convert a config path to an environment variable name.
 *
 * @param configPath - The config path (e.g., github.repo)
 * @param prefix - The prefix to use (e.g., CHADGI_)
 * @returns The environment variable name (e.g., CHADGI_GITHUB__REPO)
 */
export function configPathToEnvVar(configPath: string, prefix: string): string {
  // Replace dots with double underscores and convert to uppercase
  return prefix + configPath.replace(/\./g, '__').toUpperCase();
}

/**
 * Set a value at a nested path in an object.
 *
 * @param obj - The object to modify
 * @param path - Dot-separated path (e.g., "github.repo")
 * @param value - The value to set
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

/**
 * Get a value at a nested path in an object.
 *
 * @param obj - The object to read from
 * @param path - Dot-separated path (e.g., "github.repo")
 * @returns The value at the path, or undefined if not found
 */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Find all environment variables that match the given prefix.
 *
 * @param prefix - The prefix to match (e.g., CHADGI_)
 * @param env - Environment object to scan (defaults to process.env)
 * @returns Array of matching environment variable names
 */
export function findEnvVarsWithPrefix(
  prefix: string,
  env: Record<string, string | undefined> = process.env
): string[] {
  return Object.keys(env).filter(
    (key) => key.startsWith(prefix) && env[key] !== undefined
  );
}

/**
 * Parse environment variables with the given prefix into override objects.
 *
 * @param prefix - The prefix to match (e.g., CHADGI_)
 * @param env - Environment object to scan (defaults to process.env)
 * @returns Array of parsed environment variable overrides
 */
export function parseEnvOverrides(
  prefix: string,
  env: Record<string, string | undefined> = process.env
): EnvVarOverride[] {
  const envVars = findEnvVarsWithPrefix(prefix, env);
  const overrides: EnvVarOverride[] = [];

  for (const envVar of envVars) {
    const rawValue = env[envVar];
    if (rawValue === undefined) continue;

    const configPath = envVarToConfigPath(envVar, prefix);
    const value = parseEnvValue(rawValue);

    overrides.push({
      envVar,
      configPath,
      value,
      rawValue,
    });
  }

  return overrides;
}

/**
 * Apply environment variable overrides to a configuration object.
 *
 * @param config - The base configuration object (will be mutated)
 * @param overrides - Array of environment variable overrides to apply
 */
export function applyEnvOverrides(
  config: Record<string, unknown>,
  overrides: EnvVarOverride[]
): void {
  for (const override of overrides) {
    setNestedValue(config, override.configPath, override.value);
  }
}

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
export function loadConfigWithEnv(
  configPath: string,
  options: LoadConfigEnvOptions = {}
): ConfigWithSources {
  const { envPrefix = DEFAULT_ENV_PREFIX, env = process.env } = options;

  // Load base config from file
  const baseConfig = loadConfig(configPath);

  // Build a full config object from the loaded values
  // Start with defaults and file values
  const config: Record<string, unknown> = {
    github: { ...baseConfig.github },
    branch: { ...baseConfig.branch },
  };

  // Parse the full YAML content for additional fields
  if (baseConfig.exists && baseConfig.content) {
    const content = baseConfig.content;

    // Parse top-level fields
    const taskSource = parseYamlValue(content, 'task_source');
    if (taskSource) config.task_source = taskSource;

    const promptTemplate = parseYamlValue(content, 'prompt_template');
    if (promptTemplate) config.prompt_template = promptTemplate;

    const generateTemplate = parseYamlValue(content, 'generate_template');
    if (generateTemplate) config.generate_template = generateTemplate;

    const progressFile = parseYamlValue(content, 'progress_file');
    if (progressFile) config.progress_file = progressFile;

    const pollInterval = parseYamlValue(content, 'poll_interval');
    if (pollInterval) config.poll_interval = parseFloat(pollInterval) || 10;

    const emptyThreshold = parseYamlValue(content, 'consecutive_empty_threshold');
    if (emptyThreshold) config.consecutive_empty_threshold = parseFloat(emptyThreshold) || 2;

    const onEmptyQueue = parseYamlValue(content, 'on_empty_queue');
    if (onEmptyQueue) config.on_empty_queue = onEmptyQueue;

    // Parse iteration section
    const iteration: Record<string, unknown> = {};
    const maxIter = parseYamlNested(content, 'iteration', 'max_iterations');
    if (maxIter) iteration.max_iterations = parseInt(maxIter, 10) || 5;
    const completionPromise = parseYamlNested(content, 'iteration', 'completion_promise');
    if (completionPromise) iteration.completion_promise = completionPromise;
    const readyPromise = parseYamlNested(content, 'iteration', 'ready_promise');
    if (readyPromise) iteration.ready_promise = readyPromise;
    const testCommand = parseYamlNested(content, 'iteration', 'test_command');
    if (testCommand) iteration.test_command = testCommand;
    const buildCommand = parseYamlNested(content, 'iteration', 'build_command');
    if (buildCommand) iteration.build_command = buildCommand;
    const onMaxIterations = parseYamlNested(content, 'iteration', 'on_max_iterations');
    if (onMaxIterations) iteration.on_max_iterations = onMaxIterations;
    const gigachadMode = parseYamlNested(content, 'iteration', 'gigachad_mode');
    if (gigachadMode) iteration.gigachad_mode = gigachadMode === 'true';
    const gigachadPrefix = parseYamlNested(content, 'iteration', 'gigachad_commit_prefix');
    if (gigachadPrefix) iteration.gigachad_commit_prefix = gigachadPrefix;
    if (Object.keys(iteration).length > 0) config.iteration = iteration;

    // Parse budget section
    const budget: Record<string, unknown> = {};
    const perTaskLimit = parseYamlNested(content, 'budget', 'per_task_limit');
    if (perTaskLimit) budget.per_task_limit = parseFloat(perTaskLimit);
    const perSessionLimit = parseYamlNested(content, 'budget', 'per_session_limit');
    if (perSessionLimit) budget.per_session_limit = parseFloat(perSessionLimit);
    const onTaskBudget = parseYamlNested(content, 'budget', 'on_task_budget_exceeded');
    if (onTaskBudget) budget.on_task_budget_exceeded = onTaskBudget;
    const onSessionBudget = parseYamlNested(content, 'budget', 'on_session_budget_exceeded');
    if (onSessionBudget) budget.on_session_budget_exceeded = onSessionBudget;
    const warningThreshold = parseYamlNested(content, 'budget', 'warning_threshold');
    if (warningThreshold) budget.warning_threshold = parseInt(warningThreshold, 10);
    if (Object.keys(budget).length > 0) config.budget = budget;

    // Parse output section
    const output: Record<string, unknown> = {};
    const showToolDetails = parseYamlNested(content, 'output', 'show_tool_details');
    if (showToolDetails) output.show_tool_details = showToolDetails === 'true';
    const showCost = parseYamlNested(content, 'output', 'show_cost');
    if (showCost) output.show_cost = showCost === 'true';
    const truncateLength = parseYamlNested(content, 'output', 'truncate_length');
    if (truncateLength) output.truncate_length = parseInt(truncateLength, 10);
    const hyperlinks = parseYamlNested(content, 'output', 'hyperlinks');
    if (hyperlinks && ['auto', 'on', 'off'].includes(hyperlinks)) {
      output.hyperlinks = hyperlinks as 'auto' | 'on' | 'off';
    }
    if (Object.keys(output).length > 0) config.output = output;
  }

  // Parse and apply environment variable overrides
  const envOverrides = parseEnvOverrides(envPrefix, env);
  if (envOverrides.length > 0) {
    debugLog('Applying environment variable overrides', {
      count: envOverrides.length,
      overrides: envOverrides.map(o => ({ envVar: o.envVar, configPath: o.configPath })),
    });
  }
  applyEnvOverrides(config, envOverrides);

  return {
    config: config as unknown as ChadGIConfig,
    envOverrides,
    envPrefix,
  };
}

/**
 * List of all supported environment variable config paths.
 * Used for documentation and validation.
 */
export const SUPPORTED_ENV_CONFIG_PATHS = [
  // GitHub configuration
  'github.repo',
  'github.project_number',
  'github.ready_column',
  'github.in_progress_column',
  'github.review_column',
  'github.done_column',
  // Branch configuration
  'branch.base',
  'branch.prefix',
  // Top-level configuration
  'task_source',
  'prompt_template',
  'generate_template',
  'progress_file',
  'poll_interval',
  'consecutive_empty_threshold',
  'on_empty_queue',
  // Iteration configuration
  'iteration.max_iterations',
  'iteration.completion_promise',
  'iteration.ready_promise',
  'iteration.test_command',
  'iteration.build_command',
  'iteration.on_max_iterations',
  'iteration.gigachad_mode',
  'iteration.gigachad_commit_prefix',
  // Budget configuration
  'budget.per_task_limit',
  'budget.per_session_limit',
  'budget.on_task_budget_exceeded',
  'budget.on_session_budget_exceeded',
  'budget.warning_threshold',
  // Output configuration
  'output.show_tool_details',
  'output.show_cost',
  'output.truncate_length',
  'output.hyperlinks',
] as const;

/**
 * Get all supported environment variable names for a given prefix.
 *
 * @param prefix - The prefix to use (default: CHADGI_)
 * @returns Array of environment variable names
 */
export function getSupportedEnvVars(prefix: string = DEFAULT_ENV_PREFIX): string[] {
  return SUPPORTED_ENV_CONFIG_PATHS.map((path) => configPathToEnvVar(path, prefix));
}

/**
 * Format environment variable documentation for help output.
 *
 * @param prefix - The prefix to use (default: CHADGI_)
 * @returns Formatted string with environment variable documentation
 */
export function formatEnvVarHelp(prefix: string = DEFAULT_ENV_PREFIX): string {
  const lines = [
    'Supported Environment Variables:',
    '',
    `All configuration values can be overridden via environment variables using the ${prefix} prefix.`,
    `Nested paths use double underscore (__) as separator.`,
    '',
    'Examples:',
    `  ${prefix}GITHUB__REPO=owner/repo          Override github.repo`,
    `  ${prefix}GITHUB__PROJECT_NUMBER=7        Override github.project_number`,
    `  ${prefix}ITERATION__MAX_ITERATIONS=10    Override iteration.max_iterations`,
    `  ${prefix}BUDGET__PER_TASK_LIMIT=5.00     Override budget.per_task_limit`,
    `  ${prefix}ITERATION__GIGACHAD_MODE=true   Override iteration.gigachad_mode`,
    '',
    'All Supported Variables:',
  ];

  for (const path of SUPPORTED_ENV_CONFIG_PATHS) {
    const envVar = configPathToEnvVar(path, prefix);
    lines.push(`  ${envVar}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Configuration Cross-Field Validation
// ============================================================================

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
export function validateConfigLogic(config: ChadGIConfig): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const warnings: ConfigValidationError[] = [];

  // -------------------------------------------------------------------------
  // Budget Constraints
  // -------------------------------------------------------------------------

  if (config.budget) {
    const { per_task_limit, per_session_limit, warning_threshold } = config.budget;

    // Check for negative budget values
    if (per_task_limit !== undefined && per_task_limit < 0) {
      errors.push({
        fields: ['budget.per_task_limit'],
        message: `per_task_limit cannot be negative (got ${per_task_limit})`,
        severity: 'error',
      });
    }

    if (per_session_limit !== undefined && per_session_limit < 0) {
      errors.push({
        fields: ['budget.per_session_limit'],
        message: `per_session_limit cannot be negative (got ${per_session_limit})`,
        severity: 'error',
      });
    }

    // Check that per_task_limit <= per_session_limit when both are set
    if (
      per_task_limit !== undefined &&
      per_session_limit !== undefined &&
      per_task_limit > per_session_limit
    ) {
      errors.push({
        fields: ['budget.per_task_limit', 'budget.per_session_limit'],
        message: `per_task_limit (${per_task_limit}) cannot exceed per_session_limit (${per_session_limit})`,
        severity: 'error',
      });
    }

    // Check warning_threshold is between 0 and 100
    if (warning_threshold !== undefined) {
      if (warning_threshold < 0) {
        errors.push({
          fields: ['budget.warning_threshold'],
          message: `warning_threshold cannot be negative (got ${warning_threshold})`,
          severity: 'error',
        });
      } else if (warning_threshold > 100) {
        errors.push({
          fields: ['budget.warning_threshold'],
          message: `warning_threshold cannot exceed 100% (got ${warning_threshold})`,
          severity: 'error',
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Column Name Uniqueness
  // -------------------------------------------------------------------------

  if (config.github) {
    const { ready_column, in_progress_column, review_column, done_column } = config.github;

    // Collect all defined column names with their field names
    const columns: Array<{ name: string; field: string }> = [];

    if (ready_column) {
      columns.push({ name: ready_column.toLowerCase(), field: 'github.ready_column' });
    }
    if (in_progress_column) {
      columns.push({ name: in_progress_column.toLowerCase(), field: 'github.in_progress_column' });
    }
    if (review_column) {
      columns.push({ name: review_column.toLowerCase(), field: 'github.review_column' });
    }
    if (done_column) {
      columns.push({ name: done_column.toLowerCase(), field: 'github.done_column' });
    }

    // Check for duplicates
    const seen = new Map<string, string[]>();
    for (const col of columns) {
      const existing = seen.get(col.name);
      if (existing) {
        existing.push(col.field);
      } else {
        seen.set(col.name, [col.field]);
      }
    }

    // Report duplicates
    for (const [name, fields] of seen) {
      if (fields.length > 1) {
        errors.push({
          fields,
          message: `Duplicate column name "${name}" used for ${fields.join(' and ')}`,
          severity: 'error',
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Iteration Constraints
  // -------------------------------------------------------------------------

  if (config.iteration) {
    const { max_iterations } = config.iteration;

    // Check max_iterations >= 1
    if (max_iterations !== undefined && max_iterations < 1) {
      errors.push({
        fields: ['iteration.max_iterations'],
        message: `max_iterations must be at least 1 (got ${max_iterations})`,
        severity: 'error',
      });
    }
  }

  // Check poll_interval >= 1 (top-level field, value is in seconds)
  // Minimum of 1 second to prevent tight loops and excessive API calls
  if (config.poll_interval !== undefined && config.poll_interval < 1) {
    errors.push({
      fields: ['poll_interval'],
      message: `poll_interval must be at least 1 second to prevent tight loops (got ${config.poll_interval})`,
      severity: 'error',
    });
  }

  // -------------------------------------------------------------------------
  // Branch Prefix Conflict
  // -------------------------------------------------------------------------

  if (config.branch) {
    const { base, prefix } = config.branch;

    // Check that branch prefix doesn't start with the base branch name
    // This would cause issues when ChadGI tries to create branches
    if (base && prefix && prefix.startsWith(base)) {
      warnings.push({
        fields: ['branch.base', 'branch.prefix'],
        message: `Branch prefix "${prefix}" starts with base branch name "${base}", which may cause confusion`,
        severity: 'warning',
      });
    }

    // Check that base branch isn't named like a feature branch prefix
    // e.g., base: "feature/issue-" would be problematic
    if (base && prefix && base.includes(prefix)) {
      errors.push({
        fields: ['branch.base', 'branch.prefix'],
        message: `Base branch "${base}" contains branch prefix "${prefix}", which would conflict with feature branches`,
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Formats validation errors for display.
 *
 * @param result - The validation result to format
 * @returns Array of formatted error strings
 */
export function formatConfigValidationErrors(result: ConfigValidationResult): string[] {
  const lines: string[] = [];

  for (const error of result.errors) {
    const fieldList = error.fields.join(', ');
    lines.push(`[ERROR] ${error.message} (fields: ${fieldList})`);
  }

  for (const warning of result.warnings) {
    const fieldList = warning.fields.join(', ');
    lines.push(`[WARNING] ${warning.message} (fields: ${fieldList})`);
  }

  return lines;
}
