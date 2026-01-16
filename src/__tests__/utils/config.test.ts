/**
 * Unit tests for src/utils/config.ts
 *
 * Tests YAML parsing and configuration loading utilities.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock the fs module
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => vol.existsSync(path)),
  readFileSync: jest.fn((path: string, encoding?: string) => vol.readFileSync(path, encoding)),
}));

// Import after mocking
const {
  parseYamlValue,
  parseYamlNested,
  parseYamlBoolean,
  parseYamlNumber,
  resolveConfigPath,
  resolveChadgiDir,
  getRepoOwner,
  getRepoName,
  ensureChadgiDirExists,
  parseEnvValue,
  envVarToConfigPath,
  configPathToEnvVar,
  setNestedValue,
  getNestedValue,
  findEnvVarsWithPrefix,
  parseEnvOverrides,
  applyEnvOverrides,
  loadConfigWithEnv,
  getSupportedEnvVars,
  formatEnvVarHelp,
  DEFAULT_ENV_PREFIX,
  SUPPORTED_ENV_CONFIG_PATHS,
} = await import('../../utils/config.js');

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

describe('resolveChadgiDir', () => {
  it('should return default .chadgi directory when no options provided', () => {
    const result = resolveChadgiDir(undefined, '/project');
    expect(result).toBe('/project/.chadgi');
  });

  it('should return default .chadgi directory when options is empty object', () => {
    const result = resolveChadgiDir({}, '/project');
    expect(result).toBe('/project/.chadgi');
  });

  it('should return default .chadgi directory when options.config is undefined', () => {
    const result = resolveChadgiDir({ config: undefined }, '/project');
    expect(result).toBe('/project/.chadgi');
  });

  it('should return parent directory of provided config path', () => {
    const result = resolveChadgiDir({ config: '/custom/path/config.yaml' }, '/project');
    expect(result).toBe('/custom/path');
  });

  it('should resolve relative config paths', () => {
    // Note: resolve() uses the actual cwd, so we test the structure
    const result = resolveChadgiDir({ config: './custom/config.yaml' }, '/project');
    expect(result).toContain('custom');
  });

  it('should handle nested config directories', () => {
    const result = resolveChadgiDir({ config: '/a/b/c/d/config.yaml' }, '/project');
    expect(result).toBe('/a/b/c/d');
  });

  it('should be consistent with resolveConfigPath chadgiDir output', () => {
    // Test that resolveChadgiDir returns the same chadgiDir as resolveConfigPath
    const cwd = '/project';

    // Test with no config
    const resolveChadgiDirResult = resolveChadgiDir(undefined, cwd);
    const resolveConfigPathResult = resolveConfigPath(undefined, cwd);
    expect(resolveChadgiDirResult).toBe(resolveConfigPathResult.chadgiDir);

    // Test with custom config
    const customConfig = '/custom/config.yaml';
    const resolveChadgiDirResult2 = resolveChadgiDir({ config: customConfig }, cwd);
    const resolveConfigPathResult2 = resolveConfigPath(customConfig, cwd);
    expect(resolveChadgiDirResult2).toBe(resolveConfigPathResult2.chadgiDir);
  });
});

describe('ensureChadgiDirExists', () => {
  // Store original process.exit
  const originalExit = process.exit;
  // Store original console.error and console.log
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  let mockExit: jest.Mock;
  let mockConsoleError: jest.Mock;
  let mockConsoleLog: jest.Mock;

  beforeEach(() => {
    vol.reset();
    // Mock process.exit to throw instead of actually exiting
    mockExit = jest.fn(() => {
      throw new Error('process.exit called');
    }) as unknown as jest.Mock;
    process.exit = mockExit as unknown as typeof process.exit;

    // Mock console methods
    mockConsoleError = jest.fn();
    mockConsoleLog = jest.fn();
    console.error = mockConsoleError;
    console.log = mockConsoleLog;
  });

  afterEach(() => {
    // Restore original functions
    process.exit = originalExit;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  it('should return without error when directory exists', () => {
    vol.fromJSON({
      '/project/.chadgi/chadgi-config.yaml': '',
    });

    // Should not throw
    expect(() => ensureChadgiDirExists('/project/.chadgi')).not.toThrow();
    expect(mockExit).not.toHaveBeenCalled();
    expect(mockConsoleError).not.toHaveBeenCalled();
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should exit with error when directory does not exist (non-JSON mode)', () => {
    vol.fromJSON({
      '/project/other-file.txt': '',
    });

    expect(() => ensureChadgiDirExists('/project/.chadgi')).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalledTimes(2);
    expect(mockConsoleError.mock.calls[0][0]).toContain('Error: .chadgi directory not found');
    expect(mockConsoleError.mock.calls[1][0]).toContain('chadgi init');
  });

  it('should exit with JSON error when directory does not exist (JSON mode)', () => {
    vol.fromJSON({
      '/project/other-file.txt': '',
    });

    expect(() => ensureChadgiDirExists('/project/.chadgi', { json: true })).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleLog).toHaveBeenCalledWith(
      JSON.stringify({ success: false, error: '.chadgi directory not found' })
    );
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('should not print JSON error when directory exists and JSON mode is enabled', () => {
    vol.fromJSON({
      '/project/.chadgi/chadgi-config.yaml': '',
    });

    expect(() => ensureChadgiDirExists('/project/.chadgi', { json: true })).not.toThrow();
    expect(mockExit).not.toHaveBeenCalled();
    expect(mockConsoleLog).not.toHaveBeenCalled();
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('should handle undefined options', () => {
    vol.fromJSON({
      '/project/other-file.txt': '',
    });

    expect(() => ensureChadgiDirExists('/project/.chadgi', undefined)).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it('should handle options with json: false', () => {
    vol.fromJSON({
      '/project/other-file.txt': '',
    });

    expect(() => ensureChadgiDirExists('/project/.chadgi', { json: false })).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockConsoleError).toHaveBeenCalled();
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Environment Variable Configuration Tests
// ============================================================================

describe('parseEnvValue', () => {
  it('should parse boolean true (case-insensitive)', () => {
    expect(parseEnvValue('true')).toBe(true);
    expect(parseEnvValue('TRUE')).toBe(true);
    expect(parseEnvValue('True')).toBe(true);
  });

  it('should parse boolean false (case-insensitive)', () => {
    expect(parseEnvValue('false')).toBe(false);
    expect(parseEnvValue('FALSE')).toBe(false);
    expect(parseEnvValue('False')).toBe(false);
  });

  it('should parse integer values', () => {
    expect(parseEnvValue('42')).toBe(42);
    expect(parseEnvValue('0')).toBe(0);
    expect(parseEnvValue('-10')).toBe(-10);
  });

  it('should parse float values', () => {
    expect(parseEnvValue('3.14')).toBe(3.14);
    expect(parseEnvValue('2.00')).toBe(2);
    expect(parseEnvValue('-0.5')).toBe(-0.5);
  });

  it('should preserve string values', () => {
    expect(parseEnvValue('hello')).toBe('hello');
    expect(parseEnvValue('owner/repo')).toBe('owner/repo');
    expect(parseEnvValue('')).toBe('');
  });

  it('should not parse invalid numbers as numbers', () => {
    expect(parseEnvValue('12abc')).toBe('12abc');
    expect(parseEnvValue('1.2.3')).toBe('1.2.3');
    expect(parseEnvValue('NaN')).toBe('NaN');
  });
});

describe('envVarToConfigPath', () => {
  it('should convert simple env var to config path', () => {
    expect(envVarToConfigPath('CHADGI_POLL_INTERVAL', 'CHADGI_')).toBe('poll_interval');
    expect(envVarToConfigPath('CHADGI_TASK_SOURCE', 'CHADGI_')).toBe('task_source');
  });

  it('should convert nested env var to config path', () => {
    expect(envVarToConfigPath('CHADGI_GITHUB__REPO', 'CHADGI_')).toBe('github.repo');
    expect(envVarToConfigPath('CHADGI_ITERATION__MAX_ITERATIONS', 'CHADGI_')).toBe('iteration.max_iterations');
    expect(envVarToConfigPath('CHADGI_BUDGET__PER_TASK_LIMIT', 'CHADGI_')).toBe('budget.per_task_limit');
  });

  it('should work with custom prefix', () => {
    expect(envVarToConfigPath('MYAPP_GITHUB__REPO', 'MYAPP_')).toBe('github.repo');
    expect(envVarToConfigPath('CUSTOM_PREFIX_VALUE', 'CUSTOM_')).toBe('prefix_value');
  });
});

describe('configPathToEnvVar', () => {
  it('should convert simple config path to env var', () => {
    expect(configPathToEnvVar('poll_interval', 'CHADGI_')).toBe('CHADGI_POLL_INTERVAL');
    expect(configPathToEnvVar('task_source', 'CHADGI_')).toBe('CHADGI_TASK_SOURCE');
  });

  it('should convert nested config path to env var', () => {
    expect(configPathToEnvVar('github.repo', 'CHADGI_')).toBe('CHADGI_GITHUB__REPO');
    expect(configPathToEnvVar('iteration.max_iterations', 'CHADGI_')).toBe('CHADGI_ITERATION__MAX_ITERATIONS');
    expect(configPathToEnvVar('budget.per_task_limit', 'CHADGI_')).toBe('CHADGI_BUDGET__PER_TASK_LIMIT');
  });

  it('should work with custom prefix', () => {
    expect(configPathToEnvVar('github.repo', 'MYAPP_')).toBe('MYAPP_GITHUB__REPO');
  });
});

describe('setNestedValue', () => {
  it('should set top-level values', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'key', 'value');
    expect(obj).toEqual({ key: 'value' });
  });

  it('should set nested values', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'github.repo', 'owner/repo');
    expect(obj).toEqual({ github: { repo: 'owner/repo' } });
  });

  it('should create intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, 'a.b.c.d', 'deep');
    expect(obj).toEqual({ a: { b: { c: { d: 'deep' } } } });
  });

  it('should overwrite existing values', () => {
    const obj: Record<string, unknown> = { github: { repo: 'old' } };
    setNestedValue(obj, 'github.repo', 'new');
    expect(obj).toEqual({ github: { repo: 'new' } });
  });

  it('should replace non-object intermediate values', () => {
    const obj: Record<string, unknown> = { github: 'not an object' };
    setNestedValue(obj, 'github.repo', 'owner/repo');
    expect(obj).toEqual({ github: { repo: 'owner/repo' } });
  });
});

describe('getNestedValue', () => {
  it('should get top-level values', () => {
    const obj = { key: 'value' };
    expect(getNestedValue(obj, 'key')).toBe('value');
  });

  it('should get nested values', () => {
    const obj = { github: { repo: 'owner/repo' } };
    expect(getNestedValue(obj, 'github.repo')).toBe('owner/repo');
  });

  it('should return undefined for non-existent paths', () => {
    const obj = { github: { repo: 'owner/repo' } };
    expect(getNestedValue(obj, 'nonexistent')).toBeUndefined();
    expect(getNestedValue(obj, 'github.nonexistent')).toBeUndefined();
    expect(getNestedValue(obj, 'a.b.c')).toBeUndefined();
  });

  it('should handle null values in path', () => {
    const obj = { github: null };
    expect(getNestedValue(obj as Record<string, unknown>, 'github.repo')).toBeUndefined();
  });
});

describe('findEnvVarsWithPrefix', () => {
  it('should find matching env vars', () => {
    const env = {
      CHADGI_GITHUB__REPO: 'owner/repo',
      CHADGI_POLL_INTERVAL: '10',
      OTHER_VAR: 'value',
      PATH: '/usr/bin',
    };
    const result = findEnvVarsWithPrefix('CHADGI_', env);
    expect(result).toContain('CHADGI_GITHUB__REPO');
    expect(result).toContain('CHADGI_POLL_INTERVAL');
    expect(result).not.toContain('OTHER_VAR');
    expect(result).not.toContain('PATH');
  });

  it('should return empty array when no matches', () => {
    const env = { OTHER_VAR: 'value' };
    const result = findEnvVarsWithPrefix('CHADGI_', env);
    expect(result).toEqual([]);
  });

  it('should ignore undefined values', () => {
    const env = {
      CHADGI_DEFINED: 'value',
      CHADGI_UNDEFINED: undefined,
    };
    const result = findEnvVarsWithPrefix('CHADGI_', env);
    expect(result).toContain('CHADGI_DEFINED');
    expect(result).not.toContain('CHADGI_UNDEFINED');
  });
});

describe('parseEnvOverrides', () => {
  it('should parse env vars into override objects', () => {
    const env = {
      CHADGI_GITHUB__REPO: 'owner/repo',
      CHADGI_ITERATION__MAX_ITERATIONS: '10',
      CHADGI_ITERATION__GIGACHAD_MODE: 'true',
    };
    const overrides = parseEnvOverrides('CHADGI_', env);

    expect(overrides).toHaveLength(3);

    const repoOverride = overrides.find(o => o.envVar === 'CHADGI_GITHUB__REPO');
    expect(repoOverride).toEqual({
      envVar: 'CHADGI_GITHUB__REPO',
      configPath: 'github.repo',
      value: 'owner/repo',
      rawValue: 'owner/repo',
    });

    const iterOverride = overrides.find(o => o.envVar === 'CHADGI_ITERATION__MAX_ITERATIONS');
    expect(iterOverride?.value).toBe(10);

    const gigachadOverride = overrides.find(o => o.envVar === 'CHADGI_ITERATION__GIGACHAD_MODE');
    expect(gigachadOverride?.value).toBe(true);
  });

  it('should return empty array when no matching env vars', () => {
    const env = { OTHER_VAR: 'value' };
    const overrides = parseEnvOverrides('CHADGI_', env);
    expect(overrides).toEqual([]);
  });
});

describe('applyEnvOverrides', () => {
  it('should apply overrides to config object', () => {
    const config: Record<string, unknown> = {
      github: { repo: 'original/repo' },
      poll_interval: 5,
    };

    const overrides = [
      { envVar: 'CHADGI_GITHUB__REPO', configPath: 'github.repo', value: 'new/repo', rawValue: 'new/repo' },
      { envVar: 'CHADGI_POLL_INTERVAL', configPath: 'poll_interval', value: 20, rawValue: '20' },
    ];

    applyEnvOverrides(config, overrides);

    expect(config.github).toEqual({ repo: 'new/repo' });
    expect(config.poll_interval).toBe(20);
  });

  it('should create nested structures if needed', () => {
    const config: Record<string, unknown> = {};

    const overrides = [
      { envVar: 'CHADGI_BUDGET__PER_TASK_LIMIT', configPath: 'budget.per_task_limit', value: 5.0, rawValue: '5.0' },
    ];

    applyEnvOverrides(config, overrides);

    expect(config.budget).toEqual({ per_task_limit: 5.0 });
  });
});

describe('loadConfigWithEnv', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should load config and apply env overrides', () => {
    vol.fromJSON({
      '/project/.chadgi/chadgi-config.yaml': validConfig,
    });

    const env = {
      CHADGI_GITHUB__REPO: 'override/repo',
      CHADGI_ITERATION__MAX_ITERATIONS: '15',
    };

    const result = loadConfigWithEnv('/project/.chadgi/chadgi-config.yaml', { env });

    expect(result.config.github.repo).toBe('override/repo');
    expect(result.envOverrides).toHaveLength(2);
    expect(result.envPrefix).toBe('CHADGI_');
  });

  it('should work with custom prefix', () => {
    vol.fromJSON({
      '/project/.chadgi/chadgi-config.yaml': minimalConfig,
    });

    const env = {
      MYAPP_GITHUB__REPO: 'custom/repo',
    };

    const result = loadConfigWithEnv('/project/.chadgi/chadgi-config.yaml', {
      envPrefix: 'MYAPP_',
      env,
    });

    expect(result.config.github.repo).toBe('custom/repo');
    expect(result.envPrefix).toBe('MYAPP_');
  });

  it('should return empty overrides when no env vars match', () => {
    vol.fromJSON({
      '/project/.chadgi/chadgi-config.yaml': validConfig,
    });

    const result = loadConfigWithEnv('/project/.chadgi/chadgi-config.yaml', { env: {} });

    expect(result.envOverrides).toHaveLength(0);
    expect(result.config.github.repo).toBe('SwapLabsInc/ChadGI');
  });

  it('should handle missing config file gracefully', () => {
    vol.reset();

    const env = {
      CHADGI_GITHUB__REPO: 'env/repo',
      CHADGI_GITHUB__PROJECT_NUMBER: '99',
    };

    const result = loadConfigWithEnv('/project/.chadgi/chadgi-config.yaml', { env });

    // Should still apply env overrides even without file
    expect(result.config.github.repo).toBe('env/repo');
    expect(result.envOverrides).toHaveLength(2);
  });
});

describe('getSupportedEnvVars', () => {
  it('should return all supported env var names with default prefix', () => {
    const envVars = getSupportedEnvVars();

    expect(envVars).toContain('CHADGI_GITHUB__REPO');
    expect(envVars).toContain('CHADGI_GITHUB__PROJECT_NUMBER');
    expect(envVars).toContain('CHADGI_ITERATION__MAX_ITERATIONS');
    expect(envVars).toContain('CHADGI_BUDGET__PER_TASK_LIMIT');
    expect(envVars.length).toBe(SUPPORTED_ENV_CONFIG_PATHS.length);
  });

  it('should use custom prefix when provided', () => {
    const envVars = getSupportedEnvVars('MYAPP_');

    expect(envVars).toContain('MYAPP_GITHUB__REPO');
    expect(envVars).not.toContain('CHADGI_GITHUB__REPO');
  });
});

describe('formatEnvVarHelp', () => {
  it('should return formatted help text', () => {
    const help = formatEnvVarHelp();

    expect(help).toContain('Supported Environment Variables:');
    expect(help).toContain('CHADGI_');
    expect(help).toContain('CHADGI_GITHUB__REPO');
    expect(help).toContain('double underscore');
  });

  it('should use custom prefix in help text', () => {
    const help = formatEnvVarHelp('MYAPP_');

    expect(help).toContain('MYAPP_');
    expect(help).toContain('MYAPP_GITHUB__REPO');
  });
});

describe('DEFAULT_ENV_PREFIX', () => {
  it('should be CHADGI_', () => {
    expect(DEFAULT_ENV_PREFIX).toBe('CHADGI_');
  });
});
