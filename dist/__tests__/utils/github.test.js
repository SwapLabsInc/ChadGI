/**
 * Unit tests for src/utils/github.ts
 *
 * Tests GitHub CLI wrapper functions, retry logic, error classification,
 * and exponential backoff with jitter.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Mock child_process before importing the module
const mockExecSync = jest.fn();
jest.unstable_mockModule('child_process', () => ({
    execSync: mockExecSync,
}));
// Import the module under test
const { RETRY_DEFAULTS, sleep, calculateBackoffDelay, classifyError, isRecoverableError, execGh, execGhJson, safeExecGh, safeExecGhJson, execGhWithRetry, execGhJsonWithRetry, safeExecGhWithRetry, safeExecGhJsonWithRetry, } = await import('../../utils/github.js');
describe('RETRY_DEFAULTS', () => {
    it('should have expected default values', () => {
        expect(RETRY_DEFAULTS.maxAttempts).toBe(3);
        expect(RETRY_DEFAULTS.baseDelayMs).toBe(1000);
        expect(RETRY_DEFAULTS.maxDelayMs).toBe(30000);
        expect(RETRY_DEFAULTS.jitterMs).toBe(500);
    });
});
describe('sleep', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should resolve after the specified duration', async () => {
        const promise = sleep(1000);
        jest.advanceTimersByTime(1000);
        await expect(promise).resolves.toBeUndefined();
    });
    it('should not resolve before the duration', async () => {
        let resolved = false;
        sleep(1000).then(() => { resolved = true; });
        jest.advanceTimersByTime(999);
        await Promise.resolve(); // Allow microtasks to run
        expect(resolved).toBe(false);
    });
});
describe('calculateBackoffDelay', () => {
    it('should return base delay for first attempt', () => {
        // With 0 jitter
        const delay = calculateBackoffDelay(1, 1000, 30000, 0);
        expect(delay).toBe(1000);
    });
    it('should double delay for each subsequent attempt', () => {
        // Without jitter for predictable testing
        const delay1 = calculateBackoffDelay(1, 1000, 30000, 0);
        const delay2 = calculateBackoffDelay(2, 1000, 30000, 0);
        const delay3 = calculateBackoffDelay(3, 1000, 30000, 0);
        expect(delay1).toBe(1000); // 1000 * 2^0 = 1000
        expect(delay2).toBe(2000); // 1000 * 2^1 = 2000
        expect(delay3).toBe(4000); // 1000 * 2^2 = 4000
    });
    it('should cap at maxDelayMs', () => {
        // 1000 * 2^5 = 32000, but max is 30000
        const delay = calculateBackoffDelay(6, 1000, 30000, 0);
        expect(delay).toBe(30000);
    });
    it('should add jitter within bounds', () => {
        // Run multiple times to verify jitter is applied
        const delays = Array.from({ length: 100 }, () => calculateBackoffDelay(1, 1000, 30000, 500));
        // All delays should be between base delay and base delay + max jitter
        expect(delays.every(d => d >= 1000 && d < 1500)).toBe(true);
        // At least some variation should exist (not all exactly 1000)
        expect(new Set(delays).size).toBeGreaterThan(1);
    });
    it('should use default values when not provided', () => {
        const delay = calculateBackoffDelay(1);
        expect(delay).toBeGreaterThanOrEqual(RETRY_DEFAULTS.baseDelayMs);
        expect(delay).toBeLessThanOrEqual(RETRY_DEFAULTS.baseDelayMs + RETRY_DEFAULTS.jitterMs);
    });
});
describe('classifyError', () => {
    describe('rate limit errors (recoverable)', () => {
        it('should classify "rate limit" errors as recoverable', () => {
            const result = classifyError(new Error('API rate limit exceeded'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('rate_limit');
        });
        it('should classify "too many requests" as recoverable', () => {
            const result = classifyError(new Error('too many requests'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('rate_limit');
        });
        it('should extract retry-after value', () => {
            const result = classifyError(new Error('rate limit exceeded, retry-after: 60'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('rate_limit');
            expect(result.retryAfterMs).toBe(60000);
        });
        it('should handle retry after with different formats', () => {
            const result = classifyError(new Error('Rate limit hit. Retry after 30 seconds'));
            expect(result.retryAfterMs).toBe(30000);
        });
    });
    describe('server errors (recoverable)', () => {
        it('should classify 502 as recoverable server error', () => {
            const result = classifyError(new Error('HTTP 502 Bad Gateway'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('server_error');
        });
        it('should classify 503 as recoverable server error', () => {
            const result = classifyError(new Error('HTTP 503 Service Unavailable'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('server_error');
        });
        it('should classify 504 as recoverable server error', () => {
            const result = classifyError(new Error('HTTP 504 Gateway Timeout'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('server_error');
        });
        it('should classify "bad gateway" as recoverable', () => {
            const result = classifyError(new Error('bad gateway'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('server_error');
        });
        it('should classify "service unavailable" as recoverable', () => {
            const result = classifyError(new Error('service unavailable'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('server_error');
        });
    });
    describe('network errors (recoverable)', () => {
        it('should classify ETIMEDOUT as recoverable', () => {
            const result = classifyError(new Error('connect ETIMEDOUT'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('network_error');
        });
        it('should classify ECONNRESET as recoverable', () => {
            const result = classifyError(new Error('read ECONNRESET'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('network_error');
        });
        it('should classify ECONNREFUSED as recoverable', () => {
            const result = classifyError(new Error('connect ECONNREFUSED'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('network_error');
        });
        it('should classify ENOTFOUND as recoverable', () => {
            const result = classifyError(new Error('getaddrinfo ENOTFOUND api.github.com'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('network_error');
        });
        it('should classify "socket hang up" as recoverable', () => {
            const result = classifyError(new Error('socket hang up'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('network_error');
        });
        it('should classify timeout as recoverable', () => {
            const result = classifyError(new Error('Request timeout'));
            expect(result.recoverable).toBe(true);
            expect(result.type).toBe('network_error');
        });
    });
    describe('auth errors (non-recoverable)', () => {
        it('should classify 401 as non-recoverable auth error', () => {
            const result = classifyError(new Error('HTTP 401 Unauthorized'));
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('auth_error');
        });
        it('should classify 403 as non-recoverable auth error', () => {
            const result = classifyError(new Error('HTTP 403 Forbidden'));
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('auth_error');
        });
        it('should classify "bad credentials" as auth error', () => {
            const result = classifyError(new Error('Bad credentials'));
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('auth_error');
        });
    });
    describe('not found errors (non-recoverable)', () => {
        it('should classify 404 as non-recoverable not found', () => {
            const result = classifyError(new Error('HTTP 404 Not Found'));
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('not_found');
        });
        it('should classify "not found" as non-recoverable', () => {
            const result = classifyError(new Error('Resource not found'));
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('not_found');
        });
    });
    describe('validation errors (non-recoverable)', () => {
        it('should classify 422 as non-recoverable validation error', () => {
            const result = classifyError(new Error('HTTP 422 Unprocessable Entity'));
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('validation');
        });
        it('should classify "validation failed" as validation error', () => {
            const result = classifyError(new Error('Validation failed'));
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('validation');
        });
    });
    describe('unknown errors', () => {
        it('should classify unknown errors as non-recoverable', () => {
            const result = classifyError(new Error('Something went wrong'));
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('unknown');
        });
        it('should handle non-Error objects', () => {
            const result = classifyError('string error');
            expect(result.recoverable).toBe(false);
            expect(result.type).toBe('unknown');
        });
    });
});
describe('isRecoverableError', () => {
    it('should return true for recoverable errors', () => {
        expect(isRecoverableError(new Error('rate limit'))).toBe(true);
        expect(isRecoverableError(new Error('HTTP 502'))).toBe(true);
        expect(isRecoverableError(new Error('ETIMEDOUT'))).toBe(true);
    });
    it('should return false for non-recoverable errors', () => {
        expect(isRecoverableError(new Error('HTTP 401'))).toBe(false);
        expect(isRecoverableError(new Error('HTTP 404'))).toBe(false);
        expect(isRecoverableError(new Error('HTTP 422'))).toBe(false);
    });
});
describe('execGh', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should execute gh command and return output', () => {
        mockExecSync.mockReturnValue('output');
        const result = execGh('issue list');
        expect(result).toBe('output');
        expect(mockExecSync).toHaveBeenCalledWith('gh issue list', expect.objectContaining({
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }));
    });
    it('should use custom timeout', () => {
        mockExecSync.mockReturnValue('output');
        execGh('issue list', { timeout: 5000 });
        expect(mockExecSync).toHaveBeenCalledWith('gh issue list', expect.objectContaining({ timeout: 5000 }));
    });
    it('should throw on error', () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('Command failed');
        });
        expect(() => execGh('issue list')).toThrow('Command failed');
    });
});
describe('execGhJson', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should parse JSON output', () => {
        mockExecSync.mockReturnValue('{"number": 1, "title": "test"}');
        const result = execGhJson('issue view 1 --json number,title');
        expect(result).toEqual({ number: 1, title: 'test' });
    });
    it('should throw on invalid JSON', () => {
        mockExecSync.mockReturnValue('not json');
        expect(() => execGhJson('issue list')).toThrow();
    });
});
describe('safeExecGh', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should return output on success', () => {
        mockExecSync.mockReturnValue('output');
        const result = safeExecGh('issue list');
        expect(result).toBe('output');
    });
    it('should return null on error', () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('Command failed');
        });
        const result = safeExecGh('issue list');
        expect(result).toBeNull();
    });
});
describe('safeExecGhJson', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should return parsed JSON on success', () => {
        mockExecSync.mockReturnValue('{"number": 1}');
        const result = safeExecGhJson('issue view 1');
        expect(result).toEqual({ number: 1 });
    });
    it('should return null on error', () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('Command failed');
        });
        const result = safeExecGhJson('issue list');
        expect(result).toBeNull();
    });
});
describe('execGhWithRetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should return output on first success', async () => {
        mockExecSync.mockReturnValue('output');
        const promise = execGhWithRetry('issue list', { maxAttempts: 3, silent: true });
        const result = await promise;
        expect(result).toBe('output');
        expect(mockExecSync).toHaveBeenCalledTimes(1);
    });
    it('should retry on recoverable error and succeed', async () => {
        let callCount = 0;
        mockExecSync.mockImplementation(() => {
            callCount++;
            if (callCount < 2) {
                throw new Error('HTTP 502 Bad Gateway');
            }
            return 'output';
        });
        const promise = execGhWithRetry('issue list', { maxAttempts: 3, baseDelayMs: 100, jitterMs: 0, silent: true });
        // First call fails, advance timers to trigger retry
        await jest.advanceTimersByTimeAsync(200);
        const result = await promise;
        expect(result).toBe('output');
        expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
    it('should throw immediately on non-recoverable error', async () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('HTTP 404 Not Found');
        });
        await expect(execGhWithRetry('issue list', { maxAttempts: 3, silent: true })).rejects.toThrow('HTTP 404 Not Found');
        expect(mockExecSync).toHaveBeenCalledTimes(1);
    });
    it('should throw after max attempts exhausted', async () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('HTTP 502 Bad Gateway');
        });
        let thrownError;
        const promise = execGhWithRetry('issue list', {
            maxAttempts: 2,
            baseDelayMs: 100,
            jitterMs: 0,
            silent: true
        }).catch((err) => {
            thrownError = err;
        });
        // Advance timers to allow retry to complete
        // First attempt fails immediately, then waits 100ms, second attempt fails
        await jest.advanceTimersByTimeAsync(150);
        await promise;
        expect(thrownError).toBeDefined();
        expect(thrownError.message).toBe('HTTP 502 Bad Gateway');
        expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
    it('should call onRetry callback', async () => {
        let callCount = 0;
        mockExecSync.mockImplementation(() => {
            callCount++;
            if (callCount < 2) {
                throw new Error('rate limit exceeded');
            }
            return 'output';
        });
        const onRetry = jest.fn();
        const promise = execGhWithRetry('issue list', {
            maxAttempts: 3,
            baseDelayMs: 100,
            jitterMs: 0,
            onRetry
        });
        await jest.advanceTimersByTimeAsync(200);
        await promise;
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(1, 3, expect.any(Error), expect.any(Number));
    });
    it('should use retry-after value for rate limits', async () => {
        let callCount = 0;
        mockExecSync.mockImplementation(() => {
            callCount++;
            if (callCount < 2) {
                throw new Error('rate limit exceeded, retry-after: 5');
            }
            return 'output';
        });
        const onRetry = jest.fn();
        const promise = execGhWithRetry('issue list', {
            maxAttempts: 3,
            baseDelayMs: 100,
            onRetry
        });
        // Should wait for 5 seconds (retry-after value)
        await jest.advanceTimersByTimeAsync(5000);
        await promise;
        expect(onRetry).toHaveBeenCalledWith(1, 3, expect.any(Error), 5000 // Should use retry-after value
        );
    });
});
describe('execGhJsonWithRetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should return parsed JSON on success', async () => {
        mockExecSync.mockReturnValue('{"number": 1}');
        const result = await execGhJsonWithRetry('issue view 1', { silent: true });
        expect(result).toEqual({ number: 1 });
    });
    it('should retry and parse JSON on eventual success', async () => {
        let callCount = 0;
        mockExecSync.mockImplementation(() => {
            callCount++;
            if (callCount < 2) {
                throw new Error('HTTP 503');
            }
            return '{"success": true}';
        });
        const promise = execGhJsonWithRetry('issue list', {
            maxAttempts: 3,
            baseDelayMs: 100,
            jitterMs: 0,
            silent: true
        });
        await jest.advanceTimersByTimeAsync(200);
        const result = await promise;
        expect(result).toEqual({ success: true });
    });
});
describe('safeExecGhWithRetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should return output on success', async () => {
        mockExecSync.mockReturnValue('output');
        const result = await safeExecGhWithRetry('issue list', { silent: true });
        expect(result).toBe('output');
    });
    it('should return null after all retries exhausted', async () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('HTTP 502');
        });
        const promise = safeExecGhWithRetry('issue list', {
            maxAttempts: 2,
            baseDelayMs: 100,
            jitterMs: 0,
            silent: true
        });
        // Advance through all retries (100ms for first retry)
        await jest.advanceTimersByTimeAsync(200);
        const result = await promise;
        expect(result).toBeNull();
    });
    it('should return null for non-recoverable errors', async () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('HTTP 404 Not Found');
        });
        const result = await safeExecGhWithRetry('issue list', { silent: true });
        expect(result).toBeNull();
        expect(mockExecSync).toHaveBeenCalledTimes(1);
    });
});
describe('safeExecGhJsonWithRetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should return parsed JSON on success', async () => {
        mockExecSync.mockReturnValue('{"data": "test"}');
        const result = await safeExecGhJsonWithRetry('issue view 1', { silent: true });
        expect(result).toEqual({ data: 'test' });
    });
    it('should return null on failure', async () => {
        mockExecSync.mockImplementation(() => {
            throw new Error('HTTP 401');
        });
        const result = await safeExecGhJsonWithRetry('issue list', { silent: true });
        expect(result).toBeNull();
    });
    it('should return null on JSON parse error', async () => {
        mockExecSync.mockReturnValue('not valid json');
        const result = await safeExecGhJsonWithRetry('issue list', { silent: true });
        expect(result).toBeNull();
    });
});
//# sourceMappingURL=github.test.js.map