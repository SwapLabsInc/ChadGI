/**
 * Unit tests for src/utils/debug.ts
 *
 * Tests debug and trace logging utilities for ChadGI.
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

// Mock the secrets module
jest.unstable_mockModule('../../utils/secrets.js', () => ({
  maskSecrets: jest.fn((text: string) => text.replace(/secret123/gi, '[REDACTED]')),
}));

// Import after mocking
const {
  ENV_VERBOSE,
  ENV_TRACE,
  PREFIX_DEBUG,
  PREFIX_TRACE,
  initDebugFromEnv,
  getDebugConfig,
  setVerbosityLevel,
  enableVerbose,
  enableTrace,
  disableDebug,
  resetDebugConfig,
  setTimestamps,
  setMaskSecretsInDebug,
  isVerbose,
  isTrace,
  debugLog,
  traceLog,
  startTiming,
  startTraceTiming,
  debugDecision,
  debugFileOp,
  traceApi,
  traceApiResponse,
} = await import('../../utils/debug.js');

describe('debug module constants', () => {
  it('should export correct environment variable names', () => {
    expect(ENV_VERBOSE).toBe('CHADGI_VERBOSE');
    expect(ENV_TRACE).toBe('CHADGI_TRACE');
  });

  it('should export correct prefix constants', () => {
    expect(PREFIX_DEBUG).toBe('[DEBUG]');
    expect(PREFIX_TRACE).toBe('[TRACE]');
  });
});

describe('getDebugConfig', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should return default config', () => {
    const config = getDebugConfig();
    expect(config.level).toBe('normal');
    expect(config.timestamps).toBe(true);
    expect(config.maskSecrets).toBe(true);
  });

  it('should return a copy of config (immutable)', () => {
    const config = getDebugConfig();
    // TypeScript would prevent direct mutation, but verify it's a copy
    expect(config).toEqual({
      level: 'normal',
      timestamps: true,
      maskSecrets: true,
    });
  });
});

describe('setVerbosityLevel', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should set verbosity to verbose', () => {
    setVerbosityLevel('verbose');
    expect(getDebugConfig().level).toBe('verbose');
  });

  it('should set verbosity to trace', () => {
    setVerbosityLevel('trace');
    expect(getDebugConfig().level).toBe('trace');
  });

  it('should set verbosity to silent', () => {
    setVerbosityLevel('silent');
    expect(getDebugConfig().level).toBe('silent');
  });

  it('should set verbosity to normal', () => {
    setVerbosityLevel('verbose');
    setVerbosityLevel('normal');
    expect(getDebugConfig().level).toBe('normal');
  });
});

describe('enableVerbose', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should enable verbose mode', () => {
    enableVerbose();
    expect(getDebugConfig().level).toBe('verbose');
    expect(isVerbose()).toBe(true);
  });

  it('should not downgrade trace to verbose', () => {
    setVerbosityLevel('trace');
    enableVerbose();
    expect(getDebugConfig().level).toBe('trace');
  });
});

describe('enableTrace', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should enable trace mode', () => {
    enableTrace();
    expect(getDebugConfig().level).toBe('trace');
    expect(isTrace()).toBe(true);
    expect(isVerbose()).toBe(true); // trace includes verbose
  });
});

describe('disableDebug', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should disable all debug output', () => {
    enableTrace();
    disableDebug();
    expect(getDebugConfig().level).toBe('silent');
    expect(isVerbose()).toBe(false);
    expect(isTrace()).toBe(false);
  });
});

describe('isVerbose', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should return false when normal', () => {
    expect(isVerbose()).toBe(false);
  });

  it('should return true when verbose', () => {
    enableVerbose();
    expect(isVerbose()).toBe(true);
  });

  it('should return true when trace', () => {
    enableTrace();
    expect(isVerbose()).toBe(true);
  });

  it('should return false when silent', () => {
    disableDebug();
    expect(isVerbose()).toBe(false);
  });
});

describe('isTrace', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should return false when normal', () => {
    expect(isTrace()).toBe(false);
  });

  it('should return false when verbose', () => {
    enableVerbose();
    expect(isTrace()).toBe(false);
  });

  it('should return true when trace', () => {
    enableTrace();
    expect(isTrace()).toBe(true);
  });

  it('should return false when silent', () => {
    disableDebug();
    expect(isTrace()).toBe(false);
  });
});

describe('setTimestamps', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should enable timestamps', () => {
    setTimestamps(true);
    expect(getDebugConfig().timestamps).toBe(true);
  });

  it('should disable timestamps', () => {
    setTimestamps(false);
    expect(getDebugConfig().timestamps).toBe(false);
  });
});

describe('setMaskSecretsInDebug', () => {
  beforeEach(() => {
    resetDebugConfig();
  });

  it('should enable secret masking', () => {
    setMaskSecretsInDebug(true);
    expect(getDebugConfig().maskSecrets).toBe(true);
  });

  it('should disable secret masking', () => {
    setMaskSecretsInDebug(false);
    expect(getDebugConfig().maskSecrets).toBe(false);
  });
});

describe('initDebugFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetDebugConfig();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should enable verbose from CHADGI_VERBOSE=1', () => {
    process.env.CHADGI_VERBOSE = '1';
    initDebugFromEnv();
    expect(isVerbose()).toBe(true);
    expect(isTrace()).toBe(false);
  });

  it('should enable verbose from CHADGI_VERBOSE=true', () => {
    process.env.CHADGI_VERBOSE = 'true';
    initDebugFromEnv();
    expect(isVerbose()).toBe(true);
  });

  it('should enable trace from CHADGI_TRACE=1', () => {
    process.env.CHADGI_TRACE = '1';
    initDebugFromEnv();
    expect(isTrace()).toBe(true);
    expect(isVerbose()).toBe(true);
  });

  it('should enable trace from CHADGI_TRACE=true', () => {
    process.env.CHADGI_TRACE = 'true';
    initDebugFromEnv();
    expect(isTrace()).toBe(true);
  });

  it('should prioritize trace over verbose', () => {
    process.env.CHADGI_VERBOSE = '1';
    process.env.CHADGI_TRACE = '1';
    initDebugFromEnv();
    expect(isTrace()).toBe(true);
  });

  it('should not enable debug when env vars are not set', () => {
    delete process.env.CHADGI_VERBOSE;
    delete process.env.CHADGI_TRACE;
    initDebugFromEnv();
    expect(isVerbose()).toBe(false);
    expect(isTrace()).toBe(false);
  });

  it('should not enable debug when env vars are set to other values', () => {
    process.env.CHADGI_VERBOSE = '0';
    process.env.CHADGI_TRACE = 'false';
    initDebugFromEnv();
    expect(isVerbose()).toBe(false);
    expect(isTrace()).toBe(false);
  });
});

describe('debugLog', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    resetDebugConfig();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should not output when verbose is disabled', () => {
    debugLog('test message');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should output when verbose is enabled', () => {
    enableVerbose();
    setTimestamps(false);
    debugLog('test message');
    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('[DEBUG]');
    expect(output).toContain('test message');
  });

  it('should output when trace is enabled', () => {
    enableTrace();
    setTimestamps(false);
    debugLog('test message');
    expect(stderrSpy).toHaveBeenCalled();
  });

  it('should include data when provided', () => {
    enableVerbose();
    setTimestamps(false);
    debugLog('test message', { key: 'value' });
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('"key"');
    expect(output).toContain('"value"');
  });

  it('should mask secrets in output', () => {
    enableVerbose();
    setTimestamps(false);
    debugLog('token is secret123');
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('secret123');
  });
});

describe('traceLog', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    resetDebugConfig();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should not output when verbose is enabled but trace is not', () => {
    enableVerbose();
    traceLog('test message');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should output when trace is enabled', () => {
    enableTrace();
    setTimestamps(false);
    traceLog('test message');
    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('[TRACE]');
    expect(output).toContain('test message');
  });

  it('should include data when provided', () => {
    enableTrace();
    setTimestamps(false);
    traceLog('API response', { status: 200 });
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('"status"');
    expect(output).toContain('200');
  });
});

describe('startTiming', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    resetDebugConfig();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should return a function', () => {
    const endTiming = startTiming('operation');
    expect(typeof endTiming).toBe('function');
  });

  it('should not output when verbose is disabled', () => {
    const endTiming = startTiming('operation');
    endTiming();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should output start and end messages when verbose', () => {
    enableVerbose();
    setTimestamps(false);
    const endTiming = startTiming('my operation');
    endTiming();
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    const startOutput = stderrSpy.mock.calls[0][0] as string;
    const endOutput = stderrSpy.mock.calls[1][0] as string;
    expect(startOutput).toContain('my operation started');
    expect(endOutput).toContain('my operation completed');
    expect(endOutput).toMatch(/\d+(\.\d+)?ms/);
  });
});

describe('startTraceTiming', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    resetDebugConfig();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should not output when trace is disabled', () => {
    enableVerbose();
    const endTiming = startTraceTiming('operation');
    endTiming();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should output with result data when provided', () => {
    enableTrace();
    setTimestamps(false);
    const endTiming = startTraceTiming('api call');
    endTiming({ result: 'success' });
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    const endOutput = stderrSpy.mock.calls[1][0] as string;
    expect(endOutput).toContain('result');
    expect(endOutput).toContain('success');
  });
});

describe('debugDecision', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    resetDebugConfig();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should not output when verbose is disabled', () => {
    debugDecision('skip task', 'budget exceeded');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should output decision with reason', () => {
    enableVerbose();
    setTimestamps(false);
    debugDecision('skip task', 'budget exceeded');
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('Decision:');
    expect(output).toContain('skip task');
    expect(output).toContain('budget exceeded');
  });

  it('should include context when provided', () => {
    enableVerbose();
    setTimestamps(false);
    debugDecision('skip task', 'budget exceeded', { cost: 5.00, limit: 2.00 });
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('cost');
    expect(output).toContain('5');
  });
});

describe('debugFileOp', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    resetDebugConfig();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should not output when verbose is disabled', () => {
    debugFileOp('read', '/path/to/file');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should output file operation', () => {
    enableVerbose();
    setTimestamps(false);
    debugFileOp('read', '/path/to/file');
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('File read:');
    expect(output).toContain('/path/to/file');
  });

  it('should include details when provided', () => {
    enableVerbose();
    setTimestamps(false);
    debugFileOp('write', '/path/to/file', { size: 1234 });
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('size');
    expect(output).toContain('1234');
  });
});

describe('traceApi', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    resetDebugConfig();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should not output when trace is disabled', () => {
    enableVerbose();
    traceApi('gh', 'issue view 123');
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should output API call', () => {
    enableTrace();
    setTimestamps(false);
    traceApi('gh', 'issue view 123');
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('API gh:');
    expect(output).toContain('issue view 123');
  });

  it('should include request data when provided', () => {
    enableTrace();
    setTimestamps(false);
    traceApi('POST', '/api/issues', { title: 'New Issue' });
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('title');
    expect(output).toContain('New Issue');
  });
});

describe('traceApiResponse', () => {
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    resetDebugConfig();
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should not output when trace is disabled', () => {
    traceApiResponse('issue view', { number: 123 });
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should output API response', () => {
    enableTrace();
    setTimestamps(false);
    traceApiResponse('issue view', { number: 123 });
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('API response:');
    expect(output).toContain('issue view');
    expect(output).toContain('123');
  });

  it('should include timing when provided', () => {
    enableTrace();
    setTimestamps(false);
    traceApiResponse('issue view', { number: 123 }, 150.5);
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('150.5ms');
  });
});

describe('resetDebugConfig', () => {
  it('should reset all config to defaults', () => {
    enableTrace();
    setTimestamps(false);
    setMaskSecretsInDebug(false);

    resetDebugConfig();

    const config = getDebugConfig();
    expect(config.level).toBe('normal');
    expect(config.timestamps).toBe(true);
    expect(config.maskSecrets).toBe(true);
  });
});
