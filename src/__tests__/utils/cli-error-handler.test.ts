/**
 * Unit tests for src/utils/cli-error-handler.ts
 *
 * Tests the centralized CLI error handler wrapper functions.
 */

import { jest } from '@jest/globals';

// Import the module under test
import {
  EXIT_CODES,
  getExitCode,
  formatError,
  formatErrorJson,
  handleCommandError,
  wrapCommand,
  wrapCommandWithArg,
  wrapCommandWithTwoArgs,
} from '../../utils/cli-error-handler.js';

import {
  ChadGIError,
  ValidationError,
  ConfigError,
  GitHubError,
} from '../../utils/errors.js';

describe('cli-error-handler', () => {
  describe('EXIT_CODES', () => {
    it('should have correct exit code values', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
      expect(EXIT_CODES.VALIDATION_ERROR).toBe(2);
    });
  });

  describe('getExitCode', () => {
    it('should return VALIDATION_ERROR for ValidationError', () => {
      const error = new ValidationError('Invalid input', 'field');
      expect(getExitCode(error)).toBe(EXIT_CODES.VALIDATION_ERROR);
    });

    it('should return GENERAL_ERROR for ChadGIError', () => {
      const error = new ChadGIError('Something went wrong', 'TEST_ERROR');
      expect(getExitCode(error)).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should return GENERAL_ERROR for ConfigError', () => {
      const error = new ConfigError('Config is invalid');
      expect(getExitCode(error)).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should return GENERAL_ERROR for GitHubError', () => {
      const error = new GitHubError('GitHub API failed', 'fetch');
      expect(getExitCode(error)).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should return GENERAL_ERROR for generic Error', () => {
      const error = new Error('Generic error');
      expect(getExitCode(error)).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should return GENERAL_ERROR for string error', () => {
      expect(getExitCode('string error')).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should return GENERAL_ERROR for unknown error types', () => {
      expect(getExitCode(null)).toBe(EXIT_CODES.GENERAL_ERROR);
      expect(getExitCode(undefined)).toBe(EXIT_CODES.GENERAL_ERROR);
      expect(getExitCode(42)).toBe(EXIT_CODES.GENERAL_ERROR);
    });
  });

  describe('formatError', () => {
    it('should format ChadGIError with message', () => {
      const error = new ChadGIError('Something went wrong', 'TEST_ERROR');
      const formatted = formatError(error);
      expect(formatted).toContain('Error:');
      expect(formatted).toContain('Something went wrong');
    });

    it('should format ValidationError with message', () => {
      const error = new ValidationError('Invalid input', 'username');
      const formatted = formatError(error);
      expect(formatted).toContain('Error:');
      expect(formatted).toContain('Invalid input');
    });

    it('should format generic Error with message', () => {
      const error = new Error('Generic error message');
      const formatted = formatError(error);
      expect(formatted).toContain('Error:');
      expect(formatted).toContain('Generic error message');
    });

    it('should format string error', () => {
      const formatted = formatError('String error');
      expect(formatted).toContain('Error:');
      expect(formatted).toContain('String error');
    });

    it('should handle non-error types', () => {
      expect(formatError(42)).toContain('42');
      expect(formatError(null)).toContain('null');
      expect(formatError(undefined)).toContain('undefined');
    });
  });

  describe('formatErrorJson', () => {
    it('should format ChadGIError as JSON', () => {
      const error = new ChadGIError('Something went wrong', 'TEST_ERROR');
      const json = formatErrorJson(error);
      expect(json).toEqual({
        error: true,
        code: 'TEST_ERROR',
        message: 'Something went wrong',
      });
    });

    it('should format ValidationError with VALIDATION_ERROR code', () => {
      const error = new ValidationError('Invalid input', 'field');
      const json = formatErrorJson(error);
      expect(json).toEqual({
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
      });
    });

    it('should format ConfigError with CONFIG_ERROR code', () => {
      const error = new ConfigError('Config is invalid');
      const json = formatErrorJson(error);
      expect(json).toEqual({
        error: true,
        code: 'CONFIG_ERROR',
        message: 'Config is invalid',
      });
    });

    it('should format generic Error with UNKNOWN_ERROR code', () => {
      const error = new Error('Generic error');
      const json = formatErrorJson(error);
      expect(json).toEqual({
        error: true,
        code: 'UNKNOWN_ERROR',
        message: 'Generic error',
      });
    });

    it('should format string error with UNKNOWN_ERROR code', () => {
      const json = formatErrorJson('String error');
      expect(json).toEqual({
        error: true,
        code: 'UNKNOWN_ERROR',
        message: 'String error',
      });
    });
  });

  describe('handleCommandError', () => {
    let mockExit: jest.SpiedFunction<typeof process.exit>;
    let mockConsoleError: jest.SpiedFunction<typeof console.error>;
    let mockConsoleLog: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
      mockConsoleLog.mockRestore();
    });

    it('should exit with code 1 for general errors', () => {
      const error = new ChadGIError('Test error', 'TEST');
      expect(() => handleCommandError(error)).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with code 2 for validation errors', () => {
      const error = new ValidationError('Invalid input');
      expect(() => handleCommandError(error)).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should output to stderr in text mode', () => {
      const error = new Error('Test error');
      expect(() => handleCommandError(error, false)).toThrow('process.exit called');
      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should output to stdout in JSON mode', () => {
      const error = new Error('Test error');
      expect(() => handleCommandError(error, true)).toThrow('process.exit called');
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should output valid JSON in JSON mode', () => {
      const error = new ChadGIError('Test error', 'TEST_CODE');
      expect(() => handleCommandError(error, true)).toThrow('process.exit called');

      const logCall = mockConsoleLog.mock.calls[0][0] as string;
      const parsed = JSON.parse(logCall);
      expect(parsed).toEqual({
        error: true,
        code: 'TEST_CODE',
        message: 'Test error',
      });
    });
  });

  describe('wrapCommand', () => {
    let mockExit: jest.SpiedFunction<typeof process.exit>;
    let mockConsoleError: jest.SpiedFunction<typeof console.error>;
    let mockConsoleLog: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
      mockConsoleLog.mockRestore();
    });

    it('should call the wrapped function with options', async () => {
      const mockFn = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const wrapped = wrapCommand(mockFn);

      await wrapped({ json: false });

      expect(mockFn).toHaveBeenCalledWith({ json: false });
    });

    it('should handle successful execution without errors', async () => {
      const mockFn = jest.fn<() => Promise<string>>().mockResolvedValue('success');
      const wrapped = wrapCommand(mockFn);

      await wrapped({});

      expect(mockFn).toHaveBeenCalled();
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should catch errors and exit with appropriate code', async () => {
      const mockFn = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Test error'));
      const wrapped = wrapCommand(mockFn);

      await expect(wrapped({})).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should use JSON output mode when options.json is true', async () => {
      const mockFn = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Test error'));
      const wrapped = wrapCommand(mockFn);

      await expect(wrapped({ json: true })).rejects.toThrow('process.exit called');
      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should use text output mode when options.json is false', async () => {
      const mockFn = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('Test error'));
      const wrapped = wrapCommand(mockFn);

      await expect(wrapped({ json: false })).rejects.toThrow('process.exit called');
      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should handle undefined options', async () => {
      const mockFn = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const wrapped = wrapCommand(mockFn);

      await wrapped();

      expect(mockFn).toHaveBeenCalledWith(undefined);
    });

    it('should exit with code 2 for ValidationError', async () => {
      const mockFn = jest.fn<() => Promise<void>>().mockRejectedValue(
        new ValidationError('Invalid input')
      );
      const wrapped = wrapCommand(mockFn);

      await expect(wrapped({})).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(2);
    });
  });

  describe('wrapCommandWithArg', () => {
    let mockExit: jest.SpiedFunction<typeof process.exit>;
    let mockConsoleError: jest.SpiedFunction<typeof console.error>;
    let mockConsoleLog: jest.SpiedFunction<typeof console.log>;

    beforeEach(() => {
      mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
      mockConsoleLog.mockRestore();
    });

    it('should call the wrapped function with argument and options', async () => {
      const mockFn = jest.fn<(arg: string, options?: object) => Promise<void>>()
        .mockResolvedValue(undefined);
      const wrapped = wrapCommandWithArg(mockFn);

      await wrapped('test-arg', { json: false });

      expect(mockFn).toHaveBeenCalledWith('test-arg', { json: false });
    });

    it('should handle successful execution', async () => {
      const mockFn = jest.fn<(arg: string) => Promise<string>>()
        .mockResolvedValue('success');
      const wrapped = wrapCommandWithArg(mockFn);

      await wrapped('test-arg');

      expect(mockFn).toHaveBeenCalledWith('test-arg', undefined);
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should catch errors and exit', async () => {
      const mockFn = jest.fn<(arg: string) => Promise<void>>()
        .mockRejectedValue(new Error('Test error'));
      const wrapped = wrapCommandWithArg(mockFn);

      await expect(wrapped('test-arg')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should use JSON output when options.json is true', async () => {
      const mockFn = jest.fn<(arg: number) => Promise<void>>()
        .mockRejectedValue(new Error('Test error'));
      const wrapped = wrapCommandWithArg(mockFn);

      await expect(wrapped(42, { json: true })).rejects.toThrow('process.exit called');
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('wrapCommandWithTwoArgs', () => {
    let mockExit: jest.SpiedFunction<typeof process.exit>;
    let mockConsoleError: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
      mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should call the wrapped function with two arguments and options', async () => {
      const mockFn = jest.fn<(arg1: string, arg2: number, options?: object) => Promise<void>>()
        .mockResolvedValue(undefined);
      const wrapped = wrapCommandWithTwoArgs(mockFn);

      await wrapped('test', 42, { json: false });

      expect(mockFn).toHaveBeenCalledWith('test', 42, { json: false });
    });

    it('should handle successful execution', async () => {
      const mockFn = jest.fn<(arg1: string, arg2: string) => Promise<string>>()
        .mockResolvedValue('success');
      const wrapped = wrapCommandWithTwoArgs(mockFn);

      await wrapped('arg1', 'arg2');

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', undefined);
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should catch errors and exit', async () => {
      const mockFn = jest.fn<(arg1: string, arg2: string) => Promise<void>>()
        .mockRejectedValue(new Error('Test error'));
      const wrapped = wrapCommandWithTwoArgs(mockFn);

      await expect(wrapped('arg1', 'arg2')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
