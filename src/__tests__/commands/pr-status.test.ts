/**
 * Unit tests for pr-status command.
 *
 * Tests the pr-status command handler including PR status fetching,
 * filtering, JSON output, and error handling.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock fs module before importing anything that uses it
jest.unstable_mockModule('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

// Mock gh-client module
const mockPrList = jest.fn<() => Promise<unknown>>();
const mockPrGetDetailedStatus = jest.fn<() => Promise<unknown>>();
const mockProjectGetItems = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('../../utils/gh-client.js', () => ({
  gh: {
    pr: {
      list: mockPrList,
      getDetailedStatus: mockPrGetDetailedStatus,
    },
    project: {
      getItems: mockProjectGetItems,
    },
  },
  GhClientError: class GhClientError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = 'GhClientError';
    }
  },
}));

// Import after mocking
const { prStatus } = await import('../../pr-status.js');

// Import test utilities
import {
  createMockConfigYaml,
  DEFAULT_GITHUB_CONFIG,
  DEFAULT_BRANCH_CONFIG,
} from '../helpers/command-test-utils.js';

import type { GitHubConfig } from '../../types/index.js';

describe('pr-status', () => {
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
    review_column: 'In Review',
  };

  beforeEach(() => {
    // Reset virtual filesystem
    vol.reset();

    // Reset mocks
    mockPrList.mockReset();
    mockPrGetDetailedStatus.mockReset();
    mockProjectGetItems.mockReset();

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
   * Create a mock detailed PR status
   */
  function createMockDetailedStatus(overrides: {
    number: number;
    title: string;
    state?: 'OPEN' | 'CLOSED' | 'MERGED';
    statusCheckRollup?: Array<{
      __typename: string;
      name?: string;
      conclusion?: string | null;
      state?: string;
      status?: string;
    }>;
    reviewDecision?: string | null;
    mergeable?: string;
    mergeStateStatus?: string;
    createdAt?: string;
  }) {
    return {
      number: overrides.number,
      title: overrides.title,
      url: `https://github.com/test-owner/test-repo/pull/${overrides.number}`,
      state: overrides.state ?? 'OPEN',
      branch: `feature/issue-${overrides.number}`,
      mergeable: overrides.mergeable ?? 'MERGEABLE',
      mergeStateStatus: overrides.mergeStateStatus ?? 'CLEAN',
      createdAt: overrides.createdAt ?? new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      mergedAt: overrides.state === 'MERGED' ? new Date().toISOString() : undefined,
      closedAt: overrides.state === 'CLOSED' ? new Date().toISOString() : undefined,
      statusCheckRollup: overrides.statusCheckRollup ?? [],
      reviewDecision: overrides.reviewDecision ?? null,
    };
  }

  describe('success cases', () => {
    it('should return empty result when no open PRs found', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([]);

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs).toEqual([]);
      expect(output.summary.total).toBe(0);
    });

    it('should return PRs with passing CI status', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 143, title: 'Add user authentication' },
      ]);
      mockPrGetDetailedStatus.mockResolvedValue(
        createMockDetailedStatus({
          number: 143,
          title: 'Add user authentication',
          statusCheckRollup: [
            { __typename: 'CheckRun', name: 'build', conclusion: 'SUCCESS' },
            { __typename: 'CheckRun', name: 'test', conclusion: 'SUCCESS' },
          ],
          reviewDecision: 'APPROVED',
        })
      );

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs).toHaveLength(1);
      expect(output.prs[0].prNumber).toBe(143);
      expect(output.prs[0].ciStatus).toBe('passing');
      expect(output.prs[0].reviewStatus).toBe('approved');
      expect(output.summary.passing).toBe(1);
    });

    it('should return PRs with failing CI status', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 141, title: 'Fix database connection' },
      ]);
      mockPrGetDetailedStatus.mockResolvedValue(
        createMockDetailedStatus({
          number: 141,
          title: 'Fix database connection',
          statusCheckRollup: [
            { __typename: 'CheckRun', name: 'build', conclusion: 'SUCCESS' },
            { __typename: 'CheckRun', name: 'test', conclusion: 'FAILURE' },
          ],
          reviewDecision: null,
        })
      );

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs[0].ciStatus).toBe('failing');
      expect(output.prs[0].reviewStatus).toBe('pending');
      expect(output.summary.failing).toBe(1);
    });

    it('should return PRs with pending CI status', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 139, title: 'Refactor API handlers' },
      ]);
      mockPrGetDetailedStatus.mockResolvedValue(
        createMockDetailedStatus({
          number: 139,
          title: 'Refactor API handlers',
          statusCheckRollup: [
            { __typename: 'CheckRun', name: 'build', conclusion: null, status: 'IN_PROGRESS' },
          ],
          reviewDecision: 'CHANGES_REQUESTED',
        })
      );

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs[0].ciStatus).toBe('pending');
      expect(output.prs[0].reviewStatus).toBe('changes_requested');
      expect(output.summary.pending).toBe(1);
    });

    it('should detect merge conflicts', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 145, title: 'Feature with conflicts' },
      ]);
      mockPrGetDetailedStatus.mockResolvedValue(
        createMockDetailedStatus({
          number: 145,
          title: 'Feature with conflicts',
          mergeable: 'CONFLICTING',
          mergeStateStatus: 'DIRTY',
        })
      );

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs[0].conflictStatus).toBe('merge');
      expect(output.summary.withConflicts).toBe(1);
    });

    it('should calculate age correctly', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 140, title: 'Old PR' },
      ]);

      // PR created 3 days ago
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      mockPrGetDetailedStatus.mockResolvedValue(
        createMockDetailedStatus({
          number: 140,
          title: 'Old PR',
          createdAt: threeDaysAgo,
        })
      );

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs[0].age).toBe('3d');
    });
  });

  describe('filtering options', () => {
    beforeEach(() => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 143, title: 'Passing PR' },
        { number: 141, title: 'Failing PR' },
        { number: 139, title: 'Pending PR' },
      ]);
    });

    it('should filter by failing CI with --failing option', async () => {
      mockPrGetDetailedStatus
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 143,
          title: 'Passing PR',
          statusCheckRollup: [{ __typename: 'CheckRun', conclusion: 'SUCCESS' }],
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 141,
          title: 'Failing PR',
          statusCheckRollup: [{ __typename: 'CheckRun', conclusion: 'FAILURE' }],
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 139,
          title: 'Pending PR',
          statusCheckRollup: [{ __typename: 'CheckRun', conclusion: null }],
        }));

      await prStatus({ json: true, failing: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs).toHaveLength(1);
      expect(output.prs[0].prNumber).toBe(141);
    });

    it('should filter by pending review with --needs-review option', async () => {
      mockPrGetDetailedStatus
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 143,
          title: 'Approved PR',
          reviewDecision: 'APPROVED',
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 141,
          title: 'Pending review PR',
          reviewDecision: null,
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 139,
          title: 'Changes requested PR',
          reviewDecision: 'CHANGES_REQUESTED',
        }));

      await prStatus({ json: true, needsReview: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs).toHaveLength(1);
      expect(output.prs[0].prNumber).toBe(141);
    });

    it('should filter by merge conflicts with --has-conflicts option', async () => {
      mockPrGetDetailedStatus
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 143,
          title: 'Clean PR',
          mergeable: 'MERGEABLE',
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 141,
          title: 'Conflicting PR',
          mergeable: 'CONFLICTING',
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 139,
          title: 'Another clean PR',
          mergeable: 'MERGEABLE',
        }));

      await prStatus({ json: true, hasConflicts: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs).toHaveLength(1);
      expect(output.prs[0].prNumber).toBe(141);
    });
  });

  describe('JSON output format', () => {
    it('should return properly structured JSON output', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 143, title: 'Test PR' },
      ]);
      mockPrGetDetailedStatus.mockResolvedValue(
        createMockDetailedStatus({
          number: 143,
          title: 'Test PR',
          statusCheckRollup: [{ __typename: 'CheckRun', conclusion: 'SUCCESS' }],
          reviewDecision: 'APPROVED',
        })
      );

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);

      // Verify top-level structure
      expect(output).toHaveProperty('repo');
      expect(output).toHaveProperty('prs');
      expect(output).toHaveProperty('summary');
      expect(output).toHaveProperty('timestamp');

      // Verify PR entry structure
      expect(output.prs[0]).toHaveProperty('prNumber');
      expect(output.prs[0]).toHaveProperty('title');
      expect(output.prs[0]).toHaveProperty('url');
      expect(output.prs[0]).toHaveProperty('ciStatus');
      expect(output.prs[0]).toHaveProperty('reviewStatus');
      expect(output.prs[0]).toHaveProperty('conflictStatus');
      expect(output.prs[0]).toHaveProperty('age');
      expect(output.prs[0]).toHaveProperty('ageSeconds');
      expect(output.prs[0]).toHaveProperty('branch');

      // Verify summary structure
      expect(output.summary).toHaveProperty('total');
      expect(output.summary).toHaveProperty('passing');
      expect(output.summary).toHaveProperty('failing');
      expect(output.summary).toHaveProperty('pending');
      expect(output.summary).toHaveProperty('needsAttention');
      expect(output.summary).toHaveProperty('withConflicts');
      expect(output.summary).toHaveProperty('pendingReview');
      expect(output.summary).toHaveProperty('approved');
    });
  });

  describe('formatted output (non-JSON)', () => {
    it('should display formatted PR status table without errors', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 143, title: 'Add authentication' },
        { number: 141, title: 'Fix bug' },
      ]);
      mockPrGetDetailedStatus
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 143,
          title: 'Add authentication',
          statusCheckRollup: [{ __typename: 'CheckRun', conclusion: 'SUCCESS' }],
          reviewDecision: 'APPROVED',
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 141,
          title: 'Fix bug',
          statusCheckRollup: [{ __typename: 'CheckRun', conclusion: 'FAILURE' }],
        }));

      await prStatus({ json: false });

      expect(mockConsoleLog).toHaveBeenCalled();
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('ChadGI PR Status');
      expect(allOutput).toContain('test-owner/test-repo');
      expect(allOutput).toContain('#143');
      expect(allOutput).toContain('#141');
    });

    it('should display empty message when no PRs found', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([]);

      await prStatus({ json: false });

      expect(mockConsoleLog).toHaveBeenCalled();
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('No open PRs found');
    });

    it('should display summary statistics', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 143, title: 'Passing PR' },
        { number: 141, title: 'Failing PR' },
      ]);
      mockPrGetDetailedStatus
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 143,
          title: 'Passing PR',
          statusCheckRollup: [{ __typename: 'CheckRun', conclusion: 'SUCCESS' }],
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 141,
          title: 'Failing PR',
          statusCheckRollup: [{ __typename: 'CheckRun', conclusion: 'FAILURE' }],
        }));

      await prStatus({ json: false });

      expect(mockConsoleLog).toHaveBeenCalled();
      const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).toContain('Summary');
      expect(allOutput).toContain('2 PRs open');
    });
  });

  describe('error handling', () => {
    it('should exit with error when repo not configured', async () => {
      // Config with default repo value
      const github: GitHubConfig = {
        ...defaultGithub,
        repo: 'owner/repo', // Default placeholder
      };
      setupTestConfig(github);

      try {
        await prStatus({});
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
      mockProjectGetItems.mockRejectedValue(new Error('API error'));
      mockPrList.mockRejectedValue(new Error('GitHub CLI error'));

      try {
        await prStatus({ json: true });
        fail('Expected to throw');
      } catch (e: unknown) {
        expect((e as Error).message).toBe('process.exit called');
      }

      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle PRs without status checks', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 147, title: 'No checks PR' },
      ]);
      mockPrGetDetailedStatus.mockResolvedValue(
        createMockDetailedStatus({
          number: 147,
          title: 'No checks PR',
          statusCheckRollup: [],
        })
      );

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs[0].ciStatus).toBe('unknown');
    });

    it('should exclude closed PRs from results', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 143, title: 'Open PR' },
        { number: 141, title: 'Closed PR' },
      ]);
      mockPrGetDetailedStatus
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 143,
          title: 'Open PR',
          state: 'OPEN',
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 141,
          title: 'Closed PR',
          state: 'CLOSED',
        }));

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs).toHaveLength(1);
      expect(output.prs[0].prNumber).toBe(143);
    });

    it('should extract issue number from PR title with bracket format', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 143, title: '[#42] Add new feature' },
      ]);
      mockPrGetDetailedStatus.mockResolvedValue(
        createMockDetailedStatus({
          number: 143,
          title: '[#42] Add new feature',
        })
      );

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.prs[0].issueNumber).toBe(42);
    });

    it('should sort PRs by age (oldest first)', async () => {
      setupTestConfig();
      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([
        { number: 143, title: 'New PR' },
        { number: 141, title: 'Old PR' },
      ]);

      const newPRDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago
      const oldPRDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago

      mockPrGetDetailedStatus
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 143,
          title: 'New PR',
          createdAt: newPRDate,
        }))
        .mockResolvedValueOnce(createMockDetailedStatus({
          number: 141,
          title: 'Old PR',
          createdAt: oldPRDate,
        }));

      await prStatus({ json: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      // Oldest first
      expect(output.prs[0].prNumber).toBe(141);
      expect(output.prs[1].prNumber).toBe(143);
    });

    it('should handle repo filter option', async () => {
      // Config without specific repo to test override
      vol.fromJSON({
        [`${testChadgiDir}/chadgi-config.yaml`]: createMockConfigYaml(
          { ...defaultGithub, repo: 'owner/repo' },
          DEFAULT_BRANCH_CONFIG
        ),
      });

      mockProjectGetItems.mockResolvedValue([]);
      mockPrList.mockResolvedValue([]);

      // This should exit with error since repo: 'owner/repo' is the default placeholder
      try {
        await prStatus({ json: true, repo: undefined });
      } catch {
        // Expected
      }

      // But when we provide a valid repo override, it should work
      vol.reset();
      setupTestConfig();
      mockPrList.mockResolvedValue([]);
      mockProjectGetItems.mockResolvedValue([]);

      await prStatus({ json: true, repo: 'other-owner/other-repo' });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = JSON.parse(mockConsoleLog.mock.calls[0][0] as string);
      expect(output.repo).toBe('other-owner/other-repo');
    });
  });
});
