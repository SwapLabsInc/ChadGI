/**
 * Unit tests for src/utils/locks.ts
 *
 * Tests task lock utilities for preventing concurrent processing of same issue.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock the fs module
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => vol.existsSync(path)),
  readFileSync: jest.fn((path: string, encoding?: string) => vol.readFileSync(path, encoding)),
  readdirSync: jest.fn((dir: string) => vol.readdirSync(dir)),
  mkdirSync: jest.fn((path: string, options?: object) => vol.mkdirSync(path, options)),
  unlinkSync: jest.fn((path: string) => vol.unlinkSync(path)),
  writeFileSync: jest.fn((path: string, content: string, encoding?: string) => {
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir && !vol.existsSync(dir)) {
      vol.mkdirSync(dir, { recursive: true });
    }
    vol.writeFileSync(path, content);
  }),
  renameSync: jest.fn((oldPath: string, newPath: string) => {
    const content = vol.readFileSync(oldPath);
    vol.writeFileSync(newPath, content);
    vol.unlinkSync(oldPath);
  }),
}));

// Mock os.hostname
jest.unstable_mockModule('os', () => ({
  hostname: jest.fn(() => 'test-host'),
}));

// Import after mocking
const {
  generateSessionId,
  getLocksDir,
  getLockFilePath,
  ensureLocksDir,
  readTaskLock,
  isLockStale,
  acquireTaskLock,
  releaseTaskLock,
  forceReleaseTaskLock,
  updateLockHeartbeat,
  listTaskLocks,
  findStaleLocks,
  cleanupStaleLocks,
  isIssueLocked,
  isLockedByOther,
  releaseAllSessionLocks,
  DEFAULT_LOCK_TIMEOUT_MINUTES,
} = await import('../../utils/locks.js');

describe('locks utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vol.reset();
  });

  describe('generateSessionId', () => {
    it('should generate a unique session ID', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();

      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id1).toContain('test-host');
    });
  });

  describe('getLocksDir', () => {
    it('should return the locks directory path', () => {
      const result = getLocksDir('/project/.chadgi');
      expect(result).toBe('/project/.chadgi/locks');
    });
  });

  describe('getLockFilePath', () => {
    it('should return the lock file path for an issue', () => {
      const result = getLockFilePath('/project/.chadgi', 42);
      expect(result).toBe('/project/.chadgi/locks/issue-42.lock');
    });
  });

  describe('ensureLocksDir', () => {
    it('should create the locks directory if it does not exist', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      ensureLocksDir('/project/.chadgi');

      expect(vol.existsSync('/project/.chadgi/locks')).toBe(true);
    });

    it('should not fail if directory already exists', () => {
      vol.mkdirSync('/project/.chadgi/locks', { recursive: true });

      expect(() => ensureLocksDir('/project/.chadgi')).not.toThrow();
    });
  });

  describe('readTaskLock', () => {
    it('should return null if no lock exists', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      const result = readTaskLock('/project/.chadgi', 42);
      expect(result).toBeNull();
    });

    it('should read and parse lock file', () => {
      const lockData = {
        issue_number: 42,
        session_id: 'session-123',
        pid: 1234,
        hostname: 'test-host',
        locked_at: '2026-01-15T10:00:00Z',
        last_heartbeat: '2026-01-15T10:05:00Z',
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lockData),
      });

      const result = readTaskLock('/project/.chadgi', 42);
      expect(result).not.toBeNull();
      expect(result?.issue_number).toBe(42);
      expect(result?.session_id).toBe('session-123');
    });

    it('should return null on invalid JSON', () => {
      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': 'invalid json',
      });

      const result = readTaskLock('/project/.chadgi', 42);
      expect(result).toBeNull();
    });
  });

  describe('isLockStale', () => {
    it('should return false for recent lock', () => {
      const lock = {
        issue_number: 42,
        session_id: 'session-123',
        pid: 1234,
        hostname: 'test-host',
        locked_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };

      const result = isLockStale(lock);
      expect(result).toBe(false);
    });

    it('should return true for old lock', () => {
      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3 hours ago
      const lock = {
        issue_number: 42,
        session_id: 'session-123',
        pid: 1234,
        hostname: 'test-host',
        locked_at: oldTime,
        last_heartbeat: oldTime,
      };

      const result = isLockStale(lock, 120); // 2 hour timeout
      expect(result).toBe(true);
    });

    it('should respect custom timeout', () => {
      const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago
      const lock = {
        issue_number: 42,
        session_id: 'session-123',
        pid: 1234,
        hostname: 'test-host',
        locked_at: recentTime,
        last_heartbeat: recentTime,
      };

      // Should not be stale with 2 hour timeout
      expect(isLockStale(lock, 120)).toBe(false);

      // Should be stale with 20 minute timeout
      expect(isLockStale(lock, 20)).toBe(true);
    });
  });

  describe('acquireTaskLock', () => {
    it('should acquire lock when no existing lock', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      const result = acquireTaskLock('/project/.chadgi', 42, 'session-abc');

      expect(result.acquired).toBe(true);
      expect(result.lock).toBeDefined();
      expect(result.lock?.issue_number).toBe(42);
      expect(result.lock?.session_id).toBe('session-abc');
    });

    it('should refresh lock if same session owns it', () => {
      const existingLock = {
        issue_number: 42,
        session_id: 'session-abc',
        pid: process.pid,
        hostname: 'test-host',
        locked_at: '2026-01-15T10:00:00Z',
        last_heartbeat: '2026-01-15T10:00:00Z',
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(existingLock),
      });

      const result = acquireTaskLock('/project/.chadgi', 42, 'session-abc');

      expect(result.acquired).toBe(true);
      // Heartbeat should be updated
      expect(new Date(result.lock!.last_heartbeat).getTime()).toBeGreaterThan(
        new Date('2026-01-15T10:00:00Z').getTime()
      );
    });

    it('should fail if lock is held by another active session', () => {
      const existingLock = {
        issue_number: 42,
        session_id: 'other-session',
        pid: 99999, // Different process
        hostname: 'other-host',
        locked_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(existingLock),
      });

      const result = acquireTaskLock('/project/.chadgi', 42, 'session-abc');

      expect(result.acquired).toBe(false);
      expect(result.reason).toBe('already_locked');
    });

    it('should acquire lock with forceClaim on stale lock', () => {
      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3 hours ago
      const existingLock = {
        issue_number: 42,
        session_id: 'stale-session',
        pid: 99999,
        hostname: 'other-host',
        locked_at: oldTime,
        last_heartbeat: oldTime,
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(existingLock),
      });

      const result = acquireTaskLock('/project/.chadgi', 42, 'session-abc', { forceClaim: true });

      expect(result.acquired).toBe(true);
      expect(result.lock?.session_id).toBe('session-abc');
    });

    it('should include worker_id and repo_name when provided', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      const result = acquireTaskLock('/project/.chadgi', 42, 'session-abc', {
        workerId: 3,
        repoName: 'test-repo',
      });

      expect(result.acquired).toBe(true);
      expect(result.lock?.worker_id).toBe(3);
      expect(result.lock?.repo_name).toBe('test-repo');
    });
  });

  describe('releaseTaskLock', () => {
    it('should return true if no lock exists', () => {
      vol.mkdirSync('/project/.chadgi/locks', { recursive: true });

      const result = releaseTaskLock('/project/.chadgi', 42);
      expect(result).toBe(true);
    });

    it('should release lock owned by session', () => {
      const lock = {
        issue_number: 42,
        session_id: 'session-abc',
        pid: process.pid,
        hostname: 'test-host',
        locked_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock),
      });

      const result = releaseTaskLock('/project/.chadgi', 42, 'session-abc');

      expect(result).toBe(true);
      expect(vol.existsSync('/project/.chadgi/locks/issue-42.lock')).toBe(false);
    });

    it('should not release lock owned by another session', () => {
      const lock = {
        issue_number: 42,
        session_id: 'other-session',
        pid: 99999,
        hostname: 'other-host',
        locked_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock),
      });

      const result = releaseTaskLock('/project/.chadgi', 42, 'session-abc');

      expect(result).toBe(false);
      expect(vol.existsSync('/project/.chadgi/locks/issue-42.lock')).toBe(true);
    });
  });

  describe('forceReleaseTaskLock', () => {
    it('should force release lock regardless of owner', () => {
      const lock = {
        issue_number: 42,
        session_id: 'other-session',
        pid: 99999,
        hostname: 'other-host',
        locked_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock),
      });

      const result = forceReleaseTaskLock('/project/.chadgi', 42);

      expect(result).toBe(true);
      expect(vol.existsSync('/project/.chadgi/locks/issue-42.lock')).toBe(false);
    });
  });

  describe('listTaskLocks', () => {
    it('should return empty array when no locks', () => {
      vol.mkdirSync('/project/.chadgi', { recursive: true });

      const result = listTaskLocks('/project/.chadgi');
      expect(result).toEqual([]);
    });

    it('should list all locks with status info', () => {
      const recentTime = new Date().toISOString();
      const lock1 = {
        issue_number: 42,
        session_id: 'session-1',
        pid: 1234,
        hostname: 'host-1',
        locked_at: recentTime,
        last_heartbeat: recentTime,
      };

      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const lock2 = {
        issue_number: 43,
        session_id: 'session-2',
        pid: 5678,
        hostname: 'host-2',
        locked_at: oldTime,
        last_heartbeat: oldTime,
        worker_id: 2,
        repo_name: 'test-repo',
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock1),
        '/project/.chadgi/locks/issue-43.lock': JSON.stringify(lock2),
      });

      const result = listTaskLocks('/project/.chadgi');

      expect(result).toHaveLength(2);

      const lock42 = result.find(l => l.issueNumber === 42);
      expect(lock42?.isStale).toBe(false);

      const lock43 = result.find(l => l.issueNumber === 43);
      expect(lock43?.isStale).toBe(true);
      expect(lock43?.workerId).toBe(2);
      expect(lock43?.repoName).toBe('test-repo');
    });
  });

  describe('findStaleLocks', () => {
    it('should return only stale locks', () => {
      const recentTime = new Date().toISOString();
      const lock1 = {
        issue_number: 42,
        session_id: 'session-1',
        pid: 1234,
        hostname: 'host-1',
        locked_at: recentTime,
        last_heartbeat: recentTime,
      };

      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const lock2 = {
        issue_number: 43,
        session_id: 'session-2',
        pid: 5678,
        hostname: 'host-2',
        locked_at: oldTime,
        last_heartbeat: oldTime,
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock1),
        '/project/.chadgi/locks/issue-43.lock': JSON.stringify(lock2),
      });

      const result = findStaleLocks('/project/.chadgi');

      expect(result).toHaveLength(1);
      expect(result[0].issueNumber).toBe(43);
    });
  });

  describe('cleanupStaleLocks', () => {
    it('should remove stale locks', () => {
      const recentTime = new Date().toISOString();
      const lock1 = {
        issue_number: 42,
        session_id: 'session-1',
        pid: 1234,
        hostname: 'host-1',
        locked_at: recentTime,
        last_heartbeat: recentTime,
      };

      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const lock2 = {
        issue_number: 43,
        session_id: 'session-2',
        pid: 5678,
        hostname: 'host-2',
        locked_at: oldTime,
        last_heartbeat: oldTime,
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock1),
        '/project/.chadgi/locks/issue-43.lock': JSON.stringify(lock2),
      });

      const removedCount = cleanupStaleLocks('/project/.chadgi');

      expect(removedCount).toBe(1);
      expect(vol.existsSync('/project/.chadgi/locks/issue-42.lock')).toBe(true);
      expect(vol.existsSync('/project/.chadgi/locks/issue-43.lock')).toBe(false);
    });
  });

  describe('isIssueLocked', () => {
    it('should return true when lock exists', () => {
      const lock = {
        issue_number: 42,
        session_id: 'session-1',
        pid: 1234,
        hostname: 'host-1',
        locked_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock),
      });

      expect(isIssueLocked('/project/.chadgi', 42)).toBe(true);
    });

    it('should return false when no lock exists', () => {
      vol.mkdirSync('/project/.chadgi/locks', { recursive: true });

      expect(isIssueLocked('/project/.chadgi', 42)).toBe(false);
    });
  });

  describe('isLockedByOther', () => {
    it('should return false when not locked', () => {
      vol.mkdirSync('/project/.chadgi/locks', { recursive: true });

      const result = isLockedByOther('/project/.chadgi', 42, 'session-abc');
      expect(result).toBe(false);
    });

    it('should return false when locked by same session', () => {
      const lock = {
        issue_number: 42,
        session_id: 'session-abc',
        pid: process.pid,
        hostname: 'test-host',
        locked_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock),
      });

      const result = isLockedByOther('/project/.chadgi', 42, 'session-abc');
      expect(result).toBe(false);
    });

    it('should return true when locked by another active session', () => {
      const lock = {
        issue_number: 42,
        session_id: 'other-session',
        pid: 99999,
        hostname: 'other-host',
        locked_at: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock),
      });

      const result = isLockedByOther('/project/.chadgi', 42, 'session-abc');
      expect(result).toBe(true);
    });

    it('should return false when lock is stale', () => {
      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const lock = {
        issue_number: 42,
        session_id: 'other-session',
        pid: 99999,
        hostname: 'other-host',
        locked_at: oldTime,
        last_heartbeat: oldTime,
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock),
      });

      const result = isLockedByOther('/project/.chadgi', 42, 'session-abc');
      expect(result).toBe(false); // Stale locks don't block
    });
  });

  describe('releaseAllSessionLocks', () => {
    it('should release all locks for a session', () => {
      const recentTime = new Date().toISOString();
      const lock1 = {
        issue_number: 42,
        session_id: 'session-abc',
        pid: 1234,
        hostname: 'test-host',
        locked_at: recentTime,
        last_heartbeat: recentTime,
      };

      const lock2 = {
        issue_number: 43,
        session_id: 'session-abc',
        pid: 1234,
        hostname: 'test-host',
        locked_at: recentTime,
        last_heartbeat: recentTime,
      };

      const lock3 = {
        issue_number: 44,
        session_id: 'other-session',
        pid: 5678,
        hostname: 'other-host',
        locked_at: recentTime,
        last_heartbeat: recentTime,
      };

      vol.fromJSON({
        '/project/.chadgi/locks/issue-42.lock': JSON.stringify(lock1),
        '/project/.chadgi/locks/issue-43.lock': JSON.stringify(lock2),
        '/project/.chadgi/locks/issue-44.lock': JSON.stringify(lock3),
      });

      const releasedCount = releaseAllSessionLocks('/project/.chadgi', 'session-abc');

      expect(releasedCount).toBe(2);
      expect(vol.existsSync('/project/.chadgi/locks/issue-42.lock')).toBe(false);
      expect(vol.existsSync('/project/.chadgi/locks/issue-43.lock')).toBe(false);
      expect(vol.existsSync('/project/.chadgi/locks/issue-44.lock')).toBe(true);
    });
  });

  describe('DEFAULT_LOCK_TIMEOUT_MINUTES', () => {
    it('should have correct default value', () => {
      expect(DEFAULT_LOCK_TIMEOUT_MINUTES).toBe(120);
    });
  });
});
