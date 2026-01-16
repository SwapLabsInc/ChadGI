/**
 * Unit tests for src/utils/fileOps.ts
 *
 * Tests atomic file write utilities for crash-safe file operations
 * and safe JSON parsing utilities.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Track mock calls and allow custom implementations
let writeFileSyncImpl: ((path: string, content: string, encoding?: string) => void) | null = null;
let renameSyncImpl: ((oldPath: string, newPath: string) => void) | null = null;
let unlinkSyncImpl: ((path: string) => void) | null = null;
let existsSyncImpl: ((path: string) => boolean) | null = null;

// Track isVerbose state
let isVerboseState = false;

// Mock the debug module
jest.unstable_mockModule('../../utils/debug.js', () => ({
  isVerbose: jest.fn(() => isVerboseState),
}));

// Mock the fs module
jest.unstable_mockModule('fs', () => ({
  writeFileSync: jest.fn((path: string, content: string, encoding?: string) => {
    if (writeFileSyncImpl) {
      writeFileSyncImpl(path, content, encoding);
    } else {
      // Default implementation using memfs
      const dir = path.substring(0, path.lastIndexOf('/'));
      if (dir && !vol.existsSync(dir)) {
        vol.mkdirSync(dir, { recursive: true });
      }
      vol.writeFileSync(path, content);
    }
  }),
  renameSync: jest.fn((oldPath: string, newPath: string) => {
    if (renameSyncImpl) {
      renameSyncImpl(oldPath, newPath);
    } else {
      // Default implementation using memfs
      const content = vol.readFileSync(oldPath);
      vol.writeFileSync(newPath, content);
      vol.unlinkSync(oldPath);
    }
  }),
  unlinkSync: jest.fn((path: string) => {
    if (unlinkSyncImpl) {
      unlinkSyncImpl(path);
    } else if (vol.existsSync(path)) {
      vol.unlinkSync(path);
    }
  }),
  existsSync: jest.fn((path: string) => {
    if (existsSyncImpl) {
      return existsSyncImpl(path);
    }
    return vol.existsSync(path);
  }),
}));

// Import after mocking
const { atomicWriteFile, atomicWriteJson, safeWriteFile, safeWriteJson, safeParseJson } = await import('../../utils/fileOps.js');
const fsMock = await import('fs');

describe('fileOps utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
    // Reset custom implementations
    writeFileSyncImpl = null;
    renameSyncImpl = null;
    unlinkSyncImpl = null;
    existsSyncImpl = null;
    // Reset verbose state
    isVerboseState = false;
  });

  describe('atomicWriteFile', () => {
    it('should write file content atomically', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      atomicWriteFile('/project/.chadgi/test.txt', 'test content');

      expect(vol.readFileSync('/project/.chadgi/test.txt', 'utf-8')).toBe('test content');
    });

    it('should use writeFileSync for temp file and renameSync for atomic replace', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      atomicWriteFile('/project/.chadgi/config.json', '{"key": "value"}');

      // Should have written to a temp file first
      expect(fsMock.writeFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/\/project\/\.chadgi\/\.tmp\.\d+\.\d+\.[a-z0-9]+$/),
        '{"key": "value"}',
        'utf-8'
      );

      // Should have renamed temp to target
      expect(fsMock.renameSync).toHaveBeenCalledWith(
        expect.stringMatching(/\/project\/\.chadgi\/\.tmp\.\d+\.\d+\.[a-z0-9]+$/),
        '/project/.chadgi/config.json'
      );
    });

    it('should clean up temp file on write error', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      writeFileSyncImpl = () => {
        throw new Error('Disk full');
      };

      expect(() => atomicWriteFile('/project/.chadgi/test.txt', 'content')).toThrow('Disk full');
    });

    it('should clean up temp file on rename error', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      // writeFileSync succeeds but renameSync fails
      writeFileSyncImpl = (path: string, content: string) => {
        vol.writeFileSync(path, content);
      };

      renameSyncImpl = () => {
        throw new Error('Permission denied');
      };

      expect(() => atomicWriteFile('/project/.chadgi/test.txt', 'content')).toThrow('Permission denied');

      // unlinkSync should be called to clean up
      expect(fsMock.unlinkSync).toHaveBeenCalled();
    });

    it('should not fail if cleanup of temp file fails', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      writeFileSyncImpl = () => {
        throw new Error('Write failed');
      };

      existsSyncImpl = () => true;

      unlinkSyncImpl = () => {
        throw new Error('Cannot delete temp file');
      };

      // Should throw the original error, not the cleanup error
      expect(() => atomicWriteFile('/project/.chadgi/test.txt', 'content')).toThrow('Write failed');
    });

    it('should overwrite existing file atomically', () => {
      vol.fromJSON({
        '/project/.chadgi/existing.txt': 'old content',
      });

      atomicWriteFile('/project/.chadgi/existing.txt', 'new content');

      expect(vol.readFileSync('/project/.chadgi/existing.txt', 'utf-8')).toBe('new content');
    });
  });

  describe('atomicWriteJson', () => {
    it('should write JSON with pretty-printing', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      const data = { status: 'running', task: 42 };
      atomicWriteJson('/project/.chadgi/progress.json', data);

      const expected = JSON.stringify(data, null, 2);
      expect(vol.readFileSync('/project/.chadgi/progress.json', 'utf-8')).toBe(expected);
    });

    it('should handle complex nested objects', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      const data = {
        status: 'in_progress',
        current_task: {
          id: '42',
          title: 'Test task',
          branch: 'feature/test',
        },
        session: {
          started_at: '2026-01-15T10:00:00Z',
          tasks_completed: 5,
        },
      };

      atomicWriteJson('/project/.chadgi/progress.json', data);

      const result = JSON.parse(vol.readFileSync('/project/.chadgi/progress.json', 'utf-8') as string);
      expect(result).toEqual(data);
    });

    it('should handle arrays', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      const data = [
        { issue: 1, status: 'completed' },
        { issue: 2, status: 'failed' },
      ];

      atomicWriteJson('/project/.chadgi/tasks.json', data);

      const result = JSON.parse(vol.readFileSync('/project/.chadgi/tasks.json', 'utf-8') as string);
      expect(result).toEqual(data);
    });

    it('should handle null and primitive values', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      atomicWriteJson('/project/.chadgi/null.json', null);
      expect(vol.readFileSync('/project/.chadgi/null.json', 'utf-8')).toBe('null');

      atomicWriteJson('/project/.chadgi/string.json', 'test');
      expect(vol.readFileSync('/project/.chadgi/string.json', 'utf-8')).toBe('"test"');

      atomicWriteJson('/project/.chadgi/number.json', 42);
      expect(vol.readFileSync('/project/.chadgi/number.json', 'utf-8')).toBe('42');
    });
  });

  describe('safeWriteFile', () => {
    it('should write file successfully on first attempt', async () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      await safeWriteFile('/project/.chadgi/test.txt', 'content');

      expect(vol.readFileSync('/project/.chadgi/test.txt', 'utf-8')).toBe('content');
      expect(fsMock.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient EBUSY error', async () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      let attempts = 0;
      writeFileSyncImpl = (path: string, content: string) => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Resource busy') as NodeJS.ErrnoException;
          error.code = 'EBUSY';
          throw error;
        }
        vol.writeFileSync(path, content);
      };

      await safeWriteFile('/project/.chadgi/test.txt', 'content', { retryDelayMs: 10 });

      expect(attempts).toBe(2);
      expect(vol.readFileSync('/project/.chadgi/test.txt', 'utf-8')).toBe('content');
    });

    it('should retry on transient EAGAIN error', async () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      let attempts = 0;
      writeFileSyncImpl = (path: string, content: string) => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('Try again') as NodeJS.ErrnoException;
          error.code = 'EAGAIN';
          throw error;
        }
        vol.writeFileSync(path, content);
      };

      await safeWriteFile('/project/.chadgi/test.txt', 'content', { maxRetries: 5, retryDelayMs: 10 });

      expect(attempts).toBe(3);
    });

    it('should fail immediately on non-transient errors', async () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      writeFileSyncImpl = () => {
        const error = new Error('Permission denied') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        throw error;
      };

      await expect(safeWriteFile('/project/.chadgi/test.txt', 'content')).rejects.toThrow('Permission denied');
      expect(fsMock.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries exceeded', async () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      writeFileSyncImpl = () => {
        const error = new Error('Resource busy') as NodeJS.ErrnoException;
        error.code = 'EBUSY';
        throw error;
      };

      await expect(
        safeWriteFile('/project/.chadgi/test.txt', 'content', { maxRetries: 2, retryDelayMs: 10 })
      ).rejects.toThrow('Resource busy');

      expect(fsMock.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should use default retry options', async () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      writeFileSyncImpl = () => {
        const error = new Error('Resource busy') as NodeJS.ErrnoException;
        error.code = 'EBUSY';
        throw error;
      };

      await expect(safeWriteFile('/project/.chadgi/test.txt', 'content')).rejects.toThrow();

      // Default is 3 retries
      expect(fsMock.writeFileSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('safeWriteJson', () => {
    it('should write JSON safely with retries', async () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      const data = { status: 'running', iteration: 3 };
      await safeWriteJson('/project/.chadgi/progress.json', data);

      const result = JSON.parse(vol.readFileSync('/project/.chadgi/progress.json', 'utf-8') as string);
      expect(result).toEqual(data);
    });

    it('should retry on transient error and succeed', async () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      let attempts = 0;
      writeFileSyncImpl = (path: string, content: string) => {
        attempts++;
        if (attempts === 1) {
          const error = new Error('Resource busy') as NodeJS.ErrnoException;
          error.code = 'EBUSY';
          throw error;
        }
        vol.writeFileSync(path, content);
      };

      await safeWriteJson('/project/.chadgi/config.json', { key: 'value' }, { retryDelayMs: 10 });

      expect(attempts).toBe(2);
    });
  });

  describe('safeParseJson', () => {
    // Capture stderr output
    let stderrOutput: string;
    let originalWrite: typeof process.stderr.write;

    beforeEach(() => {
      stderrOutput = '';
      originalWrite = process.stderr.write;
      process.stderr.write = ((chunk: string) => {
        stderrOutput += chunk;
        return true;
      }) as typeof process.stderr.write;
    });

    afterEach(() => {
      process.stderr.write = originalWrite;
    });

    it('should parse valid JSON and return success', () => {
      const content = '{"key": "value", "count": 42}';
      const result = safeParseJson<{ key: string; count: number }>(content);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.key).toBe('value');
        expect(result.data.count).toBe(42);
      }
    });

    it('should parse valid JSON arrays', () => {
      const content = '[1, 2, 3]';
      const result = safeParseJson<number[]>(content);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it('should return failure for malformed JSON', () => {
      const content = '{"key": "value"';  // Missing closing brace
      const result = safeParseJson<{ key: string }>(content);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
      // Should log warning to stderr
      expect(stderrOutput).toContain('[WARN] JSON parse error');
    });

    it('should return failure for empty content', () => {
      const content = '';
      const result = safeParseJson<unknown>(content);

      expect(result.success).toBe(false);
      expect(stderrOutput).toContain('[WARN] JSON parse error');
    });

    it('should include file path in error message when provided', () => {
      const content = 'not valid json';
      safeParseJson<unknown>(content, { filePath: '/path/to/config.json' });

      expect(stderrOutput).toContain('/path/to/config.json');
    });

    it('should return fallback value on parse error when provided', () => {
      const content = 'invalid json';
      const result = safeParseJson<string[]>(content, {
        filePath: '/test.json',
        fallback: [],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
      // Should still log the warning
      expect(stderrOutput).toContain('[WARN] JSON parse error');
    });

    it('should return fallback object on parse error', () => {
      const content = '{invalid}';
      const fallback = { defaultValue: true };
      const result = safeParseJson<{ defaultValue: boolean }>(content, {
        fallback,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(fallback);
      }
    });

    it('should show debug details when verbose mode is enabled', () => {
      isVerboseState = true;
      const content = '{"incomplete": ';
      safeParseJson<unknown>(content, { filePath: '/test.json' });

      expect(stderrOutput).toContain('[DEBUG]');
      expect(stderrOutput).toContain('Content preview');
      expect(stderrOutput).toContain('Content length');
    });

    it('should not show debug details when verbose mode is disabled', () => {
      isVerboseState = false;
      const content = '{"incomplete": ';
      safeParseJson<unknown>(content, { filePath: '/test.json' });

      expect(stderrOutput).not.toContain('[DEBUG]');
    });

    it('should handle binary content safely', () => {
      // Create content with many non-printable characters
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]).toString();
      isVerboseState = true;
      safeParseJson<unknown>(binaryContent);

      expect(stderrOutput).toContain('[WARN] JSON parse error');
      expect(stderrOutput).toContain('<binary content>');
    });

    it('should truncate long content preview', () => {
      isVerboseState = true;
      // Create content longer than 100 characters
      const longContent = 'a'.repeat(200);
      safeParseJson<unknown>(longContent);

      expect(stderrOutput).toContain('[WARN] JSON parse error');
      expect(stderrOutput).toContain('...');
    });

    it('should handle empty content preview', () => {
      isVerboseState = true;
      safeParseJson<unknown>('');

      expect(stderrOutput).toContain('<empty>');
    });

    it('should parse null JSON value', () => {
      const result = safeParseJson<null>('null');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });

    it('should parse primitive JSON values', () => {
      const stringResult = safeParseJson<string>('"hello"');
      const numberResult = safeParseJson<number>('42');
      const boolResult = safeParseJson<boolean>('true');

      expect(stringResult.success).toBe(true);
      expect(numberResult.success).toBe(true);
      expect(boolResult.success).toBe(true);

      if (stringResult.success) expect(stringResult.data).toBe('hello');
      if (numberResult.success) expect(numberResult.data).toBe(42);
      if (boolResult.success) expect(boolResult.data).toBe(true);
    });

    it('should preserve error position info if available', () => {
      isVerboseState = true;
      // This will cause an error with position info
      const content = '{"key": value}';  // unquoted value
      safeParseJson<unknown>(content);

      expect(stderrOutput).toContain('[WARN] JSON parse error');
      // Position info should be shown in verbose mode
      expect(stderrOutput).toContain('[DEBUG]');
    });
  });
});
