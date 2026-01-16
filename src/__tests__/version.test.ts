/**
 * Unit tests for src/version.ts
 *
 * Tests the version command logic including version comparison
 * and update cache functionality.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Store original execSync calls for verification
const execSyncCalls: string[] = [];

// Mock the fs module
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => vol.existsSync(path)),
  readFileSync: jest.fn((path: string, encoding?: string) => vol.readFileSync(path, encoding as BufferEncoding)),
  writeFileSync: jest.fn((path: string, content: string) => vol.writeFileSync(path, content)),
  mkdirSync: jest.fn((path: string, options?: { recursive?: boolean }) => vol.mkdirSync(path, options)),
}));

// Mock child_process to prevent actual command execution
jest.unstable_mockModule('child_process', () => ({
  execSync: jest.fn((cmd: string) => {
    execSyncCalls.push(cmd);

    if (cmd.includes('which claude')) return '/usr/local/bin/claude';
    if (cmd.includes('which gh')) return '/usr/local/bin/gh';
    if (cmd.includes('which jq')) return '/usr/local/bin/jq';
    if (cmd.includes('claude --version')) return 'claude-code 1.0.3';
    if (cmd.includes('gh --version')) return 'gh version 2.45.0 (2024-01-15)';
    if (cmd.includes('jq --version')) return 'jq-1.7';
    if (cmd.includes('curl') && cmd.includes('registry.npmjs.org')) {
      return JSON.stringify({ version: '1.0.6' });
    }
    throw new Error(`Command not mocked: ${cmd}`);
  }),
}));

// Mock colors to avoid ANSI escape codes in tests
jest.unstable_mockModule('../utils/colors.js', () => ({
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
    bgRed: '',
    bgGreen: '',
  },
}));

// Import the module after mocking
const { version } = await import('../version.js');

describe('version module', () => {
  beforeEach(() => {
    vol.reset();
    execSyncCalls.length = 0;
    jest.clearAllMocks();

    // Create package.json with a test version
    // The path needs to match what version.ts computes: join(__dirname, '..', 'package.json')
    // When running tests, __dirname points to dist/ so the package.json path is at project root
    const projectRoot = process.cwd();
    vol.fromJSON({
      [`${projectRoot}/package.json`]: JSON.stringify({
        name: 'chadgi',
        version: '1.0.5',
      }),
      // Also need .chadgi directory for cache tests
      [`${projectRoot}/.chadgi`]: null,
    });
  });

  describe('version command', () => {
    it('should output version info as JSON when --json flag is set', async () => {
      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        await version({ json: true });
      } finally {
        console.log = originalLog;
      }

      expect(logs.length).toBe(1);
      const output = JSON.parse(logs[0]);
      expect(output).toHaveProperty('chadgi');
      expect(output).toHaveProperty('dependencies');
      expect(output.dependencies).toHaveProperty('node');
      expect(output.dependencies).toHaveProperty('claude_cli');
      expect(output.dependencies).toHaveProperty('github_cli');
      expect(output.dependencies).toHaveProperty('jq');
    });

    it('should check node version', async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        await version({ json: true });
      } finally {
        console.log = originalLog;
      }

      const output = JSON.parse(logs[0]);
      expect(output.dependencies.node).toBe(process.version);
    });

    it('should include update info when --check flag is set', async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        await version({ json: true, check: true });
      } finally {
        console.log = originalLog;
      }

      const output = JSON.parse(logs[0]);
      expect(output).toHaveProperty('update');
      expect(output.update).toHaveProperty('available');
      expect(output.update).toHaveProperty('latest');
      expect(output.update).toHaveProperty('current');
    });

    it('should detect when update is available', async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        await version({ json: true, check: true });
      } finally {
        console.log = originalLog;
      }

      const output = JSON.parse(logs[0]);
      // Our mock returns version 1.0.6, and our package is 1.0.5
      expect(output.update.available).toBe(true);
      expect(output.update.latest).toBe('1.0.6');
    });
  });

  describe('version comparison', () => {
    // We can test the comparison logic indirectly through the version command
    it('should correctly compare semantic versions', async () => {
      // Create different version scenarios via package.json
      const projectRoot = process.cwd();
      vol.fromJSON({
        [`${projectRoot}/package.json`]: JSON.stringify({
          name: 'chadgi',
          version: '1.0.6', // Same as latest
        }),
        [`${projectRoot}/.chadgi`]: null,
      });

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        await version({ json: true, check: true });
      } finally {
        console.log = originalLog;
      }

      const output = JSON.parse(logs[0]);
      expect(output.update.available).toBe(false);
    });
  });

  describe('update cache', () => {
    it('should use cached result when available and fresh', async () => {
      // Create a fresh cache file
      const cacheData = {
        checked_at: new Date().toISOString(),
        latest_version: '1.0.7',
        current_version: '1.0.5',
      };

      const projectRoot = process.cwd();
      vol.fromJSON({
        [`${projectRoot}/package.json`]: JSON.stringify({
          name: 'chadgi',
          version: '1.0.5',
        }),
        [`${projectRoot}/.chadgi/update-check.json`]: JSON.stringify(cacheData),
      });

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        await version({ json: true, check: true });
      } finally {
        console.log = originalLog;
      }

      const output = JSON.parse(logs[0]);
      // Should use cached version
      expect(output.update.latest).toBe('1.0.7');
      expect(output.update.cached).toBe(true);

      // Should not have made a curl call
      expect(execSyncCalls.some(cmd => cmd.includes('curl'))).toBe(false);
    });

    it('should fetch fresh data when cache is stale (>24 hours)', async () => {
      // Create a stale cache file (25 hours old)
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const cacheData = {
        checked_at: staleDate.toISOString(),
        latest_version: '1.0.4',
        current_version: '1.0.5',
      };

      const projectRoot = process.cwd();
      vol.fromJSON({
        [`${projectRoot}/package.json`]: JSON.stringify({
          name: 'chadgi',
          version: '1.0.5',
        }),
        [`${projectRoot}/.chadgi/update-check.json`]: JSON.stringify(cacheData),
      });

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      try {
        await version({ json: true, check: true });
      } finally {
        console.log = originalLog;
      }

      const output = JSON.parse(logs[0]);
      // Should have fetched fresh version from npm (mocked as 1.0.6)
      expect(output.update.latest).toBe('1.0.6');
      expect(output.update.cached).toBe(false);

      // Should have made a curl call
      expect(execSyncCalls.some(cmd => cmd.includes('curl'))).toBe(true);
    });
  });
});
