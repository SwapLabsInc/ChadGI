/**
 * Unit tests for status-middleware.ts command handler.
 *
 * Tests the status command handler using the middleware pattern,
 * covering success cases, error handling, edge cases, and JSON output format.
 */
import { jest } from '@jest/globals';
import { vol } from 'memfs';
// Mock fs module before importing anything that uses it
jest.unstable_mockModule('fs', async () => {
    const memfs = await import('memfs');
    return memfs.fs;
});
// Import after mocking
const { existsSync, readFileSync, readdirSync } = await import('fs');
// Import the module under test
const { statusMiddleware } = await import('../../status-middleware.js');
// Import test utilities
import { createMockProgress, createMockPauseLock, createMockApprovalLock, createMockConfigYaml, setupStandardTestFileSystem, DEFAULT_GITHUB_CONFIG, DEFAULT_BRANCH_CONFIG, } from '../helpers/command-test-utils.js';
describe('status-middleware', () => {
    let mockExit;
    let mockConsoleError;
    let mockConsoleLog;
    let originalCwd;
    const testCwd = '/test/project';
    const testChadgiDir = `${testCwd}/.chadgi`;
    const testConfigPath = `${testChadgiDir}/chadgi-config.yaml`;
    beforeEach(() => {
        // Reset virtual filesystem
        vol.reset();
        // Mock process.cwd
        originalCwd = process.cwd;
        process.cwd = jest.fn(() => testCwd);
        // Setup process and console mocks
        mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('process.exit called');
        });
        mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });
        mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => { });
    });
    afterEach(() => {
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
        mockConsoleLog.mockRestore();
        process.cwd = originalCwd;
        vol.reset();
    });
    describe('success cases', () => {
        it('should return idle status when no progress file exists', async () => {
            // Setup: only config exists, no progress
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('stopped');
        });
        it('should return running status when session is active', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
                currentTask: {
                    id: '42',
                    title: 'Add user authentication',
                    branch: 'feature/issue-42-add-user-authentication',
                },
                session: {
                    tasks_completed: 2,
                    total_cost_usd: 0.35,
                },
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('running');
            expect(output.currentTask).toBeDefined();
            expect(output.currentTask.id).toBe('42');
            expect(output.currentTask.title).toBe('Add user authentication');
            expect(output.session).toBeDefined();
            expect(output.session.tasksCompleted).toBe(2);
        });
        it('should return paused status when pause lock exists', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
                currentTask: {
                    id: '42',
                    title: 'Test task',
                },
            });
            const pauseLock = createMockPauseLock({
                reason: 'User requested pause',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress, pauseLock });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('paused');
            expect(output.pause).toBeDefined();
            expect(output.pause.reason).toBe('User requested pause');
        });
        it('should return awaiting_approval status when approval lock exists', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
                currentTask: {
                    id: '53',
                    title: 'Add dark mode',
                },
            });
            const approvalLock = createMockApprovalLock({
                issue_number: 53,
                issue_title: 'Add dark mode',
                phase: 'phase1',
                files_changed: 10,
                insertions: 200,
                deletions: 50,
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress, approvalLock });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('awaiting_approval');
            expect(output.pendingApproval).toBeDefined();
            expect(output.pendingApproval.issueNumber).toBe(53);
            expect(output.pendingApproval.phase).toBe('phase1');
            expect(output.pendingApproval.filesChanged).toBe(10);
        });
        it('should return stopped status when progress shows stopped', async () => {
            const progress = createMockProgress({
                status: 'stopped',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('stopped');
        });
        it('should return error status when progress shows error', async () => {
            const progress = createMockProgress({
                status: 'error',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('error');
        });
        it('should include session statistics when session exists', async () => {
            const sessionStart = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
            const progress = createMockProgress({
                status: 'in_progress',
                session: {
                    started_at: sessionStart,
                    tasks_completed: 5,
                    total_cost_usd: 1.25,
                },
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.session).toBeDefined();
            expect(output.session.tasksCompleted).toBe(5);
            expect(output.session.totalCostUsd).toBe(1.25);
            expect(output.session.elapsedSeconds).toBeGreaterThan(0);
        });
        it('should calculate elapsed time for current task', async () => {
            const taskStart = new Date(Date.now() - 300000).toISOString(); // 5 mins ago
            const progress = createMockProgress({
                status: 'in_progress',
                currentTask: {
                    id: '42',
                    title: 'Test task',
                    started_at: taskStart,
                },
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.currentTask.elapsedSeconds).toBeGreaterThanOrEqual(299);
        });
    });
    describe('formatted output (non-JSON)', () => {
        it('should display formatted status without errors', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
                currentTask: {
                    id: '42',
                    title: 'Add feature',
                },
                session: {
                    tasks_completed: 1,
                    total_cost_usd: 0.15,
                },
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: false });
            expect(mockConsoleLog).toHaveBeenCalled();
            // Verify header was printed
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('CHADGI STATUS');
            expect(allOutput).toContain('RUNNING');
        });
        it('should display paused status information', async () => {
            const pauseLock = createMockPauseLock({
                reason: 'Manual pause for review',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, pauseLock });
            await statusMiddleware({ json: false });
            expect(mockConsoleLog).toHaveBeenCalled();
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('PAUSED');
        });
        it('should display pending approval information', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
            });
            const approvalLock = createMockApprovalLock({
                issue_number: 99,
                issue_title: 'Big refactor',
                phase: 'pre_task',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress, approvalLock });
            await statusMiddleware({ json: false });
            expect(mockConsoleLog).toHaveBeenCalled();
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('PENDING APPROVAL');
            expect(allOutput).toContain('#99');
        });
        it('should display phase1 as Post-Implementation Review', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
            });
            const approvalLock = createMockApprovalLock({
                issue_number: 100,
                phase: 'phase1',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress, approvalLock });
            await statusMiddleware({ json: false });
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('Post-Implementation Review');
        });
        it('should display phase2 as Pre-PR Creation Review', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
            });
            const approvalLock = createMockApprovalLock({
                issue_number: 100,
                phase: 'phase2',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress, approvalLock });
            await statusMiddleware({ json: false });
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('Pre-PR Creation Review');
        });
        it('should display auto-resume time when in future', async () => {
            const resumeAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
            const pauseLock = createMockPauseLock({
                reason: 'Scheduled',
                resume_at: resumeAt,
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, pauseLock });
            await statusMiddleware({ json: false });
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('Auto-resume');
            expect(allOutput).toContain('(in ');
        });
        it('should suggest appropriate actions based on state', async () => {
            // Test idle state suggests starting
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir });
            await statusMiddleware({ json: false });
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('chadgi start');
        });
    });
    describe('error handling', () => {
        it('should exit with error when .chadgi directory does not exist', async () => {
            // Don't set up any files - directory won't exist
            try {
                await statusMiddleware({});
                fail('Expected to throw');
            }
            catch (e) {
                expect(e.message).toBe('process.exit called');
            }
            expect(mockExit).toHaveBeenCalledWith(1);
            expect(mockConsoleError).toHaveBeenCalled();
        });
        it('should output JSON error when directory missing and --json flag set', async () => {
            try {
                await statusMiddleware({ json: true });
                fail('Expected to throw');
            }
            catch (e) {
                expect(e.message).toBe('process.exit called');
            }
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.success).toBe(false);
            expect(output.error).toContain('.chadgi directory not found');
        });
    });
    describe('edge cases', () => {
        it('should handle progress file with minimal data', async () => {
            // Only status, no current_task or session
            const progress = {
                status: 'idle',
                last_updated: new Date().toISOString(),
            };
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('idle');
            expect(output.currentTask).toBeUndefined();
            expect(output.session).toBeUndefined();
        });
        it('should handle pause lock with resume_at in the future', async () => {
            const resumeAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
            const pauseLock = createMockPauseLock({
                reason: 'Scheduled maintenance',
                resume_at: resumeAt,
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, pauseLock });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('paused');
            expect(output.pause.resumeAt).toBe(resumeAt);
        });
        it('should handle pause lock with expired resume_at', async () => {
            const resumeAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
            const pauseLock = createMockPauseLock({
                reason: 'Scheduled maintenance',
                resume_at: resumeAt,
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, pauseLock });
            await statusMiddleware({ json: false });
            expect(mockConsoleLog).toHaveBeenCalled();
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('expired');
        });
        it('should handle awaiting_approval in progress status field', async () => {
            const progress = createMockProgress({
                status: 'awaiting_approval',
                currentTask: {
                    id: '42',
                    title: 'Test',
                },
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('awaiting_approval');
        });
        it('should use custom config path when --config option provided', async () => {
            // Create config at custom path
            const customPath = '/custom/path/.chadgi';
            vol.fromJSON({
                [`${customPath}/chadgi-config.yaml`]: createMockConfigYaml(DEFAULT_GITHUB_CONFIG, DEFAULT_BRANCH_CONFIG),
            });
            await statusMiddleware({
                config: `${customPath}/chadgi-config.yaml`,
                json: true,
            });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('stopped');
        });
        it('should handle progress with phase information', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
                currentTask: {
                    id: '42',
                    title: 'Test',
                },
                phase: 'implementation',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('running');
        });
        it('should handle malformed progress file gracefully', async () => {
            // Create files directly with invalid JSON in progress
            vol.fromJSON({
                [`${testChadgiDir}/chadgi-config.yaml`]: createMockConfigYaml(DEFAULT_GITHUB_CONFIG, DEFAULT_BRANCH_CONFIG),
                [`${testChadgiDir}/chadgi-progress.json`]: 'not valid json {{{',
            });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            // Should fall back to stopped state when progress can't be read
            expect(output.state).toBe('stopped');
        });
    });
    describe('state colors and emojis', () => {
        it('should display unknown state appropriately', async () => {
            const progress = createMockProgress({
                status: 'some_unknown_status',
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: false });
            expect(mockConsoleLog).toHaveBeenCalled();
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            // Should still render without errors
            expect(allOutput).toContain('CHADGI STATUS');
        });
        it('should display running status with no current task', async () => {
            // Progress in_progress but no current_task yet (searching)
            const progress = {
                status: 'in_progress',
                last_updated: new Date().toISOString(),
                // No current_task
            };
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: false });
            expect(mockConsoleLog).toHaveBeenCalled();
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('Searching for tasks');
        });
    });
    describe('task locks', () => {
        it('should display active task locks', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
                currentTask: {
                    id: '42',
                    title: 'Test',
                },
            });
            // Create lock files
            const lockData = {
                issue_number: 42,
                session_id: 'test-session',
                pid: 12345,
                hostname: 'test-host',
                locked_at: new Date(Date.now() - 60000).toISOString(),
                last_heartbeat: new Date().toISOString(),
            };
            vol.fromJSON({
                [`${testChadgiDir}/chadgi-config.yaml`]: createMockConfigYaml(DEFAULT_GITHUB_CONFIG, DEFAULT_BRANCH_CONFIG),
                [`${testChadgiDir}/chadgi-progress.json`]: JSON.stringify(progress, null, 2),
                [`${testChadgiDir}/locks/issue-42.lock`]: JSON.stringify(lockData, null, 2),
            });
            await statusMiddleware({ json: false });
            expect(mockConsoleLog).toHaveBeenCalled();
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('TASK LOCKS');
            expect(allOutput).toContain('Issue #42');
        });
        it('should display stale lock warning', async () => {
            const progress = createMockProgress({
                status: 'idle',
            });
            // Create stale lock (heartbeat > 120 minutes old)
            const lockData = {
                issue_number: 99,
                session_id: 'old-session',
                pid: 12345,
                hostname: 'test-host',
                locked_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
                last_heartbeat: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // stale (> 120 min)
            };
            vol.fromJSON({
                [`${testChadgiDir}/chadgi-config.yaml`]: createMockConfigYaml(DEFAULT_GITHUB_CONFIG, DEFAULT_BRANCH_CONFIG),
                [`${testChadgiDir}/chadgi-progress.json`]: JSON.stringify(progress, null, 2),
                [`${testChadgiDir}/locks/issue-99.lock`]: JSON.stringify(lockData, null, 2),
            });
            await statusMiddleware({ json: false });
            expect(mockConsoleLog).toHaveBeenCalled();
            const allOutput = mockConsoleLog.mock.calls.map((c) => c[0]).join('\n');
            expect(allOutput).toContain('stale');
        });
    });
    describe('JSON output format', () => {
        it('should return properly structured JSON for running status', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
                currentTask: {
                    id: '42',
                    title: 'Test task',
                    branch: 'feature/issue-42-test',
                    started_at: new Date(Date.now() - 60000).toISOString(),
                },
                session: {
                    started_at: new Date(Date.now() - 3600000).toISOString(),
                    tasks_completed: 3,
                    total_cost_usd: 0.75,
                },
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            // Verify structure
            expect(output).toHaveProperty('state');
            expect(output).toHaveProperty('currentTask');
            expect(output).toHaveProperty('session');
            expect(output).toHaveProperty('lastUpdated');
            // Verify currentTask structure
            expect(output.currentTask).toHaveProperty('id');
            expect(output.currentTask).toHaveProperty('title');
            expect(output.currentTask).toHaveProperty('branch');
            expect(output.currentTask).toHaveProperty('startedAt');
            expect(output.currentTask).toHaveProperty('elapsedSeconds');
            // Verify session structure
            expect(output.session).toHaveProperty('startedAt');
            expect(output.session).toHaveProperty('tasksCompleted');
            expect(output.session).toHaveProperty('totalCostUsd');
            expect(output.session).toHaveProperty('elapsedSeconds');
        });
        it('should return properly structured JSON for paused status', async () => {
            const pauseLock = createMockPauseLock({
                paused_at: new Date(Date.now() - 600000).toISOString(),
                reason: 'Taking a break',
                resume_at: new Date(Date.now() + 600000).toISOString(),
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, pauseLock });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('paused');
            expect(output).toHaveProperty('pause');
            expect(output.pause).toHaveProperty('pausedAt');
            expect(output.pause).toHaveProperty('reason');
            expect(output.pause).toHaveProperty('resumeAt');
            expect(output.pause).toHaveProperty('pausedSeconds');
        });
        it('should return properly structured JSON for awaiting_approval status', async () => {
            const progress = createMockProgress({
                status: 'in_progress',
            });
            const approvalLock = createMockApprovalLock({
                issue_number: 99,
                issue_title: 'Big feature',
                phase: 'phase1',
                files_changed: 15,
                insertions: 300,
                deletions: 50,
                created_at: new Date(Date.now() - 120000).toISOString(),
            });
            setupStandardTestFileSystem(vol, { chadgiDir: testChadgiDir, progress, approvalLock });
            await statusMiddleware({ json: true });
            expect(mockConsoleLog).toHaveBeenCalled();
            const output = JSON.parse(mockConsoleLog.mock.calls[0][0]);
            expect(output.state).toBe('awaiting_approval');
            expect(output).toHaveProperty('pendingApproval');
            expect(output.pendingApproval).toHaveProperty('phase');
            expect(output.pendingApproval).toHaveProperty('issueNumber');
            expect(output.pendingApproval).toHaveProperty('issueTitle');
            expect(output.pendingApproval).toHaveProperty('createdAt');
            expect(output.pendingApproval).toHaveProperty('filesChanged');
            expect(output.pendingApproval).toHaveProperty('insertions');
            expect(output.pendingApproval).toHaveProperty('deletions');
            expect(output.pendingApproval).toHaveProperty('waitingSeconds');
        });
    });
});
//# sourceMappingURL=status.test.js.map