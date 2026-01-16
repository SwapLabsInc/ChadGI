/**
 * Unit tests for error context attachment utilities.
 *
 * Tests the ErrorContext system including:
 * - createErrorContext
 * - attachContext
 * - withContext (sync)
 * - withContextAsync (async)
 * - ChadGIError.toJSON() with context
 * - serializeError
 */
import { describe, it, expect } from '@jest/globals';
import { ChadGIError, ConfigError, GitHubError, createErrorContext, attachContext, withContext, withContextAsync, hasErrorContext, getErrorContext, serializeError, } from '../../utils/errors.js';
describe('Error Context Utilities', () => {
    describe('createErrorContext', () => {
        it('should create context with operation and current timestamp', () => {
            const before = new Date();
            const context = createErrorContext({ operation: 'file-read' });
            const after = new Date();
            expect(context.operation).toBe('file-read');
            expect(context.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(context.startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
            expect(context.identifiers).toBeUndefined();
            expect(context.metadata).toBeUndefined();
        });
        it('should create context with identifiers', () => {
            const context = createErrorContext({
                operation: 'github-issue',
                identifiers: { issueNumber: 42, repo: 'owner/repo' },
            });
            expect(context.operation).toBe('github-issue');
            expect(context.identifiers).toEqual({ issueNumber: 42, repo: 'owner/repo' });
        });
        it('should create context with metadata', () => {
            const context = createErrorContext({
                operation: 'queue-process',
                identifiers: { taskId: 'task-123' },
                metadata: { retryCount: 3, lastAttempt: 'failed' },
            });
            expect(context.operation).toBe('queue-process');
            expect(context.metadata).toEqual({ retryCount: 3, lastAttempt: 'failed' });
        });
        it('should support custom operation types', () => {
            const context = createErrorContext({
                operation: 'custom-operation',
                identifiers: { filePath: '/path/to/file' },
            });
            expect(context.operation).toBe('custom-operation');
        });
    });
    describe('attachContext', () => {
        it('should attach context to ChadGIError and compute duration', async () => {
            const context = createErrorContext({
                operation: 'file-read',
                identifiers: { filePath: '/test/file.json' },
            });
            // Wait a bit to ensure duration is measurable
            await new Promise(resolve => setTimeout(resolve, 10));
            const error = new ChadGIError('File not found', 'FILE_NOT_FOUND');
            const enriched = attachContext(error, context);
            expect(enriched).toBe(error); // Same object
            expect(enriched.context).toBeDefined();
            expect(enriched.context.operation).toBe('file-read');
            expect(enriched.context.identifiers).toEqual({ filePath: '/test/file.json' });
            expect(enriched.context.durationMs).toBeGreaterThanOrEqual(10);
        });
        it('should wrap generic Error in ChadGIError with context', () => {
            const context = createErrorContext({
                operation: 'github-api',
                identifiers: { endpoint: '/repos/owner/repo/issues' },
            });
            const genericError = new Error('Network timeout');
            genericError.stack = 'Error: Network timeout\n    at test.js:42';
            const enriched = attachContext(genericError, context);
            expect(enriched).toBeInstanceOf(ChadGIError);
            expect(enriched.message).toBe('Network timeout');
            expect(enriched.code).toBe('UNKNOWN_ERROR');
            expect(enriched.stack).toContain('test.js:42');
            expect(enriched.context).toBeDefined();
            expect(enriched.context.operation).toBe('github-api');
        });
        it('should handle non-Error values', () => {
            const context = createErrorContext({ operation: 'shell-exec' });
            const enriched = attachContext('Something went wrong', context);
            expect(enriched).toBeInstanceOf(ChadGIError);
            expect(enriched.message).toBe('Something went wrong');
            expect(enriched.code).toBe('UNKNOWN_ERROR');
            expect(enriched.context).toBeDefined();
        });
        it('should handle undefined/null values', () => {
            const context = createErrorContext({ operation: 'config-parse' });
            const enriched1 = attachContext(undefined, context);
            expect(enriched1.message).toBe('undefined');
            const enriched2 = attachContext(null, context);
            expect(enriched2.message).toBe('null');
        });
        it('should preserve existing ChadGIError subclass properties', () => {
            const context = createErrorContext({
                operation: 'github-api',
                identifiers: { repo: 'owner/repo' },
            });
            const error = new GitHubError('API rate limit exceeded');
            const enriched = attachContext(error, context);
            expect(enriched).toBe(error);
            expect(enriched.code).toBe('GITHUB_ERROR');
            expect(enriched.context.operation).toBe('github-api');
        });
    });
    describe('hasErrorContext / getErrorContext', () => {
        it('hasErrorContext returns true for ChadGIError with context', () => {
            const error = new ChadGIError('Test error', 'TEST_ERROR');
            error.context = createErrorContext({ operation: 'test' });
            expect(hasErrorContext(error)).toBe(true);
        });
        it('hasErrorContext returns false for ChadGIError without context', () => {
            const error = new ChadGIError('Test error', 'TEST_ERROR');
            expect(hasErrorContext(error)).toBe(false);
        });
        it('hasErrorContext returns false for generic Error', () => {
            const error = new Error('Generic error');
            expect(hasErrorContext(error)).toBe(false);
        });
        it('getErrorContext returns context when present', () => {
            const error = new ChadGIError('Test error', 'TEST_ERROR');
            const ctx = createErrorContext({ operation: 'file-write' });
            error.context = ctx;
            expect(getErrorContext(error)).toBe(ctx);
        });
        it('getErrorContext returns undefined when no context', () => {
            const error = new ChadGIError('Test error', 'TEST_ERROR');
            expect(getErrorContext(error)).toBeUndefined();
            const genericError = new Error('Generic');
            expect(getErrorContext(genericError)).toBeUndefined();
        });
    });
    describe('withContext (sync)', () => {
        it('should return result when function succeeds', () => {
            const result = withContext('file-read', { filePath: '/test/file.txt' }, () => 'file content');
            expect(result).toBe('file content');
        });
        it('should attach context when function throws', () => {
            expect(() => {
                withContext('file-read', { filePath: '/nonexistent/file.txt' }, () => {
                    throw new Error('ENOENT: no such file');
                });
            }).toThrow(ChadGIError);
            try {
                withContext('file-read', { filePath: '/nonexistent/file.txt' }, () => {
                    throw new Error('ENOENT: no such file');
                });
            }
            catch (error) {
                expect(error).toBeInstanceOf(ChadGIError);
                const chadError = error;
                expect(chadError.context).toBeDefined();
                expect(chadError.context.operation).toBe('file-read');
                expect(chadError.context.identifiers).toEqual({ filePath: '/nonexistent/file.txt' });
            }
        });
        it('should preserve ChadGIError and attach context', () => {
            try {
                withContext('config-load', { filePath: '/config.yaml' }, () => {
                    throw new ConfigError('Invalid config format');
                });
            }
            catch (error) {
                const chadError = error;
                expect(chadError).toBeInstanceOf(ConfigError);
                expect(chadError.code).toBe('CONFIG_ERROR');
                expect(chadError.context.operation).toBe('config-load');
            }
        });
        it('should include metadata when provided', () => {
            try {
                withContext('file-write', { filePath: '/test.json' }, () => {
                    throw new Error('Disk full');
                }, { contentType: 'json', size: 1024 });
            }
            catch (error) {
                const chadError = error;
                expect(chadError.context.metadata).toEqual({ contentType: 'json', size: 1024 });
            }
        });
        it('should work with undefined identifiers', () => {
            const result = withContext('shell-exec', undefined, () => 42);
            expect(result).toBe(42);
        });
    });
    describe('withContextAsync', () => {
        it('should return result when async function succeeds', async () => {
            const result = await withContextAsync('github-api', { repo: 'owner/repo', endpoint: '/issues' }, async () => {
                await new Promise(resolve => setTimeout(resolve, 5));
                return { issues: [] };
            });
            expect(result).toEqual({ issues: [] });
        });
        it('should attach context when async function rejects', async () => {
            await expect(withContextAsync('github-issue', { issueNumber: 42, repo: 'owner/repo' }, async () => {
                throw new Error('Issue not found');
            })).rejects.toThrow(ChadGIError);
            try {
                await withContextAsync('github-issue', { issueNumber: 42, repo: 'owner/repo' }, async () => {
                    throw new Error('Issue not found');
                });
            }
            catch (error) {
                const chadError = error;
                expect(chadError.context).toBeDefined();
                expect(chadError.context.operation).toBe('github-issue');
                expect(chadError.context.identifiers).toEqual({ issueNumber: 42, repo: 'owner/repo' });
                expect(chadError.context.durationMs).toBeGreaterThanOrEqual(0);
            }
        });
        it('should include metadata in async context', async () => {
            try {
                await withContextAsync('queue-fetch', { taskId: 'task-123' }, async () => {
                    throw new Error('Queue timeout');
                }, { attempt: 3, timeout: 5000 });
            }
            catch (error) {
                const chadError = error;
                expect(chadError.context.metadata).toEqual({ attempt: 3, timeout: 5000 });
            }
        });
    });
    describe('ChadGIError.toJSON()', () => {
        it('should serialize error without context', () => {
            const error = new ChadGIError('Something failed', 'GENERIC_ERROR');
            const json = error.toJSON();
            expect(json).toEqual({
                name: 'ChadGIError',
                code: 'GENERIC_ERROR',
                message: 'Something failed',
            });
        });
        it('should serialize error with context', () => {
            const error = new ChadGIError('File not found', 'FILE_NOT_FOUND');
            error.context = {
                operation: 'file-read',
                identifiers: { filePath: '/path/to/file.json' },
                startedAt: new Date('2026-01-15T10:30:00.000Z'),
                durationMs: 42,
                metadata: { encoding: 'utf-8' },
            };
            const json = error.toJSON();
            expect(json).toEqual({
                name: 'ChadGIError',
                code: 'FILE_NOT_FOUND',
                message: 'File not found',
                context: {
                    operation: 'file-read',
                    identifiers: { filePath: '/path/to/file.json' },
                    startedAt: '2026-01-15T10:30:00.000Z',
                    durationMs: 42,
                    metadata: { encoding: 'utf-8' },
                },
            });
        });
        it('should serialize subclass with context', () => {
            const error = new GitHubError('API error');
            error.context = {
                operation: 'github-api',
                identifiers: { repo: 'owner/repo' },
                startedAt: new Date('2026-01-15T10:30:00.000Z'),
                durationMs: 100,
            };
            const json = error.toJSON();
            expect(json.name).toBe('GitHubError');
            expect(json.code).toBe('GITHUB_ERROR');
            expect(json.context).toBeDefined();
        });
    });
    describe('serializeError', () => {
        it('should serialize ChadGIError using toJSON', () => {
            const error = new ChadGIError('Test error', 'TEST_ERROR');
            error.context = createErrorContext({ operation: 'test' });
            const serialized = serializeError(error);
            expect(serialized.name).toBe('ChadGIError');
            expect(serialized.code).toBe('TEST_ERROR');
            expect(serialized.context).toBeDefined();
        });
        it('should serialize generic Error', () => {
            const error = new Error('Generic error');
            const serialized = serializeError(error);
            expect(serialized).toEqual({
                name: 'Error',
                message: 'Generic error',
                code: 'UNKNOWN_ERROR',
            });
        });
        it('should serialize non-Error values', () => {
            expect(serializeError('string error')).toEqual({
                name: 'Error',
                message: 'string error',
                code: 'UNKNOWN_ERROR',
            });
            expect(serializeError(42)).toEqual({
                name: 'Error',
                message: '42',
                code: 'UNKNOWN_ERROR',
            });
            expect(serializeError(null)).toEqual({
                name: 'Error',
                message: 'null',
                code: 'UNKNOWN_ERROR',
            });
        });
    });
    describe('Integration: Full error flow', () => {
        it('should handle complete error lifecycle with context', async () => {
            // Simulate a file operation that fails
            const performFileOperation = async (path) => {
                return withContextAsync('file-read', { filePath: path }, async () => {
                    await new Promise(resolve => setTimeout(resolve, 5));
                    throw new Error('ENOENT: no such file or directory');
                }, { encoding: 'utf-8' });
            };
            try {
                await performFileOperation('/nonexistent/config.json');
                expect(true).toBe(false); // Should not reach here
            }
            catch (error) {
                // Verify error is properly enriched
                expect(error).toBeInstanceOf(ChadGIError);
                const chadError = error;
                // Check context
                expect(chadError.context).toBeDefined();
                expect(chadError.context.operation).toBe('file-read');
                expect(chadError.context.identifiers.filePath).toBe('/nonexistent/config.json');
                expect(chadError.context.metadata.encoding).toBe('utf-8');
                expect(chadError.context.durationMs).toBeGreaterThanOrEqual(5);
                // Verify serialization for JSON output
                const serialized = chadError.toJSON();
                expect(serialized.context).toBeDefined();
                expect(serialized.context.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
            }
        });
    });
});
//# sourceMappingURL=error-context.test.js.map