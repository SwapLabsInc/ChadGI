/**
 * Unit tests for src/utils/context.ts
 *
 * Tests the command context types and factory functions.
 */
import { createCoreContext, hasDirectoryContext, hasConfigContext, hasTimingContext, hasFullContext, } from '../../utils/context.js';
describe('context', () => {
    describe('createCoreContext', () => {
        it('should create context with default values', () => {
            const ctx = createCoreContext();
            expect(ctx.options).toEqual({});
            expect(ctx.cwd).toBe(process.cwd());
        });
        it('should create context with provided options', () => {
            const options = { json: true, config: '/path/to/config' };
            const ctx = createCoreContext({ options });
            expect(ctx.options).toEqual(options);
        });
        it('should create context with custom cwd', () => {
            const ctx = createCoreContext({ cwd: '/custom/path' });
            expect(ctx.cwd).toBe('/custom/path');
        });
        it('should create context with both options and cwd', () => {
            const options = { json: true };
            const ctx = createCoreContext({ options, cwd: '/custom/path' });
            expect(ctx.options).toEqual(options);
            expect(ctx.cwd).toBe('/custom/path');
        });
        it('should handle undefined options gracefully', () => {
            const ctx = createCoreContext({ options: undefined });
            expect(ctx.options).toEqual({});
        });
    });
    describe('hasDirectoryContext', () => {
        it('should return true for DirectoryContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                chadgiDir: '/test/.chadgi',
                configPath: '/test/.chadgi/config.yaml',
            };
            expect(hasDirectoryContext(ctx)).toBe(true);
        });
        it('should return false for CoreContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
            };
            expect(hasDirectoryContext(ctx)).toBe(false);
        });
        it('should return false when only chadgiDir is present', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                chadgiDir: '/test/.chadgi',
            };
            expect(hasDirectoryContext(ctx)).toBe(false);
        });
        it('should return false when only configPath is present', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                configPath: '/test/.chadgi/config.yaml',
            };
            expect(hasDirectoryContext(ctx)).toBe(false);
        });
    });
    describe('hasConfigContext', () => {
        it('should return true for ConfigContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                chadgiDir: '/test/.chadgi',
                configPath: '/test/.chadgi/config.yaml',
                configContent: 'test: true',
                github: {
                    repo: 'owner/repo',
                    project_number: '1',
                    ready_column: 'Ready',
                    in_progress_column: 'In Progress',
                    review_column: 'In Review',
                },
                branch: {
                    base: 'main',
                    prefix: 'feature/',
                },
                configExists: true,
            };
            expect(hasConfigContext(ctx)).toBe(true);
        });
        it('should return false for DirectoryContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                chadgiDir: '/test/.chadgi',
                configPath: '/test/.chadgi/config.yaml',
            };
            expect(hasConfigContext(ctx)).toBe(false);
        });
        it('should return false for CoreContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
            };
            expect(hasConfigContext(ctx)).toBe(false);
        });
        it('should return false when missing github property', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                chadgiDir: '/test/.chadgi',
                configPath: '/test/.chadgi/config.yaml',
                configContent: 'test: true',
                branch: { base: 'main', prefix: 'feature/' },
            };
            expect(hasConfigContext(ctx)).toBe(false);
        });
        it('should return false when missing branch property', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                chadgiDir: '/test/.chadgi',
                configPath: '/test/.chadgi/config.yaml',
                configContent: 'test: true',
                github: { repo: 'owner/repo', project_number: '1', ready_column: 'Ready', in_progress_column: 'IP', review_column: 'IR' },
            };
            expect(hasConfigContext(ctx)).toBe(false);
        });
    });
    describe('hasTimingContext', () => {
        it('should return true for TimedContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                startTime: Date.now(),
                getElapsedMs: () => 0,
            };
            expect(hasTimingContext(ctx)).toBe(true);
        });
        it('should return false for CoreContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
            };
            expect(hasTimingContext(ctx)).toBe(false);
        });
        it('should return false when only startTime is present', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                startTime: Date.now(),
            };
            expect(hasTimingContext(ctx)).toBe(false);
        });
        it('should return false when only getElapsedMs is present', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                getElapsedMs: () => 0,
            };
            expect(hasTimingContext(ctx)).toBe(false);
        });
    });
    describe('hasFullContext', () => {
        it('should return true for full CommandContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                chadgiDir: '/test/.chadgi',
                configPath: '/test/.chadgi/config.yaml',
                configContent: 'test: true',
                github: {
                    repo: 'owner/repo',
                    project_number: '1',
                    ready_column: 'Ready',
                    in_progress_column: 'In Progress',
                    review_column: 'In Review',
                },
                branch: {
                    base: 'main',
                    prefix: 'feature/',
                },
                configExists: true,
                startTime: Date.now(),
                getElapsedMs: () => 0,
            };
            expect(hasFullContext(ctx)).toBe(true);
        });
        it('should return false for ConfigContext without timing', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                chadgiDir: '/test/.chadgi',
                configPath: '/test/.chadgi/config.yaml',
                configContent: 'test: true',
                github: {
                    repo: 'owner/repo',
                    project_number: '1',
                    ready_column: 'Ready',
                    in_progress_column: 'In Progress',
                    review_column: 'In Review',
                },
                branch: {
                    base: 'main',
                    prefix: 'feature/',
                },
                configExists: true,
            };
            expect(hasFullContext(ctx)).toBe(false);
        });
        it('should return false for TimedContext without config', () => {
            const ctx = {
                options: {},
                cwd: '/test',
                startTime: Date.now(),
                getElapsedMs: () => 0,
            };
            expect(hasFullContext(ctx)).toBe(false);
        });
        it('should return false for CoreContext', () => {
            const ctx = {
                options: {},
                cwd: '/test',
            };
            expect(hasFullContext(ctx)).toBe(false);
        });
    });
    describe('type inference', () => {
        it('should allow typed options', () => {
            const ctx = createCoreContext({
                options: { myOption: 'test' },
            });
            expect(ctx.options.myOption).toBe('test');
        });
        it('should allow optional BaseCommandOptions properties', () => {
            const ctx = createCoreContext({
                options: {
                    config: '/path/to/config',
                    json: true,
                    debug: false,
                },
            });
            expect(ctx.options.config).toBe('/path/to/config');
            expect(ctx.options.json).toBe(true);
            expect(ctx.options.debug).toBe(false);
        });
    });
});
//# sourceMappingURL=context.test.js.map