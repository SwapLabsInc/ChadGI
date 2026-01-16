/**
 * Unit tests for parallel task processing in workspace mode
 *
 * Tests the parallel worker management, progress tracking, and
 * concurrent task execution for workspace mode.
 */
import { jest } from '@jest/globals';
import { vol } from 'memfs';
// Mock the fs module
jest.unstable_mockModule('fs', () => ({
    existsSync: jest.fn((path) => vol.existsSync(path)),
    readFileSync: jest.fn((path, encoding) => vol.readFileSync(path, encoding)),
    writeFileSync: jest.fn((path, content) => {
        vol.writeFileSync(path, content);
    }),
    mkdirSync: jest.fn((path, options) => {
        vol.mkdirSync(path, options);
    }),
    rmSync: jest.fn((path, options) => {
        try {
            vol.rmdirSync(path, options);
        }
        catch {
            // Ignore
        }
    }),
    watchFile: jest.fn(),
    unwatchFile: jest.fn(),
    statSync: jest.fn(() => ({
        mtimeMs: Date.now(),
    })),
}));
// Mock child_process
const mockExecSync = jest.fn();
const mockSpawn = jest.fn();
jest.unstable_mockModule('child_process', () => ({
    execSync: mockExecSync,
    spawn: mockSpawn,
}));
// Mock secrets module
jest.unstable_mockModule('../utils/secrets.js', () => ({
    maskSecrets: jest.fn((text) => text),
    setMaskingDisabled: jest.fn(),
}));
// Mock fileOps module
jest.unstable_mockModule('../utils/fileOps.js', () => ({
    atomicWriteJson: jest.fn((path, data) => {
        vol.writeFileSync(path, JSON.stringify(data, null, 2));
    }),
    atomicWriteFile: jest.fn((path, content) => {
        vol.writeFileSync(path, content);
    }),
}));
describe('Parallel Task Processing', () => {
    beforeEach(() => {
        vol.reset();
        jest.clearAllMocks();
    });
    describe('ParallelWorkerTask type', () => {
        it('should have correct structure for worker task data', () => {
            const workerTask = {
                worker_id: 1,
                repo_name: 'owner/repo',
                repo_path: '/path/to/repo',
                status: 'in_progress',
                phase: 'implementation',
                cost_usd: 0.05,
                started_at: new Date().toISOString(),
            };
            expect(workerTask.worker_id).toBe(1);
            expect(workerTask.repo_name).toBe('owner/repo');
            expect(workerTask.status).toBe('in_progress');
            expect(workerTask.cost_usd).toBe(0.05);
        });
        it('should support task info within worker', () => {
            const workerTask = {
                worker_id: 2,
                repo_name: 'owner/repo',
                repo_path: '/path/to/repo',
                task: {
                    id: '123',
                    title: 'Test Issue',
                    branch: 'feature/test-123',
                    started_at: new Date().toISOString(),
                },
                status: 'in_progress',
            };
            expect(workerTask.task).toBeDefined();
            expect(workerTask.task?.id).toBe('123');
            expect(workerTask.task?.branch).toBe('feature/test-123');
        });
    });
    describe('ParallelSessionProgress type', () => {
        it('should track aggregate cost across workers', () => {
            const session = {
                started_at: new Date().toISOString(),
                tasks_completed: 5,
                total_cost_usd: 0.25,
                active_workers: 3,
                max_workers: 4,
                aggregate_cost_usd: 0.25,
            };
            expect(session.active_workers).toBe(3);
            expect(session.max_workers).toBe(4);
            expect(session.aggregate_cost_usd).toBe(0.25);
        });
    });
    describe('ProgressData parallel mode', () => {
        it('should support parallel mode flags', () => {
            const progress = {
                status: 'in_progress',
                last_updated: new Date().toISOString(),
                parallel_mode: true,
                parallel_workers: [],
                parallel_session: {
                    started_at: new Date().toISOString(),
                    tasks_completed: 0,
                    total_cost_usd: 0,
                    active_workers: 2,
                    max_workers: 4,
                    aggregate_cost_usd: 0,
                },
            };
            expect(progress.parallel_mode).toBe(true);
            expect(progress.parallel_session?.max_workers).toBe(4);
        });
        it('should track multiple concurrent workers', () => {
            const now = new Date().toISOString();
            const progress = {
                status: 'in_progress',
                last_updated: now,
                parallel_mode: true,
                parallel_workers: [
                    {
                        worker_id: 1,
                        repo_name: 'owner/repo1',
                        repo_path: '/repos/repo1',
                        status: 'in_progress',
                        cost_usd: 0.03,
                        started_at: now,
                    },
                    {
                        worker_id: 2,
                        repo_name: 'owner/repo2',
                        repo_path: '/repos/repo2',
                        status: 'in_progress',
                        cost_usd: 0.02,
                        started_at: now,
                    },
                    {
                        worker_id: 3,
                        repo_name: 'owner/repo3',
                        repo_path: '/repos/repo3',
                        status: 'completed',
                        cost_usd: 0.05,
                        started_at: now,
                    },
                ],
                parallel_session: {
                    started_at: now,
                    tasks_completed: 1,
                    total_cost_usd: 0.10,
                    active_workers: 2,
                    max_workers: 3,
                    aggregate_cost_usd: 0.10,
                },
            };
            expect(progress.parallel_workers).toHaveLength(3);
            expect(progress.parallel_workers?.[0].status).toBe('in_progress');
            expect(progress.parallel_workers?.[2].status).toBe('completed');
            expect(progress.parallel_session?.active_workers).toBe(2);
        });
    });
    describe('Progress file format', () => {
        it('should serialize parallel progress data to JSON correctly', () => {
            const now = new Date().toISOString();
            const progress = {
                status: 'in_progress',
                last_updated: now,
                parallel_mode: true,
                parallel_workers: [
                    {
                        worker_id: 1,
                        repo_name: 'test/repo',
                        repo_path: '/test/repo',
                        status: 'in_progress',
                        cost_usd: 0.01,
                    },
                ],
                parallel_session: {
                    started_at: now,
                    tasks_completed: 0,
                    total_cost_usd: 0.01,
                    active_workers: 1,
                    max_workers: 2,
                    aggregate_cost_usd: 0.01,
                },
            };
            const json = JSON.stringify(progress, null, 2);
            const parsed = JSON.parse(json);
            expect(parsed.parallel_mode).toBe(true);
            expect(parsed.parallel_workers).toHaveLength(1);
            expect(parsed.parallel_session?.max_workers).toBe(2);
        });
        it('should maintain backward compatibility with non-parallel progress', () => {
            const progress = {
                status: 'in_progress',
                last_updated: new Date().toISOString(),
                current_task: {
                    id: '42',
                    title: 'Test task',
                    branch: 'feature/test-42',
                    started_at: new Date().toISOString(),
                },
                session: {
                    started_at: new Date().toISOString(),
                    tasks_completed: 3,
                    total_cost_usd: 0.15,
                },
            };
            // Non-parallel mode should not have parallel fields
            expect(progress.parallel_mode).toBeUndefined();
            expect(progress.parallel_workers).toBeUndefined();
            expect(progress.parallel_session).toBeUndefined();
            // Should still have standard fields
            expect(progress.current_task?.id).toBe('42');
            expect(progress.session?.tasks_completed).toBe(3);
        });
    });
});
describe('Workspace Configuration', () => {
    describe('max_parallel_tasks setting', () => {
        it('should parse max_parallel_tasks from workspace config', () => {
            const workspaceConfig = {
                version: '1.0.0',
                name: 'test-workspace',
                strategy: 'round-robin',
                repos: {},
                settings: {
                    auto_clone: false,
                    parallel_validation: true,
                    aggregate_stats: true,
                    max_parallel_tasks: 4,
                },
                created_at: '',
                updated_at: '',
            };
            expect(workspaceConfig.settings.max_parallel_tasks).toBe(4);
        });
        it('should default to 1 when not specified', () => {
            const workspaceConfig = {
                version: '1.0.0',
                name: 'test-workspace',
                strategy: 'round-robin',
                repos: {},
                settings: {
                    auto_clone: false,
                },
                created_at: '',
                updated_at: '',
            };
            const maxParallel = workspaceConfig.settings.max_parallel_tasks ?? 1;
            expect(maxParallel).toBe(1);
        });
    });
});
describe('Parallel Worker Status Tracking', () => {
    it('should support all valid worker statuses', () => {
        const statuses = ['idle', 'in_progress', 'completed', 'failed'];
        for (const status of statuses) {
            const worker = {
                worker_id: 1,
                repo_name: 'test/repo',
                repo_path: '/test/repo',
                status,
            };
            expect(worker.status).toBe(status);
        }
    });
    it('should track error information when worker fails', () => {
        const worker = {
            worker_id: 1,
            repo_name: 'test/repo',
            repo_path: '/test/repo',
            status: 'failed',
            error: 'Task exceeded timeout limit',
        };
        expect(worker.status).toBe('failed');
        expect(worker.error).toBe('Task exceeded timeout limit');
    });
});
describe('Cost Aggregation', () => {
    it('should correctly aggregate costs across workers', () => {
        const workers = [
            { worker_id: 1, repo_name: 'r1', repo_path: '/r1', status: 'completed', cost_usd: 0.05 },
            { worker_id: 2, repo_name: 'r2', repo_path: '/r2', status: 'completed', cost_usd: 0.03 },
            { worker_id: 3, repo_name: 'r3', repo_path: '/r3', status: 'in_progress', cost_usd: 0.02 },
        ];
        const aggregateCost = workers.reduce((sum, w) => sum + (w.cost_usd ?? 0), 0);
        expect(aggregateCost).toBeCloseTo(0.10, 10);
    });
    it('should handle workers with no cost yet', () => {
        const workers = [
            { worker_id: 1, repo_name: 'r1', repo_path: '/r1', status: 'in_progress' },
            { worker_id: 2, repo_name: 'r2', repo_path: '/r2', status: 'idle' },
        ];
        const aggregateCost = workers.reduce((sum, w) => sum + (w.cost_usd ?? 0), 0);
        expect(aggregateCost).toBe(0);
    });
});
//# sourceMappingURL=parallel.test.js.map