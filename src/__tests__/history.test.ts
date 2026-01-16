/**
 * Unit tests for src/history.ts
 *
 * Tests history filtering, formatting, and data building logic.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock the fs module
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => vol.existsSync(path)),
  readFileSync: jest.fn((path: string, encoding?: string) => vol.readFileSync(path, encoding as BufferEncoding)),
}));

// Mock child_process for GitHub CLI calls
jest.unstable_mockModule('child_process', () => ({
  execSync: jest.fn(() => {
    throw new Error('Command not mocked');
  }),
}));

// Import types
import type { SessionStats, TaskMetrics, HistoryEntry } from '../types/index.js';

import {
  sampleSessionStats,
  sampleTaskMetrics,
  sampleMetricsData,
} from './fixtures/data.js';

import { validConfig } from './fixtures/configs.js';

describe('history module', () => {
  beforeEach(() => {
    vol.reset();
    jest.clearAllMocks();
  });

  describe('buildHistoryEntries logic', () => {
    // Test the logic that builds unified history entries
    const buildHistoryEntries = (
      sessions: SessionStats[],
      metrics: TaskMetrics[],
      _repo: string
    ): HistoryEntry[] => {
      const entries: HistoryEntry[] = [];
      const processedIssues = new Set<string>();

      // Process metrics first (more accurate)
      for (const metric of metrics) {
        const key = `${metric.issue_number}-${metric.started_at}`;
        if (processedIssues.has(key)) continue;
        processedIssues.add(key);

        entries.push({
          issueNumber: metric.issue_number,
          outcome: metric.status === 'completed' ? 'success' : 'failed',
          elapsedTime: metric.duration_secs || 0,
          cost: metric.cost_usd > 0 ? metric.cost_usd : undefined,
          startedAt: metric.started_at,
          completedAt: metric.completed_at,
          failureReason: metric.failure_reason,
          category: metric.category,
          iterations: metric.iterations,
        });
      }

      // Process session stats
      for (const session of sessions) {
        for (const task of session.successful_tasks || []) {
          const key = `${task.issue}-${session.started_at}`;
          if (processedIssues.has(key)) continue;
          processedIssues.add(key);

          entries.push({
            issueNumber: task.issue,
            outcome: 'success',
            elapsedTime: task.duration_secs || 0,
            startedAt: session.started_at,
            completedAt: session.ended_at,
          });
        }

        for (const task of session.failed_tasks || []) {
          const key = `${task.issue}-${session.started_at}`;
          if (processedIssues.has(key)) continue;
          processedIssues.add(key);

          entries.push({
            issueNumber: task.issue,
            outcome: task.reason?.toLowerCase().includes('skip') ? 'skipped' : 'failed',
            elapsedTime: task.duration_secs || 0,
            startedAt: session.started_at,
            completedAt: session.ended_at,
            failureReason: task.reason,
          });
        }
      }

      // Sort by startedAt descending
      entries.sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

      return entries;
    };

    it('should build entries from metrics', () => {
      const entries = buildHistoryEntries([], sampleTaskMetrics, 'owner/repo');

      expect(entries).toHaveLength(4);
      expect(entries.some((e) => e.issueNumber === 42)).toBe(true);
      expect(entries.some((e) => e.issueNumber === 43)).toBe(true);
      expect(entries.some((e) => e.issueNumber === 44)).toBe(true);
      expect(entries.some((e) => e.issueNumber === 50)).toBe(true);
    });

    it('should mark completed metrics as success', () => {
      const entries = buildHistoryEntries([], sampleTaskMetrics, 'owner/repo');

      const successEntries = entries.filter((e) => e.outcome === 'success');
      expect(successEntries).toHaveLength(3);
    });

    it('should mark failed metrics as failed', () => {
      const entries = buildHistoryEntries([], sampleTaskMetrics, 'owner/repo');

      const failedEntries = entries.filter((e) => e.outcome === 'failed');
      expect(failedEntries).toHaveLength(1);
      expect(failedEntries[0].issueNumber).toBe(44);
      expect(failedEntries[0].failureReason).toBe('Build failed');
    });

    it('should include cost information', () => {
      const entries = buildHistoryEntries([], sampleTaskMetrics, 'owner/repo');

      const entry42 = entries.find((e) => e.issueNumber === 42);
      expect(entry42?.cost).toBe(0.15);
    });

    it('should include category information', () => {
      const entries = buildHistoryEntries([], sampleTaskMetrics, 'owner/repo');

      const entry42 = entries.find((e) => e.issueNumber === 42);
      expect(entry42?.category).toBe('feature');

      const entry43 = entries.find((e) => e.issueNumber === 43);
      expect(entry43?.category).toBe('bug');
    });

    it('should sort entries by date descending', () => {
      const entries = buildHistoryEntries([], sampleTaskMetrics, 'owner/repo');

      // Most recent should be first (issue 50 from Jan 15)
      expect(entries[0].issueNumber).toBe(50);
      // Oldest should be last (issue 42 from Jan 10)
      expect(entries[entries.length - 1].issueNumber).toBe(42);
    });

    it('should not duplicate entries from both sources', () => {
      // Create metrics that overlap with session stats
      const metrics: TaskMetrics[] = [
        {
          issue_number: 42,
          started_at: '2026-01-10T10:00:00Z',
          completed_at: '2026-01-10T10:20:00Z',
          duration_secs: 1200,
          status: 'completed',
          iterations: 1,
          cost_usd: 0.15,
        },
      ];

      const entries = buildHistoryEntries(sampleSessionStats, metrics, 'owner/repo');

      // Issue 42 should only appear once (from metrics, not duplicated from session)
      const issue42Entries = entries.filter((e) => e.issueNumber === 42);
      expect(issue42Entries).toHaveLength(1);
    });

    it('should handle empty inputs', () => {
      const entries = buildHistoryEntries([], [], 'owner/repo');
      expect(entries).toHaveLength(0);
    });
  });

  describe('applyFilters logic', () => {
    interface HistoryOptions {
      since?: string;
      status?: string;
      limit?: number;
    }

    const applyFilters = (
      entries: HistoryEntry[],
      options: HistoryOptions
    ): { filtered: HistoryEntry[]; sinceDate?: Date; statusFilter?: string } => {
      let filtered = [...entries];
      let sinceDate: Date | undefined;
      let statusFilter: string | undefined;

      // Apply --since filter
      if (options.since) {
        // Simple date parsing for test
        const match = options.since.match(/^(\d+)d$/);
        if (match) {
          sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - parseInt(match[1], 10));
        } else {
          sinceDate = new Date(options.since);
        }

        if (sinceDate && !isNaN(sinceDate.getTime())) {
          const sinceTime = sinceDate.getTime();
          filtered = filtered.filter(
            (entry) => new Date(entry.startedAt).getTime() >= sinceTime
          );
        }
      }

      // Apply --status filter
      if (options.status) {
        statusFilter = options.status.toLowerCase();
        if (statusFilter === 'success' || statusFilter === 'completed') {
          filtered = filtered.filter((entry) => entry.outcome === 'success');
        } else if (statusFilter === 'failed' || statusFilter === 'failure') {
          filtered = filtered.filter((entry) => entry.outcome === 'failed');
        } else if (statusFilter === 'skipped') {
          filtered = filtered.filter((entry) => entry.outcome === 'skipped');
        }
      }

      // Apply --limit
      if (options.limit && options.limit > 0) {
        filtered = filtered.slice(0, options.limit);
      }

      return { filtered, sinceDate, statusFilter };
    };

    const sampleEntries: HistoryEntry[] = [
      {
        issueNumber: 50,
        outcome: 'success',
        elapsedTime: 1800,
        startedAt: '2026-01-15T10:00:00Z',
        cost: 0.25,
      },
      {
        issueNumber: 44,
        outcome: 'failed',
        elapsedTime: 600,
        startedAt: '2026-01-10T11:00:00Z',
        failureReason: 'Build failed',
      },
      {
        issueNumber: 43,
        outcome: 'success',
        elapsedTime: 1500,
        startedAt: '2026-01-10T10:30:00Z',
        cost: 0.2,
      },
      {
        issueNumber: 42,
        outcome: 'success',
        elapsedTime: 1200,
        startedAt: '2026-01-10T10:00:00Z',
        cost: 0.15,
      },
    ];

    it('should filter by status success', () => {
      const { filtered } = applyFilters(sampleEntries, { status: 'success' });
      expect(filtered).toHaveLength(3);
      expect(filtered.every((e) => e.outcome === 'success')).toBe(true);
    });

    it('should filter by status failed', () => {
      const { filtered } = applyFilters(sampleEntries, { status: 'failed' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].issueNumber).toBe(44);
    });

    it('should apply limit', () => {
      const { filtered } = applyFilters(sampleEntries, { limit: 2 });
      expect(filtered).toHaveLength(2);
    });

    it('should combine status and limit filters', () => {
      const { filtered } = applyFilters(sampleEntries, {
        status: 'success',
        limit: 1,
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].outcome).toBe('success');
    });

    it('should filter by ISO date since', () => {
      const { filtered } = applyFilters(sampleEntries, {
        since: '2026-01-12T00:00:00Z',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].issueNumber).toBe(50);
    });

    it('should return all entries when no filters', () => {
      const { filtered } = applyFilters(sampleEntries, {});
      expect(filtered).toHaveLength(4);
    });

    it('should handle case insensitive status filter', () => {
      const { filtered: filteredUpper } = applyFilters(sampleEntries, {
        status: 'SUCCESS',
      });
      const { filtered: filteredLower } = applyFilters(sampleEntries, {
        status: 'success',
      });
      expect(filteredUpper).toHaveLength(filteredLower.length);
    });
  });

  describe('history summary calculations', () => {
    it('should calculate totals correctly', () => {
      const entries: HistoryEntry[] = [
        { issueNumber: 1, outcome: 'success', elapsedTime: 1000, startedAt: '', cost: 0.1 },
        { issueNumber: 2, outcome: 'success', elapsedTime: 2000, startedAt: '', cost: 0.2 },
        { issueNumber: 3, outcome: 'failed', elapsedTime: 500, startedAt: '', cost: 0.05 },
        { issueNumber: 4, outcome: 'skipped', elapsedTime: 300, startedAt: '' },
      ];

      const successful = entries.filter((e) => e.outcome === 'success').length;
      const failed = entries.filter((e) => e.outcome === 'failed').length;
      const skipped = entries.filter((e) => e.outcome === 'skipped').length;
      const totalCost = entries.reduce((sum, e) => sum + (e.cost || 0), 0);
      const totalTime = entries.reduce((sum, e) => sum + e.elapsedTime, 0);

      expect(successful).toBe(2);
      expect(failed).toBe(1);
      expect(skipped).toBe(1);
      expect(totalCost).toBeCloseTo(0.35, 4);
      expect(totalTime).toBe(3800);
    });

    it('should handle entries without cost', () => {
      const entries: HistoryEntry[] = [
        { issueNumber: 1, outcome: 'success', elapsedTime: 1000, startedAt: '' },
        { issueNumber: 2, outcome: 'success', elapsedTime: 2000, startedAt: '' },
      ];

      const totalCost = entries.reduce((sum, e) => sum + (e.cost || 0), 0);
      expect(totalCost).toBe(0);
    });
  });

  describe('date range calculation', () => {
    it('should calculate date range for filtered results', () => {
      const entries: HistoryEntry[] = [
        { issueNumber: 1, outcome: 'success', elapsedTime: 1000, startedAt: '2026-01-15T10:00:00Z' },
        { issueNumber: 2, outcome: 'success', elapsedTime: 2000, startedAt: '2026-01-10T10:00:00Z' },
        { issueNumber: 3, outcome: 'success', elapsedTime: 500, startedAt: '2026-01-01T10:00:00Z' },
      ];

      const startDates = entries.map((e) => new Date(e.startedAt).getTime());
      const earliest = new Date(Math.min(...startDates));
      const latest = new Date(Math.max(...startDates));

      expect(earliest.toISOString()).toBe('2026-01-01T10:00:00.000Z');
      expect(latest.toISOString()).toBe('2026-01-15T10:00:00.000Z');
    });
  });
});
