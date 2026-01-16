/**
 * Unit tests for src/utils/diagnostics.ts
 *
 * Tests the structured diagnostic logging utilities for silent catch handlers.
 */

import { jest } from '@jest/globals';

// Mock the colors module to avoid ANSI codes in tests
jest.unstable_mockModule('../../utils/colors.js', () => ({
  colors: {
    reset: '',
    bold: '',
    dim: '',
    red: '',
    green: '',
    yellow: '',
    blue: '',
    purple: '',
    magenta: '',
    cyan: '',
    white: '',
    gray: '',
  },
}));

// Mock the debug module
jest.unstable_mockModule('../../utils/debug.js', () => ({
  isVerbose: jest.fn(() => false),
}));

// Import after mocking
const { isVerbose } = await import('../../utils/debug.js');
const {
  ErrorCategory,
  logSilentError,
  getSilentErrorSummary,
  getAllSilentErrors,
  clearSilentErrors,
  getSilentErrorCount,
  hasUnknownErrors,
  formatErrorSummary,
} = await import('../../utils/diagnostics.js');

describe('ErrorCategory enum', () => {
  it('should have EXPECTED value', () => {
    expect(ErrorCategory.EXPECTED).toBe('expected');
  });

  it('should have RETRIABLE value', () => {
    expect(ErrorCategory.RETRIABLE).toBe('retriable');
  });

  it('should have TRANSIENT value', () => {
    expect(ErrorCategory.TRANSIENT).toBe('transient');
  });

  it('should have UNKNOWN value', () => {
    expect(ErrorCategory.UNKNOWN).toBe('unknown');
  });
});

