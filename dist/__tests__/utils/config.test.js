/**
 * Unit tests for src/utils/config.ts
 *
 * Tests YAML parsing and configuration loading utilities.
 */
import { jest } from '@jest/globals';
import { vol } from 'memfs';
// Mock the fs module
jest.unstable_mockModule('fs', () => ({
    existsSync: jest.fn((path) => vol.existsSync(path)),
    readFileSync: jest.fn((path, encoding) => vol.readFileSync(path, encoding)),
}));
// Import after mocking
const { parseYamlValue, parseYamlNested, parseYamlBoolean, parseYamlNumber, resolveConfigPath, resolveChadgiDir, getRepoOwner, getRepoName, ensureChadgiDirExists, } = await import('../../utils/config.js');
import { validConfig, minimalConfig, configWithPriority, configWithDependencies, } from '../fixtures/configs.js';
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
    let mockExit;
    let mockConsoleError;
    let mockConsoleLog;
    beforeEach(() => {
        vol.reset();
        // Mock process.exit to throw instead of actually exiting
        mockExit = jest.fn(() => {
            throw new Error('process.exit called');
        });
        process.exit = mockExit;
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
        expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify({ success: false, error: '.chadgi directory not found' }));
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
//# sourceMappingURL=config.test.js.map