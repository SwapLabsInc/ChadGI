/**
 * Unit tests for src/utils/data-schema.ts
 *
 * Tests JSON schema validation and bounds checking for persisted data structures.
 */
import { jest } from '@jest/globals';
// Track isVerbose state
let isVerboseState = false;
// Mock the debug module
jest.unstable_mockModule('../../utils/debug.js', () => ({
    isVerbose: jest.fn(() => isVerboseState),
}));
// Import after mocking
const { validateSchema, validateArray, getSchema, DATA_BOUNDS, SESSION_STATS_SCHEMA, TASK_METRICS_SCHEMA, METRICS_DATA_SCHEMA, TASK_LOCK_DATA_SCHEMA, PROGRESS_DATA_SCHEMA, PAUSE_LOCK_DATA_SCHEMA, APPROVAL_LOCK_DATA_SCHEMA, } = await import('../../utils/data-schema.js');
describe('data-schema utilities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        isVerboseState = false;
    });
    // Capture stderr output for verbose mode tests
    let stderrOutput;
    let originalWrite;
    beforeEach(() => {
        stderrOutput = '';
        originalWrite = process.stderr.write;
        process.stderr.write = ((chunk) => {
            stderrOutput += chunk;
            return true;
        });
    });
    afterEach(() => {
        process.stderr.write = originalWrite;
    });
    describe('DATA_BOUNDS', () => {
        it('should have reasonable bounds for costs', () => {
            expect(DATA_BOUNDS.maxCostUsd).toBe(1000);
        });
        it('should have reasonable bounds for durations', () => {
            // 1 week in seconds
            expect(DATA_BOUNDS.maxDurationSecs).toBe(7 * 24 * 60 * 60);
        });
        it('should have reasonable bounds for task counts', () => {
            expect(DATA_BOUNDS.maxTasks).toBe(10000);
            expect(DATA_BOUNDS.maxIterations).toBe(100);
        });
    });
    describe('validateSchema', () => {
        describe('type validation', () => {
            it('should reject non-object data', () => {
                const result = validateSchema('not an object', SESSION_STATS_SCHEMA);
                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.errors[0].message).toContain('Expected object');
            });
            it('should reject null data', () => {
                const result = validateSchema(null, SESSION_STATS_SCHEMA);
                expect(result.valid).toBe(false);
            });
            it('should reject arrays when expecting object', () => {
                const result = validateSchema([], SESSION_STATS_SCHEMA);
                expect(result.valid).toBe(false);
            });
            it('should validate field types', () => {
                const data = {
                    session_id: 123, // Should be string
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
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
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.path === 'session_id')).toBe(true);
            });
        });
        describe('required field validation', () => {
            it('should fail when required fields are missing', () => {
                const data = {
                    session_id: 'test-session',
                    // Missing required fields
                };
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.message.includes('Required field'))).toBe(true);
            });
            it('should allow optional fields to be missing', () => {
                const data = {
                    issue_number: 42,
                    session_id: 'session-123',
                    pid: 1234,
                    hostname: 'test-host',
                    locked_at: '2026-01-15T10:00:00Z',
                    last_heartbeat: '2026-01-15T10:05:00Z',
                    // worker_id and repo_name are optional
                };
                const result = validateSchema(data, TASK_LOCK_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
        });
        describe('numeric bounds validation', () => {
            it('should reject negative values when min is 0', () => {
                const data = {
                    session_id: 'test',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    duration_secs: -100, // Invalid: negative
                    tasks_attempted: 1,
                    tasks_completed: 1,
                    successful_tasks: [],
                    failed_tasks: [],
                    total_cost_usd: 0.1,
                    gigachad_mode: false,
                    gigachad_merges: 0,
                    repo: 'test/repo',
                };
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.path === 'duration_secs')).toBe(true);
            });
            it('should reject values exceeding maximum', () => {
                const data = {
                    session_id: 'test',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    duration_secs: 999999999999, // Exceeds max
                    tasks_attempted: 1,
                    tasks_completed: 1,
                    successful_tasks: [],
                    failed_tasks: [],
                    total_cost_usd: 0.1,
                    gigachad_mode: false,
                    gigachad_merges: 0,
                    repo: 'test/repo',
                };
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
            });
            it('should reject non-integers when integer is required', () => {
                const data = {
                    session_id: 'test',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    duration_secs: 7200.5, // Should be integer
                    tasks_attempted: 1,
                    tasks_completed: 1,
                    successful_tasks: [],
                    failed_tasks: [],
                    total_cost_usd: 0.1,
                    gigachad_mode: false,
                    gigachad_merges: 0,
                    repo: 'test/repo',
                };
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
            });
            it('should allow floats for non-integer fields', () => {
                const data = {
                    session_id: 'test',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    duration_secs: 7200,
                    tasks_attempted: 1,
                    tasks_completed: 1,
                    successful_tasks: [],
                    failed_tasks: [],
                    total_cost_usd: 0.1234, // Float is OK for cost
                    gigachad_mode: false,
                    gigachad_merges: 0,
                    repo: 'test/repo',
                };
                const result = validateSchema(data, SESSION_STATS_SCHEMA);
                expect(result.valid).toBe(true);
            });
        });
        describe('string validation', () => {
            it('should validate string length constraints', () => {
                const data = {
                    session_id: '', // Empty string - below minLength
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
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
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.path === 'session_id')).toBe(true);
            });
            it('should validate timestamp patterns', () => {
                const data = {
                    session_id: 'test',
                    started_at: 'not-a-timestamp',
                    ended_at: '2026-01-15T12:00:00Z',
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
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.path === 'started_at')).toBe(true);
            });
            it('should validate enum values', () => {
                const data = {
                    status: 'invalid_status', // Not in enum
                    created_at: '2026-01-15T10:00:00Z',
                    issue_number: 42,
                    phase: 'phase1',
                };
                const result = validateSchema(data, APPROVAL_LOCK_DATA_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.path === 'status')).toBe(true);
            });
            it('should accept valid enum values', () => {
                const data = {
                    status: 'pending',
                    created_at: '2026-01-15T10:00:00Z',
                    issue_number: 42,
                    phase: 'phase1',
                };
                const result = validateSchema(data, APPROVAL_LOCK_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
        });
        describe('recovery mechanism', () => {
            it('should recover missing fields with defaults', () => {
                const data = {
                    session_id: 'test',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    // duration_secs is missing but has default
                    tasks_attempted: 1,
                    tasks_completed: 1,
                    successful_tasks: [],
                    failed_tasks: [],
                    total_cost_usd: 0.1,
                    gigachad_mode: false,
                    gigachad_merges: 0,
                    repo: 'test/repo',
                };
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: true });
                expect(result.valid).toBe(true);
                expect(result.hasRecoveries).toBe(true);
                expect(result.data?.duration_secs).toBe(0); // Default value
            });
            it('should recover out-of-bounds values with defaults', () => {
                const data = {
                    session_id: 'test',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    duration_secs: -100, // Invalid - will be recovered
                    tasks_attempted: 1,
                    tasks_completed: 1,
                    successful_tasks: [],
                    failed_tasks: [],
                    total_cost_usd: 0.1,
                    gigachad_mode: false,
                    gigachad_merges: 0,
                    repo: 'test/repo',
                };
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: true });
                expect(result.valid).toBe(true);
                expect(result.hasRecoveries).toBe(true);
                expect(result.data?.duration_secs).toBe(0); // Recovered to default
            });
            it('should not recover fields without defaults', () => {
                const data = {
                    session_id: 123, // Wrong type, no default for session_id
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
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
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: true });
                // Can't recover session_id because it's required and has no default
                expect(result.valid).toBe(false);
            });
            it('should mark errors as recovered when using defaults', () => {
                const data = {
                    session_id: 'test',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    duration_secs: -100, // Will be recovered
                    tasks_attempted: 1,
                    tasks_completed: 1,
                    successful_tasks: [],
                    failed_tasks: [],
                    total_cost_usd: 0.1,
                    gigachad_mode: false,
                    gigachad_merges: 0,
                    repo: 'test/repo',
                };
                const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: true });
                const recoveredErrors = result.errors.filter(e => e.recovered);
                expect(recoveredErrors.length).toBeGreaterThan(0);
            });
        });
        describe('verbose mode', () => {
            it('should log validation errors in verbose mode', () => {
                isVerboseState = true;
                const data = {
                    session_id: 123, // Wrong type
                };
                validateSchema(data, SESSION_STATS_SCHEMA, { filePath: '/test/stats.json' });
                expect(stderrOutput).toContain('[DEBUG]');
                expect(stderrOutput).toContain('Schema validation errors');
            });
            it('should log recovery info in verbose mode', () => {
                isVerboseState = true;
                const data = {
                    session_id: 'test',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    duration_secs: -100, // Will be recovered
                    tasks_attempted: 1,
                    tasks_completed: 1,
                    successful_tasks: [],
                    failed_tasks: [],
                    total_cost_usd: 0.1,
                    gigachad_mode: false,
                    gigachad_merges: 0,
                    repo: 'test/repo',
                };
                validateSchema(data, SESSION_STATS_SCHEMA, { recover: true });
                expect(stderrOutput).toContain('Recovered');
            });
        });
    });
    describe('validateArray', () => {
        it('should validate each item in array', () => {
            const items = [
                {
                    issue_number: 42,
                    started_at: '2026-01-15T10:00:00Z',
                    duration_secs: 300,
                    status: 'completed',
                    iterations: 1,
                    cost_usd: 0.1,
                },
                {
                    issue_number: 43,
                    started_at: '2026-01-15T11:00:00Z',
                    duration_secs: 600,
                    status: 'failed',
                    iterations: 2,
                    cost_usd: 0.2,
                },
            ];
            const result = validateArray(items, TASK_METRICS_SCHEMA);
            expect(result.valid).toBe(true);
            expect(result.data).toHaveLength(2);
        });
        it('should filter out invalid items when recovering', () => {
            const items = [
                {
                    issue_number: 42,
                    started_at: '2026-01-15T10:00:00Z',
                    duration_secs: 300,
                    status: 'completed',
                    iterations: 1,
                    cost_usd: 0.1,
                },
                {
                    issue_number: 'not-a-number', // Invalid
                    started_at: '2026-01-15T11:00:00Z',
                    duration_secs: 600,
                    status: 'invalid', // Also invalid
                    iterations: 2,
                    cost_usd: 0.2,
                },
            ];
            const result = validateArray(items, TASK_METRICS_SCHEMA, { recover: true });
            expect(result.data).toHaveLength(1);
            expect(result.data[0].issue_number).toBe(42);
        });
        it('should reject non-array input', () => {
            const result = validateArray('not an array', TASK_METRICS_SCHEMA);
            expect(result.valid).toBe(false);
            expect(result.data).toEqual([]);
        });
        it('should return empty array for empty input', () => {
            const result = validateArray([], TASK_METRICS_SCHEMA);
            expect(result.valid).toBe(true);
            expect(result.data).toEqual([]);
        });
        it('should add item index to error paths', () => {
            const items = [
                { issue_number: 'invalid' },
            ];
            const result = validateArray(items, TASK_METRICS_SCHEMA, { recover: false });
            expect(result.errors.some(e => e.path.includes('[0]'))).toBe(true);
        });
    });
    describe('getSchema', () => {
        it('should return schema by name', () => {
            expect(getSchema('SessionStats')).toBe(SESSION_STATS_SCHEMA);
            expect(getSchema('TaskMetrics')).toBe(TASK_METRICS_SCHEMA);
            expect(getSchema('TaskLockData')).toBe(TASK_LOCK_DATA_SCHEMA);
            expect(getSchema('ProgressData')).toBe(PROGRESS_DATA_SCHEMA);
        });
        it('should return undefined for unknown schema', () => {
            expect(getSchema('UnknownSchema')).toBeUndefined();
        });
    });
    describe('specific schemas', () => {
        describe('SESSION_STATS_SCHEMA', () => {
            it('should validate a complete valid session', () => {
                const session = {
                    session_id: 'session-001',
                    started_at: '2026-01-15T10:00:00Z',
                    ended_at: '2026-01-15T12:00:00Z',
                    duration_secs: 7200,
                    tasks_attempted: 5,
                    tasks_completed: 4,
                    successful_tasks: [{ issue: 42 }, { issue: 43 }],
                    failed_tasks: [{ issue: 44, reason: 'timeout' }],
                    total_cost_usd: 1.23,
                    gigachad_mode: true,
                    gigachad_merges: 3,
                    repo: 'owner/repo',
                };
                const result = validateSchema(session, SESSION_STATS_SCHEMA);
                expect(result.valid).toBe(true);
            });
        });
        describe('TASK_METRICS_SCHEMA', () => {
            it('should validate task metrics with all fields', () => {
                const metrics = {
                    issue_number: 42,
                    started_at: '2026-01-15T10:00:00Z',
                    completed_at: '2026-01-15T10:30:00Z',
                    duration_secs: 1800,
                    status: 'completed',
                    iterations: 3,
                    cost_usd: 0.45,
                    category: 'feature',
                    retry_count: 1,
                    phases: { phase1_time_secs: 900 },
                    tokens: { total_tokens: 5000 },
                };
                const result = validateSchema(metrics, TASK_METRICS_SCHEMA);
                expect(result.valid).toBe(true);
            });
            it('should reject invalid status enum', () => {
                const metrics = {
                    issue_number: 42,
                    started_at: '2026-01-15T10:00:00Z',
                    duration_secs: 1800,
                    status: 'pending', // Not valid for TaskMetrics
                    iterations: 1,
                    cost_usd: 0.1,
                };
                const result = validateSchema(metrics, TASK_METRICS_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
            });
        });
        describe('TASK_LOCK_DATA_SCHEMA', () => {
            it('should validate lock data with optional fields', () => {
                const lock = {
                    issue_number: 42,
                    session_id: 'session-xyz',
                    pid: 12345,
                    hostname: 'dev-machine',
                    locked_at: '2026-01-15T10:00:00Z',
                    last_heartbeat: '2026-01-15T10:30:00Z',
                    worker_id: 2,
                    repo_name: 'my-repo',
                };
                const result = validateSchema(lock, TASK_LOCK_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
            it('should reject lock with invalid PID', () => {
                const lock = {
                    issue_number: 42,
                    session_id: 'session-xyz',
                    pid: 0, // Invalid - must be >= 1
                    hostname: 'dev-machine',
                    locked_at: '2026-01-15T10:00:00Z',
                    last_heartbeat: '2026-01-15T10:30:00Z',
                };
                const result = validateSchema(lock, TASK_LOCK_DATA_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
            });
        });
        describe('PROGRESS_DATA_SCHEMA', () => {
            it('should validate minimal progress data', () => {
                const progress = {
                    status: 'idle',
                    last_updated: '2026-01-15T10:00:00Z',
                };
                const result = validateSchema(progress, PROGRESS_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
            it('should validate progress with current task', () => {
                const progress = {
                    status: 'in_progress',
                    current_task: {
                        id: '42',
                        title: 'Add feature',
                        branch: 'feature/issue-42',
                        started_at: '2026-01-15T10:00:00Z',
                    },
                    last_updated: '2026-01-15T10:30:00Z',
                };
                const result = validateSchema(progress, PROGRESS_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
            it('should validate progress with iteration', () => {
                const progress = {
                    status: 'in_progress',
                    iteration: {
                        current: 2,
                        max: 5,
                    },
                    last_updated: '2026-01-15T10:00:00Z',
                };
                const result = validateSchema(progress, PROGRESS_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
            it('should reject invalid iteration bounds', () => {
                const progress = {
                    status: 'in_progress',
                    iteration: {
                        current: -1, // Invalid
                        max: 5,
                    },
                    last_updated: '2026-01-15T10:00:00Z',
                };
                const result = validateSchema(progress, PROGRESS_DATA_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
            });
        });
        describe('PAUSE_LOCK_DATA_SCHEMA', () => {
            it('should validate pause lock with reason', () => {
                const pause = {
                    paused_at: '2026-01-15T10:00:00Z',
                    reason: 'User requested pause',
                    resume_at: '2026-01-15T11:00:00Z',
                };
                const result = validateSchema(pause, PAUSE_LOCK_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
            it('should validate minimal pause lock', () => {
                const pause = {
                    paused_at: '2026-01-15T10:00:00Z',
                };
                const result = validateSchema(pause, PAUSE_LOCK_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
        });
        describe('APPROVAL_LOCK_DATA_SCHEMA', () => {
            it('should validate complete approval lock', () => {
                const approval = {
                    status: 'pending',
                    created_at: '2026-01-15T10:00:00Z',
                    issue_number: 42,
                    issue_title: 'Add feature',
                    branch: 'feature/issue-42',
                    phase: 'phase1',
                    files_changed: 5,
                    insertions: 100,
                    deletions: 20,
                };
                const result = validateSchema(approval, APPROVAL_LOCK_DATA_SCHEMA);
                expect(result.valid).toBe(true);
            });
            it('should reject invalid phase enum', () => {
                const approval = {
                    status: 'pending',
                    created_at: '2026-01-15T10:00:00Z',
                    issue_number: 42,
                    phase: 'invalid_phase',
                };
                const result = validateSchema(approval, APPROVAL_LOCK_DATA_SCHEMA, { recover: false });
                expect(result.valid).toBe(false);
            });
        });
    });
    describe('edge cases', () => {
        it('should handle null field values', () => {
            const data = {
                session_id: 'test',
                started_at: null, // Invalid
                ended_at: '2026-01-15T12:00:00Z',
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
            const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
            expect(result.valid).toBe(false);
        });
        it('should handle undefined field values', () => {
            const data = {
                session_id: 'test',
                started_at: undefined, // Missing
                ended_at: '2026-01-15T12:00:00Z',
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
            const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: false });
            expect(result.valid).toBe(false);
        });
        it('should handle very large numbers within bounds', () => {
            const data = {
                session_id: 'test',
                started_at: '2026-01-15T10:00:00Z',
                ended_at: '2026-01-15T12:00:00Z',
                duration_secs: DATA_BOUNDS.maxDurationSecs, // Max allowed
                tasks_attempted: 1,
                tasks_completed: 1,
                successful_tasks: [],
                failed_tasks: [],
                total_cost_usd: 0.1,
                gigachad_mode: false,
                gigachad_merges: 0,
                repo: 'test/repo',
            };
            const result = validateSchema(data, SESSION_STATS_SCHEMA);
            expect(result.valid).toBe(true);
        });
        it('should handle additional properties when allowed', () => {
            const data = {
                session_id: 'test',
                started_at: '2026-01-15T10:00:00Z',
                ended_at: '2026-01-15T12:00:00Z',
                duration_secs: 7200,
                tasks_attempted: 1,
                tasks_completed: 1,
                successful_tasks: [],
                failed_tasks: [],
                total_cost_usd: 0.1,
                gigachad_mode: false,
                gigachad_merges: 0,
                repo: 'test/repo',
                extra_field: 'should be allowed',
            };
            const result = validateSchema(data, SESSION_STATS_SCHEMA);
            expect(result.valid).toBe(true);
            expect(result.data?.extra_field).toBe('should be allowed');
        });
        it('should preserve valid fields when some are invalid', () => {
            const data = {
                session_id: 'test',
                started_at: '2026-01-15T10:00:00Z',
                ended_at: '2026-01-15T12:00:00Z',
                duration_secs: -100, // Invalid, will be recovered
                tasks_attempted: 1,
                tasks_completed: 1,
                successful_tasks: [],
                failed_tasks: [],
                total_cost_usd: 0.1,
                gigachad_mode: false,
                gigachad_merges: 0,
                repo: 'test/repo',
            };
            const result = validateSchema(data, SESSION_STATS_SCHEMA, { recover: true });
            expect(result.data?.session_id).toBe('test');
            expect(result.data?.tasks_attempted).toBe(1);
        });
    });
});
//# sourceMappingURL=data-schema.test.js.map