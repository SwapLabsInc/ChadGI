/**
 * Unit tests for src/utils/data.ts
 *
 * Tests data loading utilities for session stats, metrics, and other files.
 */
import { jest } from '@jest/globals';
import { vol } from 'memfs';
// Mock the fs module
jest.unstable_mockModule('fs', () => ({
    existsSync: jest.fn((path) => vol.existsSync(path)),
    readFileSync: jest.fn((path, encoding) => vol.readFileSync(path, encoding)),
    readdirSync: jest.fn((dir) => vol.readdirSync(dir)),
    mkdirSync: jest.fn((path, options) => vol.mkdirSync(path, options)),
    unlinkSync: jest.fn((path) => vol.unlinkSync(path)),
    writeFileSync: jest.fn((path, content, encoding) => {
        const dir = path.substring(0, path.lastIndexOf('/'));
        if (dir && !vol.existsSync(dir)) {
            vol.mkdirSync(dir, { recursive: true });
        }
        vol.writeFileSync(path, content);
    }),
    renameSync: jest.fn((oldPath, newPath) => {
        const content = vol.readFileSync(oldPath);
        vol.writeFileSync(newPath, content);
        vol.unlinkSync(oldPath);
    }),
}));
// Import after mocking
const { loadSessionStats, getMostRecentSession, loadTaskMetrics, getFailedTaskMetrics, getCompletedTaskMetrics, loadProgressData, loadPauseLock, isPaused, findPendingApproval, listApprovalLocks, loadJsonFile, fileExists, readTextFile } = await import('../../utils/data.js');
import { sampleSessionStats, sampleTaskMetrics, sampleMetricsData, sampleProgressData, samplePauseLock, sampleApprovalLock, } from '../fixtures/data.js';
describe('data utilities', () => {
    beforeEach(() => {
        vol.reset();
    });
    describe('loadSessionStats', () => {
        it('should load session stats from file', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-stats.json': JSON.stringify(sampleSessionStats),
            });
            const result = loadSessionStats('/project/.chadgi');
            expect(result).toHaveLength(2);
            expect(result[0].session_id).toBe('session-001');
            expect(result[1].session_id).toBe('session-002');
        });
        it('should return empty array if file does not exist', () => {
            vol.fromJSON({
                '/project/.chadgi/other-file.json': '{}',
            });
            const result = loadSessionStats('/project/.chadgi');
            expect(result).toEqual([]);
        });
        it('should return empty array on parse error', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-stats.json': 'invalid json',
            });
            const result = loadSessionStats('/project/.chadgi');
            expect(result).toEqual([]);
        });
    });
    describe('getMostRecentSession', () => {
        it('should return the most recent session', () => {
            // Create a copy to avoid mutation issues
            const sessions = [...sampleSessionStats];
            const result = getMostRecentSession(sessions);
            expect(result).not.toBeNull();
            expect(result.session_id).toBe('session-002');
        });
        it('should return null for empty array', () => {
            const result = getMostRecentSession([]);
            expect(result).toBeNull();
        });
        it('should handle single session', () => {
            // Create a single session that is definitely the first one
            const singleSession = {
                session_id: 'single-session',
                started_at: '2026-01-10T10:00:00Z',
                ended_at: '2026-01-10T12:00:00Z',
                duration_secs: 7200,
                tasks_attempted: 1,
                tasks_completed: 1,
                successful_tasks: [],
                failed_tasks: [],
                total_cost_usd: 0.1,
                gigachad_mode: false,
                gigachad_merges: 0,
                repo: 'test/repo',
            };
            const result = getMostRecentSession([singleSession]);
            expect(result).not.toBeNull();
            expect(result.session_id).toBe('single-session');
        });
    });
    describe('loadTaskMetrics', () => {
        it('should load task metrics from file', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-metrics.json': JSON.stringify(sampleMetricsData),
            });
            const result = loadTaskMetrics('/project/.chadgi');
            expect(result).toHaveLength(4);
            expect(result[0].issue_number).toBe(42);
        });
        it('should return empty array if file does not exist', () => {
            vol.fromJSON({
                '/project/.chadgi/other-file.json': '{}',
            });
            const result = loadTaskMetrics('/project/.chadgi');
            expect(result).toEqual([]);
        });
        it('should return empty array on parse error', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-metrics.json': 'invalid json',
            });
            const result = loadTaskMetrics('/project/.chadgi');
            expect(result).toEqual([]);
        });
    });
    describe('getFailedTaskMetrics', () => {
        it('should filter failed tasks', () => {
            const result = getFailedTaskMetrics(sampleTaskMetrics);
            expect(result).toHaveLength(1);
            expect(result[0].issue_number).toBe(44);
            expect(result[0].status).toBe('failed');
        });
        it('should return empty array if no failed tasks', () => {
            const completedOnly = sampleTaskMetrics.filter((m) => m.status === 'completed');
            const result = getFailedTaskMetrics(completedOnly);
            expect(result).toEqual([]);
        });
    });
    describe('getCompletedTaskMetrics', () => {
        it('should filter completed tasks', () => {
            const result = getCompletedTaskMetrics(sampleTaskMetrics);
            expect(result).toHaveLength(3);
            expect(result.every((m) => m.status === 'completed')).toBe(true);
        });
    });
    describe('loadProgressData', () => {
        it('should load progress data from file', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-progress.json': JSON.stringify(sampleProgressData),
            });
            const result = loadProgressData('/project/.chadgi');
            expect(result).not.toBeNull();
            expect(result.status).toBe('in_progress');
            expect(result.current_task?.id).toBe('51');
        });
        it('should return null if file does not exist', () => {
            vol.fromJSON({
                '/project/.chadgi/other-file.json': '{}',
            });
            const result = loadProgressData('/project/.chadgi');
            expect(result).toBeNull();
        });
    });
    describe('loadPauseLock', () => {
        it('should load pause lock data', () => {
            vol.fromJSON({
                '/project/.chadgi/pause.lock': JSON.stringify(samplePauseLock),
            });
            const result = loadPauseLock('/project/.chadgi');
            expect(result).not.toBeNull();
            expect(result.paused_at).toBe('2026-01-15T14:30:00Z');
            expect(result.reason).toBe('User requested pause');
        });
        it('should return null if not paused', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-progress.json': '{}',
            });
            const result = loadPauseLock('/project/.chadgi');
            expect(result).toBeNull();
        });
    });
    describe('isPaused', () => {
        it('should return true when pause.lock exists', () => {
            vol.fromJSON({
                '/project/.chadgi/pause.lock': JSON.stringify(samplePauseLock),
            });
            expect(isPaused('/project/.chadgi')).toBe(true);
        });
        it('should return false when pause.lock does not exist', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-progress.json': '{}',
            });
            expect(isPaused('/project/.chadgi')).toBe(false);
        });
    });
    describe('findPendingApproval', () => {
        it('should find pending approval lock', () => {
            vol.fromJSON({
                '/project/.chadgi/approval-53.lock': JSON.stringify(sampleApprovalLock),
            });
            const result = findPendingApproval('/project/.chadgi');
            expect(result).not.toBeNull();
            expect(result.issue_number).toBe(53);
            expect(result.status).toBe('pending');
        });
        it('should return null when no pending approvals', () => {
            vol.fromJSON({
                '/project/.chadgi/approval-53.lock': JSON.stringify({ ...sampleApprovalLock, status: 'approved' }),
            });
            const result = findPendingApproval('/project/.chadgi');
            expect(result).toBeNull();
        });
        it('should return null when no approval files exist', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-progress.json': '{}',
            });
            const result = findPendingApproval('/project/.chadgi');
            expect(result).toBeNull();
        });
    });
    describe('listApprovalLocks', () => {
        it('should list all approval locks', () => {
            vol.fromJSON({
                '/project/.chadgi/approval-53.lock': JSON.stringify(sampleApprovalLock),
                '/project/.chadgi/approval-54.lock': JSON.stringify({ ...sampleApprovalLock, issue_number: 54, status: 'approved' }),
            });
            const result = listApprovalLocks('/project/.chadgi');
            expect(result).toHaveLength(2);
        });
        it('should return empty array when no approval files', () => {
            vol.fromJSON({
                '/project/.chadgi/chadgi-progress.json': '{}',
            });
            const result = listApprovalLocks('/project/.chadgi');
            expect(result).toEqual([]);
        });
    });
    describe('loadJsonFile', () => {
        it('should load and parse JSON file', () => {
            vol.fromJSON({
                '/test.json': JSON.stringify({ key: 'value' }),
            });
            const result = loadJsonFile('/test.json');
            expect(result).toEqual({ key: 'value' });
        });
        it('should return null for non-existent file', () => {
            const result = loadJsonFile('/nonexistent.json');
            expect(result).toBeNull();
        });
        it('should return null for invalid JSON', () => {
            vol.fromJSON({
                '/invalid.json': 'not valid json',
            });
            const result = loadJsonFile('/invalid.json');
            expect(result).toBeNull();
        });
    });
    describe('fileExists', () => {
        it('should return true for existing files', () => {
            vol.fromJSON({
                '/exists.txt': 'content',
            });
            expect(fileExists('/exists.txt')).toBe(true);
        });
        it('should return false for non-existent files', () => {
            expect(fileExists('/nonexistent.txt')).toBe(false);
        });
    });
    describe('readTextFile', () => {
        it('should read file content', () => {
            vol.fromJSON({
                '/test.txt': 'file content',
            });
            const result = readTextFile('/test.txt');
            expect(result).toBe('file content');
        });
        it('should return null for non-existent file', () => {
            const result = readTextFile('/nonexistent.txt');
            expect(result).toBeNull();
        });
    });
});
//# sourceMappingURL=data.test.js.map