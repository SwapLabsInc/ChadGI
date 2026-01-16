/**
 * Configuration and YAML parsing utilities for ChadGI.
 *
 * Provides functions for parsing YAML configuration files and loading config values.
 */
import type { GitHubConfig, BranchConfig } from '../types/index.js';
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
//# sourceMappingURL=config.d.ts.map