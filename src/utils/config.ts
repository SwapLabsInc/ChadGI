/**
 * Configuration and YAML parsing utilities for ChadGI.
 *
 * Provides functions for parsing YAML configuration files and loading config values.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import type { ChadGIConfig, GitHubConfig, BranchConfig } from '../types/index.js';
import { colors } from './colors.js';

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
  const exists = existsSync(configPath);

  if (!exists) {
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

  const content = readFileSync(configPath, 'utf-8');

  return {
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