describe('logSilentError', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;
  const mockIsVerbose = isVerbose as jest.Mock;

  beforeEach(() => {
    clearSilentErrors();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockIsVerbose.mockReturnValue(false);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  describe('error registration', () => {
    it('should register error in registry', () => {
      logSilentError(new Error('test error'), 'test context', ErrorCategory.EXPECTED);

      const summary = getSilentErrorSummary();
      expect(summary.total).toBe(1);
      expect(summary.byCategory[ErrorCategory.EXPECTED]).toBe(1);
    });

    it('should register multiple errors', () => {
      logSilentError(new Error('error 1'), 'context 1', ErrorCategory.EXPECTED);
      logSilentError(new Error('error 2'), 'context 2', ErrorCategory.UNKNOWN);
      logSilentError(new Error('error 3'), 'context 3', ErrorCategory.TRANSIENT);

      const summary = getSilentErrorSummary();
      expect(summary.total).toBe(3);
      expect(summary.byCategory[ErrorCategory.EXPECTED]).toBe(1);
      expect(summary.byCategory[ErrorCategory.UNKNOWN]).toBe(1);
      expect(summary.byCategory[ErrorCategory.TRANSIENT]).toBe(1);
    });

    it('should default to UNKNOWN category', () => {
      logSilentError(new Error('test error'), 'test context');

      const summary = getSilentErrorSummary();
      expect(summary.byCategory[ErrorCategory.UNKNOWN]).toBe(1);
    });

    it('should capture stack trace for UNKNOWN errors', () => {
      const error = new Error('unknown error');
      logSilentError(error, 'unknown context', ErrorCategory.UNKNOWN);

      const errors = getAllSilentErrors();
      expect(errors[0].stack).toBeDefined();
      expect(errors[0].stack).toContain('Error: unknown error');
    });

    it('should not capture stack trace for EXPECTED errors', () => {
      const error = new Error('expected error');
      logSilentError(error, 'expected context', ErrorCategory.EXPECTED);

      const errors = getAllSilentErrors();
      expect(errors[0].stack).toBeUndefined();
    });
  });

  describe('error message extraction', () => {
    it('should extract message from Error object', () => {
      logSilentError(new Error('test message'), 'context', ErrorCategory.EXPECTED);

      const errors = getAllSilentErrors();
      expect(errors[0].message).toBe('test message');
    });

    it('should handle string error', () => {
      logSilentError('string error', 'context', ErrorCategory.EXPECTED);

      const errors = getAllSilentErrors();
      expect(errors[0].message).toBe('string error');
    });

    it('should stringify object errors', () => {
      logSilentError({ code: 'ERR', msg: 'fail' }, 'context', ErrorCategory.EXPECTED);

      const errors = getAllSilentErrors();
      expect(errors[0].message).toContain('ERR');
      expect(errors[0].message).toContain('fail');
    });

    it('should handle null/undefined errors', () => {
      logSilentError(null, 'context', ErrorCategory.EXPECTED);
      logSilentError(undefined, 'context', ErrorCategory.EXPECTED);

      const errors = getAllSilentErrors();
      expect(errors.length).toBe(2);
    });
  });

  describe('verbose output', () => {
    it('should not output when verbose is disabled', () => {
      mockIsVerbose.mockReturnValue(false);
      logSilentError(new Error('test'), 'context', ErrorCategory.EXPECTED);

      expect(stderrSpy).not.toHaveBeenCalled();
    });

    it('should output when verbose is enabled', () => {
      mockIsVerbose.mockReturnValue(true);
      logSilentError(new Error('test error'), 'test context', ErrorCategory.EXPECTED);

      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('[silent-expected]');
      expect(output).toContain('test context');
      expect(output).toContain('test error');
    });

    it('should include category in output', () => {
      mockIsVerbose.mockReturnValue(true);
      logSilentError(new Error('test'), 'context', ErrorCategory.RETRIABLE);

      const output = stderrSpy.mock.calls[0][0] as string;
      expect(output).toContain('[silent-retriable]');
    });
  });
});

describe('getSilentErrorSummary', () => {
  beforeEach(() => {
    clearSilentErrors();
  });

  it('should return empty summary when no errors', () => {
    const summary = getSilentErrorSummary();

    expect(summary.total).toBe(0);
    expect(summary.byCategory[ErrorCategory.EXPECTED]).toBe(0);
    expect(summary.byCategory[ErrorCategory.RETRIABLE]).toBe(0);
    expect(summary.byCategory[ErrorCategory.TRANSIENT]).toBe(0);
    expect(summary.byCategory[ErrorCategory.UNKNOWN]).toBe(0);
    expect(summary.recentErrors.length).toBe(0);
  });

  it('should count errors by category', () => {
    logSilentError(new Error('1'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('2'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('3'), 'ctx', ErrorCategory.UNKNOWN);

    const summary = getSilentErrorSummary();
    expect(summary.total).toBe(3);
    expect(summary.byCategory[ErrorCategory.EXPECTED]).toBe(2);
    expect(summary.byCategory[ErrorCategory.UNKNOWN]).toBe(1);
  });

  it('should include recent errors (last 10)', () => {
    for (let i = 0; i < 15; i++) {
      logSilentError(new Error(`error ${i}`), `context ${i}`, ErrorCategory.EXPECTED);
    }

    const summary = getSilentErrorSummary();
    expect(summary.recentErrors.length).toBe(10);
    // Should be the last 10 errors (5-14)
    expect(summary.recentErrors[0].message).toBe('error 5');
    expect(summary.recentErrors[9].message).toBe('error 14');
  });
});

describe('getAllSilentErrors', () => {
  beforeEach(() => {
    clearSilentErrors();
  });

  it('should return all errors', () => {
    logSilentError(new Error('1'), 'ctx1', ErrorCategory.EXPECTED);
    logSilentError(new Error('2'), 'ctx2', ErrorCategory.UNKNOWN);

    const errors = getAllSilentErrors();
    expect(errors.length).toBe(2);
  });

  it('should return a copy (not the original array)', () => {
    logSilentError(new Error('1'), 'ctx', ErrorCategory.EXPECTED);

    const errors1 = getAllSilentErrors();
    const errors2 = getAllSilentErrors();

    expect(errors1).not.toBe(errors2);
    expect(errors1).toEqual(errors2);
  });
});

describe('clearSilentErrors', () => {
  beforeEach(() => {
    clearSilentErrors();
  });

  it('should clear all errors', () => {
    logSilentError(new Error('1'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('2'), 'ctx', ErrorCategory.UNKNOWN);

    expect(getSilentErrorCount()).toBe(2);

    clearSilentErrors();

    expect(getSilentErrorCount()).toBe(0);
    expect(getAllSilentErrors()).toEqual([]);
  });
});

describe('getSilentErrorCount', () => {
  beforeEach(() => {
    clearSilentErrors();
  });

  it('should return total count when no category specified', () => {
    logSilentError(new Error('1'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('2'), 'ctx', ErrorCategory.UNKNOWN);

    expect(getSilentErrorCount()).toBe(2);
  });

  it('should return count for specific category', () => {
    logSilentError(new Error('1'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('2'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('3'), 'ctx', ErrorCategory.UNKNOWN);

    expect(getSilentErrorCount(ErrorCategory.EXPECTED)).toBe(2);
    expect(getSilentErrorCount(ErrorCategory.UNKNOWN)).toBe(1);
    expect(getSilentErrorCount(ErrorCategory.RETRIABLE)).toBe(0);
  });
});

describe('hasUnknownErrors', () => {
  beforeEach(() => {
    clearSilentErrors();
  });

  it('should return false when no errors', () => {
    expect(hasUnknownErrors()).toBe(false);
  });

  it('should return false when only expected errors', () => {
    logSilentError(new Error('1'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('2'), 'ctx', ErrorCategory.RETRIABLE);

    expect(hasUnknownErrors()).toBe(false);
  });

  it('should return true when unknown errors exist', () => {
    logSilentError(new Error('1'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('2'), 'ctx', ErrorCategory.UNKNOWN);

    expect(hasUnknownErrors()).toBe(true);
  });
});

describe('formatErrorSummary', () => {
  beforeEach(() => {
    clearSilentErrors();
  });

  it('should format empty summary', () => {
    const summary = getSilentErrorSummary();
    const formatted = formatErrorSummary(summary);

    expect(formatted).toBe('No silent errors logged.');
  });

  it('should include category counts', () => {
    logSilentError(new Error('1'), 'ctx', ErrorCategory.EXPECTED);
    logSilentError(new Error('2'), 'ctx', ErrorCategory.UNKNOWN);

    const summary = getSilentErrorSummary();
    const formatted = formatErrorSummary(summary);

    expect(formatted).toContain('Silent Error Summary (2 total)');
    expect(formatted).toContain('Expected:  1');
    expect(formatted).toContain('Unknown:   1');
  });

  it('should include recent errors', () => {
    logSilentError(new Error('test error'), 'test context', ErrorCategory.EXPECTED);

    const summary = getSilentErrorSummary();
    const formatted = formatErrorSummary(summary);

    expect(formatted).toContain('Recent errors:');
    expect(formatted).toContain('test context');
    expect(formatted).toContain('test error');
  });
});

describe('error registry limits', () => {
  beforeEach(() => {
    clearSilentErrors();
  });

  it('should limit registry size to prevent memory issues', () => {
    // Register more than MAX_REGISTRY_SIZE (1000) errors
    for (let i = 0; i < 1100; i++) {
      logSilentError(new Error(`error ${i}`), `context ${i}`, ErrorCategory.EXPECTED);
    }

    const count = getSilentErrorCount();
    // Should be capped at 1000
    expect(count).toBeLessThanOrEqual(1000);
  });
});
