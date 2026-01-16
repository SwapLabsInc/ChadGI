/**
 * Unit tests for src/utils/config.ts
 *
 * Tests YAML parsing and configuration loading utilities.
 */

import {
  parseYamlValue,
  parseYamlNested,
  parseYamlBoolean,
  parseYamlNumber,
  resolveConfigPath,
  getRepoOwner,
  getRepoName,
} from '../../utils/config.js';

import {
  validConfig,
  minimalConfig,
  configWithPriority,
  configWithDependencies,
} from '../fixtures/configs.js';

describe('parseYamlValue', () => {
  it('should parse top-level string values', () => {
    expect(parseYamlValue(validConfig, 'task_source')).toBe('github-issues');
    expect(parseYamlValue(validConfig, 'prompt_template')).toBe('./chadgi-task.md');
  });

  it('should strip quotes from values', () => {
    const config = `key: "quoted value"`;
    expect(parseYamlValue(config, 'key')).toBe('quoted value');

    const config2 = `key: 'single quoted'`;
    expect(parseYamlValue(config2, 'key')).toBe('single quoted');
  });

  it('should strip comments from values', () => {
    const config = `key: value # this is a comment`;
    expect(parseYamlValue(config, 'key')).toBe('value');
  });

  it('should return null for non-existent keys', () => {
    expect(parseYamlValue(validConfig, 'non_existent')).toBeNull();
    expect(parseYamlValue(validConfig, 'fake_key')).toBeNull();
  });

  it('should handle keys with numeric values', () => {
    expect(parseYamlValue(validConfig, 'poll_interval')).toBe('10');
    expect(parseYamlValue(validConfig, 'consecutive_empty_threshold')).toBe('2');
  });
});

describe('parseYamlNested', () => {
  it('should parse nested string values', () => {
    expect(parseYamlNested(validConfig, 'github', 'repo')).toBe('SwapLabsInc/ChadGI');
    expect(parseYamlNested(validConfig, 'github', 'project_number')).toBe('7');
    expect(parseYamlNested(validConfig, 'github', 'ready_column')).toBe('Ready');
  });

  it('should parse nested values from branch section', () => {
    expect(parseYamlNested(validConfig, 'branch', 'base')).toBe('main');
    expect(parseYamlNested(validConfig, 'branch', 'prefix')).toBe('feature/issue-');
  });

  it('should parse nested values from iteration section', () => {
    expect(parseYamlNested(validConfig, 'iteration', 'max_iterations')).toBe('5');
    expect(parseYamlNested(validConfig, 'iteration', 'completion_promise')).toBe('COMPLETE');
    expect(parseYamlNested(validConfig, 'iteration', 'gigachad_mode')).toBe('false');
  });

  it('should return null for non-existent parent', () => {
    expect(parseYamlNested(validConfig, 'nonexistent', 'key')).toBeNull();
  });

  it('should return null for non-existent nested key', () => {
    expect(parseYamlNested(validConfig, 'github', 'nonexistent')).toBeNull();
  });

  it('should work with minimal config', () => {
    expect(parseYamlNested(minimalConfig, 'github', 'repo')).toBe('owner/repo');
    expect(parseYamlNested(minimalConfig, 'github', 'project_number')).toBe('1');
  });
});

describe('parseYamlBoolean', () => {
  it('should return true for "true" values', () => {
    expect(parseYamlBoolean(configWithPriority, 'priority', 'enabled')).toBe(true);
    expect(parseYamlBoolean(configWithDependencies, 'dependencies', 'enabled')).toBe(true);
  });

  it('should return false for "false" values', () => {
    expect(parseYamlBoolean(validConfig, 'iteration', 'gigachad_mode')).toBe(false);
  });

  it('should return false for non-existent keys', () => {
    expect(parseYamlBoolean(validConfig, 'github', 'nonexistent')).toBe(false);
    expect(parseYamlBoolean(validConfig, 'nonexistent', 'key')).toBe(false);
  });

  it('should return false for non-boolean values', () => {
    // string values should return false
    expect(parseYamlBoolean(validConfig, 'github', 'repo')).toBe(false);
  });
});

describe('parseYamlNumber', () => {
  it('should parse integer values', () => {
    expect(parseYamlNumber(validConfig, 'iteration', 'max_iterations')).toBe(5);
    expect(parseYamlNumber(validConfig, 'budget', 'warning_threshold')).toBe(80);
  });

  it('should parse float values', () => {
    expect(parseYamlNumber(validConfig, 'budget', 'per_task_limit')).toBe(2.0);
    expect(parseYamlNumber(validConfig, 'budget', 'per_session_limit')).toBe(20.0);
  });

  it('should return undefined for non-existent keys', () => {
    expect(parseYamlNumber(validConfig, 'github', 'nonexistent')).toBeUndefined();
    expect(parseYamlNumber(validConfig, 'nonexistent', 'key')).toBeUndefined();
  });

  it('should return undefined for non-numeric values', () => {
    expect(parseYamlNumber(validConfig, 'github', 'repo')).toBeUndefined();
    expect(parseYamlNumber(validConfig, 'iteration', 'completion_promise')).toBeUndefined();
  });
});

describe('resolveConfigPath', () => {
  it('should return default config path when no option provided', () => {
    const { configPath, chadgiDir } = resolveConfigPath(undefined, '/project');
    expect(configPath).toBe('/project/.chadgi/chadgi-config.yaml');
    expect(chadgiDir).toBe('/project/.chadgi');
  });

  it('should use provided config path', () => {
    const { configPath, chadgiDir } = resolveConfigPath('/custom/config.yaml', '/project');
    expect(configPath).toBe('/custom/config.yaml');
    expect(chadgiDir).toBe('/custom');
  });

  it('should resolve relative config path', () => {
    // Note: resolve() behavior depends on cwd, so test the structure
    const { chadgiDir } = resolveConfigPath('./custom/config.yaml', '/project');
    expect(chadgiDir).toContain('custom');
  });
});

describe('getRepoOwner', () => {
  it('should extract owner from repo string', () => {
    expect(getRepoOwner('SwapLabsInc/ChadGI')).toBe('SwapLabsInc');
    expect(getRepoOwner('facebook/react')).toBe('facebook');
    expect(getRepoOwner('owner/repo')).toBe('owner');
  });

  it('should handle single-segment strings', () => {
    expect(getRepoOwner('owner')).toBe('owner');
  });
});

describe('getRepoName', () => {
  it('should extract repo name from repo string', () => {
    expect(getRepoName('SwapLabsInc/ChadGI')).toBe('ChadGI');
    expect(getRepoName('facebook/react')).toBe('react');
    expect(getRepoName('owner/repo')).toBe('repo');
  });

  it('should handle single-segment strings', () => {
    expect(getRepoName('repo')).toBe('repo');
  });
});
