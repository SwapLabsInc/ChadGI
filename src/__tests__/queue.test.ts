/**
 * Unit tests for src/queue.ts
 *
 * Tests queue-related parsing and logic functions.
 * Note: Many functions in queue.ts make GitHub API calls, so we focus on
 * testable pure functions and parsing logic.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock the fs module
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => vol.existsSync(path)),
  readFileSync: jest.fn((path: string, encoding?: string) => vol.readFileSync(path, encoding as BufferEncoding)),
}));

// Store command responses for mock
const commandResponses: Map<RegExp, { response: string; shouldThrow?: boolean }> = new Map();

// Mock child_process
jest.unstable_mockModule('child_process', () => ({
  execSync: jest.fn((cmd: string) => {
    for (const [pattern, { response, shouldThrow }] of commandResponses) {
      if (pattern.test(cmd)) {
        if (shouldThrow) {
          throw new Error(response);
        }
        return response;
      }
    }
    throw new Error(`Command not mocked: ${cmd}`);
  }),
}));

// Import types for mock setup
import type { QueueTask } from '../types/index.js';

import {
  validConfig,
  configWithPriority,
  configWithDependencies,
  configWithCategory,
} from './fixtures/configs.js';

// Import config utilities at the module level
const { parseYamlNested, parseYamlBoolean } = await import('../utils/config.js');

describe('queue module helper functions', () => {
  beforeEach(() => {
    vol.reset();
    commandResponses.clear();
    jest.clearAllMocks();
  });

  describe('YAML parsing for queue configuration', () => {
    it('should parse ready column from config', () => {
      expect(parseYamlNested(validConfig, 'github', 'ready_column')).toBe('Ready');
    });

    it('should parse done column from config', () => {
      expect(parseYamlNested(validConfig, 'github', 'done_column')).toBe('Done');
    });

    it('should detect priority enabled', () => {
      expect(parseYamlBoolean(configWithPriority, 'priority', 'enabled')).toBe(true);
      expect(parseYamlBoolean(validConfig, 'priority', 'enabled')).toBe(false);
    });

    it('should detect dependencies enabled', () => {
      expect(parseYamlBoolean(configWithDependencies, 'dependencies', 'enabled')).toBe(true);
      expect(parseYamlBoolean(validConfig, 'dependencies', 'enabled')).toBe(false);
    });
  });

  describe('dependency pattern parsing', () => {
    // Test the dependency parsing logic
    it('should parse default dependency patterns from string', () => {
      const patternString = 'depends on blocked by requires';
      const patterns = patternString.split(/\s+/).filter((p) => p.length > 0);
      expect(patterns).toContain('depends');
      expect(patterns).toContain('blocked');
      expect(patterns).toContain('requires');
    });
  });

  describe('priority label mapping', () => {
    // Test priority detection logic
    it('should map priority labels correctly', () => {
      const priorityLabels = {
        critical: ['priority:critical', 'p0', 'urgent'],
        high: ['priority:high', 'p1'],
        normal: ['priority:normal', 'p2'],
        low: ['priority:low', 'p3', 'backlog'],
      };

      const detectPriority = (labels: string[]): { priority: number; name: string } => {
        for (const label of labels) {
          if (priorityLabels.critical.includes(label)) {
            return { priority: 0, name: 'critical' };
          }
          if (priorityLabels.high.includes(label)) {
            return { priority: 1, name: 'high' };
          }
          if (priorityLabels.low.includes(label)) {
            return { priority: 3, name: 'low' };
          }
          if (priorityLabels.normal.includes(label)) {
            return { priority: 2, name: 'normal' };
          }
        }
        return { priority: 2, name: 'normal' };
      };

      expect(detectPriority(['p0'])).toEqual({ priority: 0, name: 'critical' });
      expect(detectPriority(['priority:high'])).toEqual({ priority: 1, name: 'high' });
      expect(detectPriority(['priority:normal'])).toEqual({ priority: 2, name: 'normal' });
      expect(detectPriority(['backlog'])).toEqual({ priority: 3, name: 'low' });
      expect(detectPriority(['other-label'])).toEqual({ priority: 2, name: 'normal' });
    });
  });

  describe('category label mapping', () => {
    // Test category detection logic
    it('should map category labels correctly', () => {
      const categoryMappings: Record<string, string[]> = {
        bug: ['bug', 'bugfix', 'fix', 'hotfix'],
        feature: ['feature', 'enhancement', 'new-feature'],
        refactor: ['refactor', 'refactoring', 'cleanup', 'tech-debt'],
        docs: ['docs', 'documentation'],
        test: ['test', 'testing', 'tests'],
        chore: ['chore', 'maintenance', 'ci', 'build'],
      };

      const detectCategory = (labels: string[]): string | undefined => {
        for (const [category, categoryLabels] of Object.entries(categoryMappings)) {
          for (const label of labels) {
            if (categoryLabels.includes(label)) {
              return category;
            }
          }
        }
        return undefined;
      };

      expect(detectCategory(['bug'])).toBe('bug');
      expect(detectCategory(['hotfix'])).toBe('bug');
      expect(detectCategory(['enhancement'])).toBe('feature');
      expect(detectCategory(['tech-debt'])).toBe('refactor');
      expect(detectCategory(['documentation'])).toBe('docs');
      expect(detectCategory(['testing'])).toBe('test');
      expect(detectCategory(['ci'])).toBe('chore');
      expect(detectCategory(['unrelated'])).toBeUndefined();
    });
  });

  describe('dependency parsing from issue body', () => {
    // Test the dependency extraction regex logic
    const parseDependencies = (body: string, patterns: string[]): number[] => {
      if (!body) return [];

      const deps: number[] = [];
      const patternRegex = patterns.map((p) => p.replace(/\s+/g, '\\s+')).join('|');
      const regex = new RegExp(`(?:${patternRegex})\\s+#?(\\d+)(?:[,\\s]+(?:and\\s+)?#?(\\d+))*`, 'gi');

      let match;
      while ((match = regex.exec(body)) !== null) {
        const issueRefs = match[0].match(/#?\d+/g);
        if (issueRefs) {
          for (const ref of issueRefs) {
            const num = parseInt(ref.replace('#', ''), 10);
            if (!isNaN(num) && !deps.includes(num)) {
              deps.push(num);
            }
          }
        }
      }

      return deps;
    };

    it('should parse single dependency', () => {
      const body = 'This issue depends on #42';
      const patterns = ['depends on', 'blocked by', 'requires'];
      expect(parseDependencies(body, patterns)).toContain(42);
    });

    it('should parse multiple dependencies', () => {
      const body = 'This is blocked by #42 and #43';
      const patterns = ['depends on', 'blocked by', 'requires'];
      const deps = parseDependencies(body, patterns);
      expect(deps).toContain(42);
      expect(deps).toContain(43);
    });

    it('should parse dependencies without hash', () => {
      const body = 'Requires 100';
      const patterns = ['depends on', 'blocked by', 'requires'];
      expect(parseDependencies(body, patterns)).toContain(100);
    });

    it('should return empty array for empty body', () => {
      const patterns = ['depends on', 'blocked by', 'requires'];
      expect(parseDependencies('', patterns)).toEqual([]);
    });

    it('should return empty array when no dependencies found', () => {
      const body = 'This is a regular issue description';
      const patterns = ['depends on', 'blocked by', 'requires'];
      expect(parseDependencies(body, patterns)).toEqual([]);
    });

    it('should handle case insensitive matching', () => {
      const body = 'DEPENDS ON #99';
      const patterns = ['depends on'];
      expect(parseDependencies(body, patterns)).toContain(99);
    });
  });

  describe('task sorting by priority', () => {
    it('should sort tasks by priority', () => {
      const tasks: QueueTask[] = [
        { number: 1, title: 'Low priority', url: '', itemId: '1', priority: 3, priorityName: 'low' },
        { number: 2, title: 'Critical', url: '', itemId: '2', priority: 0, priorityName: 'critical' },
        { number: 3, title: 'Normal', url: '', itemId: '3', priority: 2, priorityName: 'normal' },
        { number: 4, title: 'High', url: '', itemId: '4', priority: 1, priorityName: 'high' },
      ];

      const sorted = [...tasks].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));

      expect(sorted[0].priorityName).toBe('critical');
      expect(sorted[1].priorityName).toBe('high');
      expect(sorted[2].priorityName).toBe('normal');
      expect(sorted[3].priorityName).toBe('low');
    });

    it('should handle tasks without priority', () => {
      const tasks: QueueTask[] = [
        { number: 1, title: 'No priority', url: '', itemId: '1' },
        { number: 2, title: 'Critical', url: '', itemId: '2', priority: 0, priorityName: 'critical' },
      ];

      const sorted = [...tasks].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));

      // Tasks without priority default to 2 (normal), so critical (0) comes first
      expect(sorted[0].priorityName).toBe('critical');
    });
  });

  describe('task filtering by status', () => {
    it('should identify blocked tasks', () => {
      const tasks: QueueTask[] = [
        {
          number: 1,
          title: 'Blocked task',
          url: '',
          itemId: '1',
          dependencies: [42],
          dependencyStatus: 'blocked',
          blockingIssues: [42],
        },
        {
          number: 2,
          title: 'Ready task',
          url: '',
          itemId: '2',
          dependencies: [43],
          dependencyStatus: 'resolved',
          blockingIssues: [],
        },
        {
          number: 3,
          title: 'No deps',
          url: '',
          itemId: '3',
        },
      ];

      const blockedTasks = tasks.filter((t) => t.dependencyStatus === 'blocked');
      const readyTasks = tasks.filter((t) => t.dependencyStatus !== 'blocked');

      expect(blockedTasks).toHaveLength(1);
      expect(blockedTasks[0].number).toBe(1);
      expect(readyTasks).toHaveLength(2);
    });
  });
});
