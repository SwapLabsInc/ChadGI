/**
 * Unit tests for queue-middleware.ts command handler.
 *
 * Tests the queue command handler using the middleware pattern,
 * covering success cases, error handling, edge cases, and JSON output format.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock fs module before importing anything that uses it
jest.unstable_mockModule('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

// Store execSync mock for manipulation in tests
let mockExecSyncFn: jest.Mock<(...args: unknown[]) => string>;

// Mock child_process module
jest.unstable_mockModule('child_process', () => {
  mockExecSyncFn = jest.fn<(...args: unknown[]) => string>();
  return {
    execSync: mockExecSyncFn,
  };
});

// Import after mocking
const { existsSync, readFileSync } = await import('fs');
const { execSync } = await import('child_process');

// Import the module under test
const { queueMiddleware } = await import('../../queue-middleware.js');

// Import test utilities
import {
  createMockConfigYaml,
  createMockProjectItemsResponse,
  createMockIssueLabelsResponse,
  createMockIssueBodyResponse,
  setupMockFileSystem,
  DEFAULT_GITHUB_CONFIG,
  DEFAULT_BRANCH_CONFIG,
} from '../helpers/command-test-utils.js';

import type { GitHubConfig } from '../../types/index.js';

describe('queue-middleware', () => {
  let mockExit: jest.SpiedFunction<typeof process.exit>;
  let mockConsoleError: jest.SpiedFunction<typeof console.error>;
  let mockConsoleLog: jest.SpiedFunction<typeof console.log>;
  let originalCwd: () => string;
  const testCwd = '/test/project';
  const testChadgiDir = `${testCwd}/.chadgi`;

  const defaultGithub: GitHubConfig = {
    ...DEFAULT_GITHUB_CONFIG,
    repo: 'test-owner/test-repo',
    project_number: '42',
    ready_column: 'Ready',
  };

  beforeEach(() => {
    // Reset virtual filesystem
    vol.reset();

    // Reset exec mock
    mockExecSyncFn.mockReset();

    // Mock process.cwd
    originalCwd = process.cwd;
    process.cwd = jest.fn(() => testCwd) as () => string;

    // Setup process and console mocks
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
    process.cwd = originalCwd;
    vol.reset();
  });

  /**
   * Helper to set up standard test file system with config
   */
  function setupTestConfig(github: GitHubConfig = defaultGithub) {
    vol.fromJSON({
      [`${testChadgiDir}/chadgi-config.yaml`]: createMockConfigYaml(github, DEFAULT_BRANCH_CONFIG),
    });
  }

  /**
   * Helper to set up mock execSync responses for queue listing
   */
  function setupMockGitHubResponses(tasks: Array<{
    number: number;
    title: string;
    status: string;
    labels?: string[];
    body?: string;
  }>) {
    mockExecSyncFn.mockImplementation((...args: unknown[]) => {
      const cmd = String(args[0]);
      // Project item-list command
      if (cmd.includes('project item-list')) {
        return createMockProjectItemsResponse(tasks.map(t => ({
          number: t.number,
          title: t.title,
          url: `https://github.com/test-owner/test-repo/issues/${t.number}`,
          itemId: `item-${t.number}`,
          status: t.status,
          labels: t.labels,
        })));
      }

      // Issue labels command
      if (cmd.includes('issue view') && cmd.includes('--json labels')) {
        const issueMatch = cmd.match(/issue view (\d+)/);
        if (issueMatch) {
          const issueNum = parseInt(issueMatch[1], 10);
          const task = tasks.find(t => t.number === issueNum);
          return createMockIssueLabelsResponse(task?.labels || []);
        }
      }

      // Issue body command
      if (cmd.includes('issue view') && cmd.includes('--json body')) {
        const issueMatch = cmd.match(/issue view (\d+)/);
        if (issueMatch) {
          const issueNum = parseInt(issueMatch[1], 10);
          const task = tasks.find(t => t.number === issueNum);
          return createMockIssueBodyResponse(task?.body || '');
        }
      }

      // Issue state command
      if (cmd.includes('issue view') && cmd.includes('--json state')) {
        return 'OPEN';
      }

      return '';
    });
  }

  describe('success cases', () => {
    it('should return empty queue when no tasks in Ready column', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 1, title: 'Task in progress', status: 'In Progress' },
        { number: 2, title: 'Task in review', status: 'In Review' },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.taskCount).toBe(0);
      expect(output.tasks).toEqual([]);
      expect(output.readyColumn).toBe('Ready');
    });

    it('should return tasks in Ready column', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Add user authentication', status: 'Ready' },
        { number: 102, title: 'Fix login bug', status: 'Ready' },
        { number: 103, title: 'In progress task', status: 'In Progress' },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.taskCount).toBe(2);
      expect(output.tasks).toHaveLength(2);
      expect(output.tasks[0].number).toBe(101);
      expect(output.tasks[0].title).toBe('Add user authentication');
      expect(output.tasks[1].number).toBe(102);
    });

    it('should include task labels', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        {
          number: 101,
          title: 'Add feature',
          status: 'Ready',
          labels: ['feature', 'priority:high'],
        },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].labels).toContain('feature');
      expect(output.tasks[0].labels).toContain('priority:high');
    });

    it('should categorize tasks by label', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        {
          number: 101,
          title: 'Fix the bug',
          status: 'Ready',
          labels: ['bug'],
        },
        {
          number: 102,
          title: 'Add feature',
          status: 'Ready',
          labels: ['feature', 'enhancement'],
        },
        {
          number: 103,
          title: 'Refactor code',
          status: 'Ready',
          labels: ['refactor'],
        },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].category).toBe('bug');
      expect(output.tasks[1].category).toBe('feature');
      expect(output.tasks[2].category).toBe('refactor');
    });

    it('should apply limit option', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Task 1', status: 'Ready' },
        { number: 102, title: 'Task 2', status: 'Ready' },
        { number: 103, title: 'Task 3', status: 'Ready' },
        { number: 104, title: 'Task 4', status: 'Ready' },
        { number: 105, title: 'Task 5', status: 'Ready' },
      ]);

      await queueMiddleware({ json: true, limit: 3 });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks).toHaveLength(3);
      expect(output.taskCount).toBe(3);
    });

    it('should include item ID for each task', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Test task', status: 'Ready' },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].itemId).toBe('item-101');
    });

    it('should include task URL', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Test task', status: 'Ready' },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].url).toBe('https://github.com/test-owner/test-repo/issues/101');
    });
  });

  describe('priority sorting', () => {
    it('should sort tasks by priority when enabled', async () => {
      // Config with priority enabled
      const configContent = `
github:
  repo: test-owner/test-repo
  project_number: 42
  ready_column: Ready
  in_progress_column: In Progress
  review_column: In Review
  done_column: Done
branch:
  base: main
  prefix: feature/
priority:
  enabled: true
  labels:
    critical: ["priority:critical", "p0"]
    high: ["priority:high", "p1"]
    normal: ["priority:normal", "p2"]
    low: ["priority:low", "p3"]
`;
      vol.fromJSON({
        [`${testChadgiDir}/chadgi-config.yaml`]: configContent,
      });

      setupMockGitHubResponses([
        { number: 101, title: 'Low priority', status: 'Ready', labels: ['priority:low'] },
        { number: 102, title: 'Critical', status: 'Ready', labels: ['priority:critical'] },
        { number: 103, title: 'Normal', status: 'Ready', labels: ['priority:normal'] },
        { number: 104, title: 'High priority', status: 'Ready', labels: ['priority:high'] },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);

      // Should be sorted: critical, high, normal, low
      expect(output.tasks[0].number).toBe(102); // critical
      expect(output.tasks[1].number).toBe(104); // high
      expect(output.tasks[2].number).toBe(103); // normal
      expect(output.tasks[3].number).toBe(101); // low
    });

    it('should assign default normal priority when no label', async () => {
      // Config with priority enabled
      const configContent = `
github:
  repo: test-owner/test-repo
  project_number: 42
  ready_column: Ready
  in_progress_column: In Progress
  review_column: In Review
branch:
  base: main
  prefix: feature/
priority:
  enabled: true
`;
      vol.fromJSON({
        [`${testChadgiDir}/chadgi-config.yaml`]: configContent,
      });

      setupMockGitHubResponses([
        { number: 101, title: 'No priority label', status: 'Ready', labels: [] },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].priorityName).toBe('normal');
      expect(output.tasks[0].priority).toBe(2);
    });
  });

  describe('formatted output (non-JSON)', () => {
    it('should display formatted queue without errors', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Add authentication', status: 'Ready' },
        { number: 102, title: 'Fix bug', status: 'Ready' },
      ]);

      await queueMiddleware({ json: false });

      expect(mockConsoleLog).toHaveBeenCalled();
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('ChadGI Task Queue');
      expect(allOutput).toContain('Ready column:');
      expect(allOutput).toContain('2 task');
      expect(allOutput).toContain('#101');
      expect(allOutput).toContain('#102');
    });

    it('should display empty queue message when no tasks', async () => {
      setupTestConfig();
      setupMockGitHubResponses([]);

      await queueMiddleware({ json: false });

      expect(mockConsoleLog).toHaveBeenCalled();
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('No tasks found');
    });

    it('should display command hints', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Task', status: 'Ready' },
      ]);

      await queueMiddleware({ json: false });

      expect(mockConsoleLog).toHaveBeenCalled();
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('chadgi queue skip');
      expect(allOutput).toContain('chadgi queue promote');
      expect(allOutput).toContain('chadgi start');
    });
  });

  describe('error handling', () => {
    it('should exit with error when .chadgi directory does not exist', async () => {
      // Don't set up any files

      try {
        await queueMiddleware({});
        fail('Expected to throw');
      } catch (e: unknown) {
        expect((e as Error).message).toBe('process.exit called');
      }

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with error when repo not configured', async () => {
      // Config with default repo value
      const github: GitHubConfig = {
        ...defaultGithub,
        repo: 'owner/repo', // Default placeholder
      };
      setupTestConfig(github);

      try {
        await queueMiddleware({});
        fail('Expected to throw');
      } catch (e: unknown) {
        expect((e as Error).message).toBe('process.exit called');
      }

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockConsoleError).toHaveBeenCalled();
      const errorOutput = mockConsoleError.mock.calls.map((c) => c[0]).join('\n');
      expect(errorOutput).toContain('Repository not configured');
    });

    it('should handle GitHub API errors gracefully', async () => {
      setupTestConfig();
      mockExecSyncFn.mockImplementation(() => {
        throw new Error('GitHub CLI error: rate limited');
      });

      await queueMiddleware({ json: true });

      // Should return empty array rather than crashing
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks).toEqual([]);
    });

    it('should handle malformed GitHub response', async () => {
      setupTestConfig();
      mockExecSyncFn.mockReturnValue('not valid json {{{');

      await queueMiddleware({ json: true });

      // Should return empty array
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle tasks without labels', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Unlabeled task', status: 'Ready' },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].labels).toEqual([]);
      expect(output.tasks[0].category).toBeUndefined();
    });

    it('should use custom config path when --config option provided', async () => {
      const customPath = '/custom/path/.chadgi';
      vol.fromJSON({
        [`${customPath}/chadgi-config.yaml`]: createMockConfigYaml(defaultGithub, DEFAULT_BRANCH_CONFIG),
      });

      setupMockGitHubResponses([
        { number: 101, title: 'Task', status: 'Ready' },
      ]);

      await queueMiddleware({
        config: `${customPath}/chadgi-config.yaml`,
        json: true,
      });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.taskCount).toBe(1);
    });

    it('should handle limit of 0 (no limit)', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Task 1', status: 'Ready' },
        { number: 102, title: 'Task 2', status: 'Ready' },
      ]);

      await queueMiddleware({ json: true, limit: 0 });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      // Limit of 0 should not limit
      expect(output.tasks).toHaveLength(2);
    });

    it('should handle limit greater than task count', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Task 1', status: 'Ready' },
      ]);

      await queueMiddleware({ json: true, limit: 100 });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks).toHaveLength(1);
    });

    it('should handle mixed content types (ignore non-issues)', async () => {
      setupTestConfig();
      // Return mixed content types
      mockExecSyncFn.mockImplementation((...args: unknown[]) => {
        const cmd = String(args[0]);
        if (cmd.includes('project item-list')) {
          return JSON.stringify({
            items: [
              {
                id: 'item-1',
                status: 'Ready',
                content: {
                  type: 'Issue',
                  number: 101,
                  title: 'Real issue',
                  url: 'https://github.com/test/repo/issues/101',
                },
              },
              {
                id: 'item-2',
                status: 'Ready',
                content: {
                  type: 'DraftIssue',
                  title: 'Draft issue',
                },
              },
              {
                id: 'item-3',
                status: 'Ready',
                content: {
                  type: 'PullRequest',
                  number: 50,
                  title: 'Some PR',
                },
              },
            ],
          });
        }
        return '';
      });

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      // Only the Issue should be included
      expect(output.tasks).toHaveLength(1);
      expect(output.tasks[0].number).toBe(101);
    });
  });

  describe('JSON output format', () => {
    it('should return properly structured JSON for queue', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        {
          number: 101,
          title: 'Add feature',
          status: 'Ready',
          labels: ['feature', 'priority:high'],
        },
      ]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);

      // Verify top-level structure
      expect(output).toHaveProperty('readyColumn');
      expect(output).toHaveProperty('taskCount');
      expect(output).toHaveProperty('tasks');

      // Verify task structure
      expect(output.tasks[0]).toHaveProperty('number');
      expect(output.tasks[0]).toHaveProperty('title');
      expect(output.tasks[0]).toHaveProperty('url');
      expect(output.tasks[0]).toHaveProperty('itemId');
      expect(output.tasks[0]).toHaveProperty('labels');
    });

    it('should return empty tasks array for empty queue', async () => {
      setupTestConfig();
      setupMockGitHubResponses([]);

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);

      expect(output.readyColumn).toBe('Ready');
      expect(output.taskCount).toBe(0);
      expect(output.tasks).toEqual([]);
    });
  });

  describe('category mappings', () => {
    it('should use default category mappings when not configured', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Fix something', status: 'Ready', labels: ['bug'] },
        { number: 102, title: 'Clean code', status: 'Ready', labels: ['refactor'] },
        { number: 103, title: 'Add docs', status: 'Ready', labels: ['docs'] },
        { number: 104, title: 'Add tests', status: 'Ready', labels: ['test'] },
        { number: 105, title: 'CI fix', status: 'Ready', labels: ['chore'] },
      ]);

      await queueMiddleware({ json: true });

      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].category).toBe('bug');
      expect(output.tasks[1].category).toBe('refactor');
      expect(output.tasks[2].category).toBe('docs');
      expect(output.tasks[3].category).toBe('test');
      expect(output.tasks[4].category).toBe('chore');
    });

    it('should use custom category mappings from config', async () => {
      const configContent = `
github:
  repo: test-owner/test-repo
  project_number: 42
  ready_column: Ready
  in_progress_column: In Progress
  review_column: In Review
branch:
  base: main
  prefix: feature/
category:
  enabled: true
  mappings:
    security: ["security", "vulnerability"]
    performance: ["perf", "performance"]
`;
      vol.fromJSON({
        [`${testChadgiDir}/chadgi-config.yaml`]: configContent,
      });

      setupMockGitHubResponses([
        { number: 101, title: 'Security fix', status: 'Ready', labels: ['security'] },
        { number: 102, title: 'Perf improvement', status: 'Ready', labels: ['perf'] },
      ]);

      await queueMiddleware({ json: true });

      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].category).toBe('security');
      expect(output.tasks[1].category).toBe('performance');
    });
  });

  describe('formatted output details', () => {
    it('should display priority column when priority enabled', async () => {
      const configContent = `
github:
  repo: test-owner/test-repo
  project_number: 42
  ready_column: Ready
  in_progress_column: In Progress
  review_column: In Review
branch:
  base: main
  prefix: feature/
priority:
  enabled: true
`;
      vol.fromJSON({
        [`${testChadgiDir}/chadgi-config.yaml`]: configContent,
      });

      setupMockGitHubResponses([
        { number: 101, title: 'High priority task', status: 'Ready', labels: ['priority:high'] },
        { number: 102, title: 'Low priority task', status: 'Ready', labels: ['priority:low'] },
      ]);

      await queueMiddleware({ json: false });

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('high');
      expect(allOutput).toContain('low');
    });

    it('should display category column when tasks have categories', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        { number: 101, title: 'Bug fix', status: 'Ready', labels: ['bug'] },
      ]);

      await queueMiddleware({ json: false });

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('bug');
    });

    it('should truncate long task titles', async () => {
      setupTestConfig();
      setupMockGitHubResponses([
        {
          number: 101,
          title: 'This is a very long task title that should be truncated when displayed in the queue table output',
          status: 'Ready',
        },
      ]);

      await queueMiddleware({ json: false });

      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('...');
    });
  });

  describe('dependencies', () => {
    it('should parse dependencies from issue body when enabled', async () => {
      const configContent = `
github:
  repo: test-owner/test-repo
  project_number: 42
  ready_column: Ready
  in_progress_column: In Progress
  review_column: In Review
  done_column: Done
branch:
  base: main
  prefix: feature/
dependencies:
  enabled: true
  dependency_patterns: ["depends on", "blocked by"]
`;
      vol.fromJSON({
        [`${testChadgiDir}/chadgi-config.yaml`]: configContent,
      });

      mockExecSyncFn.mockImplementation((...args: unknown[]) => {
        const cmd = String(args[0]);
        if (cmd.includes('project item-list')) {
          return JSON.stringify({
            items: [
              {
                id: 'item-101',
                status: 'Ready',
                content: {
                  type: 'Issue',
                  number: 101,
                  title: 'Blocked task',
                  url: 'https://github.com/test/repo/issues/101',
                },
              },
            ],
          });
        }
        if (cmd.includes('--json labels')) {
          return '';
        }
        if (cmd.includes('--json body')) {
          return 'This task depends on #99 and #100';
        }
        if (cmd.includes('--json state')) {
          return 'OPEN';
        }
        return '';
      });

      await queueMiddleware({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.tasks[0].dependencies).toContain(99);
      expect(output.tasks[0].dependencies).toContain(100);
    });
  });
});
