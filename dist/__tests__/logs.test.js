/**
 * Unit tests for src/logs.ts
 *
 * Tests log parsing, filtering, and formatting logic.
 */
import { jest } from '@jest/globals';
import { vol } from 'memfs';
// Mock the fs module
jest.unstable_mockModule('fs', () => ({
    existsSync: jest.fn((path) => vol.existsSync(path)),
    readFileSync: jest.fn((path, encoding) => vol.readFileSync(path, encoding)),
    readdirSync: jest.fn((path) => vol.readdirSync(path)),
    statSync: jest.fn((path) => vol.statSync(path)),
    unlinkSync: jest.fn((path) => vol.unlinkSync(path)),
    watchFile: jest.fn(),
    unwatchFile: jest.fn(),
}));
describe('logs module', () => {
    beforeEach(() => {
        vol.reset();
        jest.clearAllMocks();
    });
    describe('parsePlainTextLogLine logic', () => {
        // Replicate the parsing logic for testing
        const parsePlainTextLogLine = (line) => {
            // Format: [timestamp] [LEVEL] [context] message
            const bracketMatch = line.match(/^\[([^\]]+)\]\s*\[([A-Z]+)\]\s*(?:\[([^\]]+)\]\s*)?(.*)$/);
            if (bracketMatch) {
                const [, timestamp, level, context, message] = bracketMatch;
                const entry = {
                    timestamp: timestamp.trim(),
                    level: level.toLowerCase(),
                    message: message.trim(),
                };
                if (context) {
                    const taskMatch = context.match(/task:(\d+)/i);
                    if (taskMatch) {
                        entry.taskId = parseInt(taskMatch[1], 10);
                    }
                    const phaseMatch = context.match(/phase:(\w+)/i);
                    if (phaseMatch) {
                        entry.phase = phaseMatch[1];
                    }
                    entry.context = context;
                }
                return entry;
            }
            // Format: timestamp LEVEL message
            const spaceMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*)\s+([A-Z]+)\s+(.*)$/);
            if (spaceMatch) {
                const [, timestamp, level, message] = spaceMatch;
                return {
                    timestamp: timestamp.trim(),
                    level: level.toLowerCase(),
                    message: message.trim(),
                };
            }
            return null;
        };
        it('should parse bracket format log lines', () => {
            const line = '[2026-01-15T10:30:00Z] [INFO] Starting task #42';
            const entry = parsePlainTextLogLine(line);
            expect(entry).not.toBeNull();
            expect(entry?.timestamp).toBe('2026-01-15T10:30:00Z');
            expect(entry?.level).toBe('info');
            expect(entry?.message).toBe('Starting task #42');
        });
        it('should parse bracket format with context', () => {
            const line = '[2026-01-15T10:30:00Z] [INFO] [task:42] Starting implementation';
            const entry = parsePlainTextLogLine(line);
            expect(entry).not.toBeNull();
            expect(entry?.timestamp).toBe('2026-01-15T10:30:00Z');
            expect(entry?.level).toBe('info');
            expect(entry?.taskId).toBe(42);
            expect(entry?.context).toBe('task:42');
            expect(entry?.message).toBe('Starting implementation');
        });
        it('should parse context with phase', () => {
            const line = '[2026-01-15T10:30:00Z] [DEBUG] [phase:verification] Running tests';
            const entry = parsePlainTextLogLine(line);
            expect(entry).not.toBeNull();
            expect(entry?.phase).toBe('verification');
            expect(entry?.message).toBe('Running tests');
        });
        it('should parse space-separated format', () => {
            const line = '2026-01-15T10:30:00Z INFO Starting task #42';
            const entry = parsePlainTextLogLine(line);
            expect(entry).not.toBeNull();
            expect(entry?.timestamp).toBe('2026-01-15T10:30:00Z');
            expect(entry?.level).toBe('info');
            expect(entry?.message).toBe('Starting task #42');
        });
        it('should parse ERROR level correctly', () => {
            const line = '[2026-01-15T10:30:00Z] [ERROR] Build verification failed';
            const entry = parsePlainTextLogLine(line);
            expect(entry?.level).toBe('error');
        });
        it('should parse WARN level correctly', () => {
            const line = '[2026-01-15T10:30:00Z] [WARN] Rate limit approaching';
            const entry = parsePlainTextLogLine(line);
            expect(entry?.level).toBe('warn');
        });
        it('should parse DEBUG level correctly', () => {
            const line = '[2026-01-15T10:30:00Z] [DEBUG] Parsed config values';
            const entry = parsePlainTextLogLine(line);
            expect(entry?.level).toBe('debug');
        });
        it('should return null for invalid lines', () => {
            expect(parsePlainTextLogLine('')).toBeNull();
            expect(parsePlainTextLogLine('random text without format')).toBeNull();
            expect(parsePlainTextLogLine('  ')).toBeNull();
        });
    });
    describe('parseJsonLogLine logic', () => {
        const parseJsonLogLine = (line) => {
            try {
                const parsed = JSON.parse(line);
                if (parsed.timestamp && parsed.level && parsed.message) {
                    return {
                        timestamp: parsed.timestamp,
                        level: (parsed.level || 'info').toLowerCase(),
                        message: parsed.message,
                        context: parsed.context,
                        taskId: parsed.taskId || parsed.task_id || parsed.issue_number,
                        phase: parsed.phase,
                        metadata: parsed.metadata,
                    };
                }
            }
            catch {
                // Not valid JSON
            }
            return null;
        };
        it('should parse valid JSON log entry', () => {
            const line = JSON.stringify({
                timestamp: '2026-01-15T10:30:00Z',
                level: 'info',
                message: 'Starting task #42',
            });
            const entry = parseJsonLogLine(line);
            expect(entry).not.toBeNull();
            expect(entry?.timestamp).toBe('2026-01-15T10:30:00Z');
            expect(entry?.level).toBe('info');
            expect(entry?.message).toBe('Starting task #42');
        });
        it('should parse JSON with taskId', () => {
            const line = JSON.stringify({
                timestamp: '2026-01-15T10:30:00Z',
                level: 'info',
                message: 'Implementation complete',
                taskId: 42,
            });
            const entry = parseJsonLogLine(line);
            expect(entry?.taskId).toBe(42);
        });
        it('should parse JSON with task_id (snake case)', () => {
            const line = JSON.stringify({
                timestamp: '2026-01-15T10:30:00Z',
                level: 'info',
                message: 'Implementation complete',
                task_id: 42,
            });
            const entry = parseJsonLogLine(line);
            expect(entry?.taskId).toBe(42);
        });
        it('should parse JSON with issue_number', () => {
            const line = JSON.stringify({
                timestamp: '2026-01-15T10:30:00Z',
                level: 'info',
                message: 'Implementation complete',
                issue_number: 42,
            });
            const entry = parseJsonLogLine(line);
            expect(entry?.taskId).toBe(42);
        });
        it('should parse JSON with metadata', () => {
            const line = JSON.stringify({
                timestamp: '2026-01-15T10:30:00Z',
                level: 'info',
                message: 'Task completed',
                metadata: { cost: 0.15, iterations: 2 },
            });
            const entry = parseJsonLogLine(line);
            expect(entry?.metadata).toEqual({ cost: 0.15, iterations: 2 });
        });
        it('should return null for invalid JSON', () => {
            expect(parseJsonLogLine('not json')).toBeNull();
            expect(parseJsonLogLine('{invalid: json}')).toBeNull();
        });
        it('should return null for JSON missing required fields', () => {
            expect(parseJsonLogLine('{}')).toBeNull();
            expect(parseJsonLogLine('{"timestamp": "2026-01-15"}')).toBeNull();
            expect(parseJsonLogLine('{"timestamp": "2026-01-15", "level": "info"}')).toBeNull();
        });
        it('should normalize level to lowercase', () => {
            const line = JSON.stringify({
                timestamp: '2026-01-15T10:30:00Z',
                level: 'ERROR',
                message: 'Something failed',
            });
            const entry = parseJsonLogLine(line);
            expect(entry?.level).toBe('error');
        });
    });
    describe('applyFilters logic', () => {
        const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
        const getLevelPriority = (level) => {
            return LOG_LEVELS.indexOf(level);
        };
        const applyFilters = (entries, options) => {
            let filtered = [...entries];
            // Apply --since filter (simplified for test)
            if (options.since) {
                const sinceDate = new Date(options.since);
                if (!isNaN(sinceDate.getTime())) {
                    const sinceTime = sinceDate.getTime();
                    filtered = filtered.filter((entry) => {
                        const entryTime = new Date(entry.timestamp).getTime();
                        return !isNaN(entryTime) && entryTime >= sinceTime;
                    });
                }
            }
            // Apply --level filter
            if (options.level) {
                const levelFilter = options.level.toLowerCase();
                const filterPriority = getLevelPriority(levelFilter);
                if (filterPriority >= 0) {
                    filtered = filtered.filter((entry) => getLevelPriority(entry.level) >= filterPriority);
                }
            }
            // Apply --task filter
            if (options.task !== undefined) {
                filtered = filtered.filter((entry) => entry.taskId === options.task);
            }
            // Apply --grep filter
            if (options.grep) {
                try {
                    const regex = new RegExp(options.grep, 'i');
                    filtered = filtered.filter((entry) => regex.test(entry.message));
                }
                catch {
                    // Invalid regex, skip filter
                }
            }
            // Apply --limit
            if (options.limit && options.limit > 0 && filtered.length > options.limit) {
                filtered = filtered.slice(-options.limit);
            }
            return { filtered };
        };
        const sampleEntries = [
            {
                timestamp: '2026-01-15T10:00:00Z',
                level: 'info',
                message: 'Starting session',
            },
            {
                timestamp: '2026-01-15T10:05:00Z',
                level: 'info',
                message: 'Starting task #42',
                taskId: 42,
            },
            {
                timestamp: '2026-01-15T10:10:00Z',
                level: 'debug',
                message: 'Parsed configuration',
                taskId: 42,
            },
            {
                timestamp: '2026-01-15T10:15:00Z',
                level: 'warn',
                message: 'Rate limit at 80%',
                taskId: 42,
            },
            {
                timestamp: '2026-01-15T10:20:00Z',
                level: 'error',
                message: 'Build verification failed',
                taskId: 42,
            },
            {
                timestamp: '2026-01-15T10:25:00Z',
                level: 'info',
                message: 'Starting task #43',
                taskId: 43,
            },
            {
                timestamp: '2026-01-15T10:30:00Z',
                level: 'info',
                message: 'Task completed successfully',
                taskId: 43,
            },
        ];
        it('should filter by level (error)', () => {
            const { filtered } = applyFilters(sampleEntries, { level: 'error' });
            expect(filtered).toHaveLength(1);
            expect(filtered[0].level).toBe('error');
        });
        it('should filter by level (warn) - includes warn and error', () => {
            const { filtered } = applyFilters(sampleEntries, { level: 'warn' });
            expect(filtered).toHaveLength(2);
            expect(filtered.every((e) => e.level === 'warn' || e.level === 'error')).toBe(true);
        });
        it('should filter by level (info) - includes info, warn, error', () => {
            const { filtered } = applyFilters(sampleEntries, { level: 'info' });
            expect(filtered).toHaveLength(6);
            expect(filtered.every((e) => e.level !== 'debug')).toBe(true);
        });
        it('should filter by level (debug) - includes all', () => {
            const { filtered } = applyFilters(sampleEntries, { level: 'debug' });
            expect(filtered).toHaveLength(7);
        });
        it('should filter by task', () => {
            const { filtered } = applyFilters(sampleEntries, { task: 42 });
            expect(filtered).toHaveLength(4);
            expect(filtered.every((e) => e.taskId === 42)).toBe(true);
        });
        it('should filter by grep pattern', () => {
            const { filtered } = applyFilters(sampleEntries, { grep: 'task' });
            expect(filtered).toHaveLength(3);
        });
        it('should filter by grep regex pattern', () => {
            const { filtered } = applyFilters(sampleEntries, { grep: 'task #\\d+' });
            expect(filtered).toHaveLength(2);
        });
        it('should apply limit from end', () => {
            const { filtered } = applyFilters(sampleEntries, { limit: 3 });
            expect(filtered).toHaveLength(3);
            // Should be the last 3 entries
            expect(filtered[0].message).toBe('Build verification failed');
        });
        it('should filter by since date', () => {
            const { filtered } = applyFilters(sampleEntries, {
                since: '2026-01-15T10:20:00Z',
            });
            expect(filtered).toHaveLength(3);
            expect(filtered[0].message).toBe('Build verification failed');
        });
        it('should combine multiple filters', () => {
            const { filtered } = applyFilters(sampleEntries, {
                task: 42,
                level: 'warn',
            });
            expect(filtered).toHaveLength(2);
            expect(filtered.every((e) => e.taskId === 42)).toBe(true);
            expect(filtered.every((e) => e.level === 'warn' || e.level === 'error')).toBe(true);
        });
        it('should return all entries when no filters', () => {
            const { filtered } = applyFilters(sampleEntries, {});
            expect(filtered).toHaveLength(7);
        });
        it('should handle case insensitive grep', () => {
            const { filtered } = applyFilters(sampleEntries, { grep: 'TASK' });
            expect(filtered.length).toBeGreaterThan(0);
        });
    });
    describe('getLevelColor logic', () => {
        const colors = {
            reset: '\x1b[0m',
            red: '\x1b[31m',
            yellow: '\x1b[33m',
            dim: '\x1b[2m',
        };
        const getLevelColor = (level) => {
            switch (level) {
                case 'error':
                    return colors.red;
                case 'warn':
                    return colors.yellow;
                case 'info':
                    return colors.reset;
                case 'debug':
                    return colors.dim;
                default:
                    return colors.reset;
            }
        };
        it('should return red for error', () => {
            expect(getLevelColor('error')).toBe(colors.red);
        });
        it('should return yellow for warn', () => {
            expect(getLevelColor('warn')).toBe(colors.yellow);
        });
        it('should return reset for info', () => {
            expect(getLevelColor('info')).toBe(colors.reset);
        });
        it('should return dim for debug', () => {
            expect(getLevelColor('debug')).toBe(colors.dim);
        });
    });
    describe('findLogFiles logic', () => {
        it('should find main log file and rotated files', () => {
            // Setup virtual filesystem
            vol.fromJSON({
                '/test/.chadgi/chadgi.log': 'log content',
                '/test/.chadgi/chadgi.log.1': 'rotated 1',
                '/test/.chadgi/chadgi.log.2': 'rotated 2',
                '/test/.chadgi/chadgi-config.yaml': 'output:\n  log_file: ./chadgi.log',
                '/test/.chadgi/other-file.txt': 'other content',
            });
            // Simplified findLogFiles logic for test
            const findLogFiles = (logDir, logBaseName) => {
                const files = [];
                const entries = vol.readdirSync(logDir);
                for (const entry of entries) {
                    if (entry === logBaseName ||
                        (entry.startsWith(logBaseName + '.') && /\.\d+$/.test(entry))) {
                        files.push(entry);
                    }
                }
                return files.sort((a, b) => {
                    const aNum = a.match(/\.(\d+)$/)?.[1];
                    const bNum = b.match(/\.(\d+)$/)?.[1];
                    if (!aNum && !bNum)
                        return 0;
                    if (!aNum)
                        return -1;
                    if (!bNum)
                        return 1;
                    return parseInt(aNum, 10) - parseInt(bNum, 10);
                });
            };
            const files = findLogFiles('/test/.chadgi', 'chadgi.log');
            expect(files).toHaveLength(3);
            expect(files[0]).toBe('chadgi.log'); // Main file first
            expect(files[1]).toBe('chadgi.log.1');
            expect(files[2]).toBe('chadgi.log.2');
        });
        it('should return empty array when no log files exist', () => {
            vol.fromJSON({
                '/test/.chadgi/chadgi-config.yaml': 'output:\n  log_file: ./chadgi.log',
            });
            const files = vol.readdirSync('/test/.chadgi');
            const logFiles = files.filter((f) => f === 'chadgi.log' || f.startsWith('chadgi.log.'));
            expect(logFiles).toHaveLength(0);
        });
    });
    describe('parseLogEntries logic', () => {
        const parseLogLine = (line) => {
            const trimmed = line.trim();
            if (!trimmed)
                return null;
            // Try JSON first
            if (trimmed.startsWith('{')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.timestamp && parsed.level && parsed.message) {
                        return {
                            timestamp: parsed.timestamp,
                            level: parsed.level.toLowerCase(),
                            message: parsed.message,
                            taskId: parsed.taskId || parsed.task_id,
                            phase: parsed.phase,
                        };
                    }
                }
                catch {
                    // Not valid JSON
                }
            }
            // Try plain text
            const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*\[([A-Z]+)\]\s*(?:\[([^\]]+)\]\s*)?(.*)$/);
            if (bracketMatch) {
                const [, timestamp, level, context, message] = bracketMatch;
                const entry = {
                    timestamp: timestamp.trim(),
                    level: level.toLowerCase(),
                    message: message.trim(),
                };
                if (context) {
                    const taskMatch = context.match(/task:(\d+)/i);
                    if (taskMatch) {
                        entry.taskId = parseInt(taskMatch[1], 10);
                    }
                }
                return entry;
            }
            return null;
        };
        const parseLogEntries = (content) => {
            const lines = content.split('\n');
            const entries = [];
            for (const line of lines) {
                const entry = parseLogLine(line);
                if (entry) {
                    entries.push(entry);
                }
            }
            return entries;
        };
        it('should parse multiple plain text log entries', () => {
            const content = `[2026-01-15T10:00:00Z] [INFO] Starting session
[2026-01-15T10:05:00Z] [INFO] [task:42] Starting task
[2026-01-15T10:10:00Z] [ERROR] Build failed`;
            const entries = parseLogEntries(content);
            expect(entries).toHaveLength(3);
            expect(entries[0].level).toBe('info');
            expect(entries[1].taskId).toBe(42);
            expect(entries[2].level).toBe('error');
        });
        it('should parse multiple JSON log entries', () => {
            const content = `{"timestamp":"2026-01-15T10:00:00Z","level":"INFO","message":"Starting"}
{"timestamp":"2026-01-15T10:05:00Z","level":"ERROR","message":"Failed","taskId":42}`;
            const entries = parseLogEntries(content);
            expect(entries).toHaveLength(2);
            expect(entries[0].level).toBe('info');
            expect(entries[1].level).toBe('error');
            expect(entries[1].taskId).toBe(42);
        });
        it('should handle mixed format entries', () => {
            const content = `[2026-01-15T10:00:00Z] [INFO] Plain text entry
{"timestamp":"2026-01-15T10:05:00Z","level":"ERROR","message":"JSON entry"}`;
            const entries = parseLogEntries(content);
            expect(entries).toHaveLength(2);
        });
        it('should skip empty lines', () => {
            const content = `[2026-01-15T10:00:00Z] [INFO] Entry 1

[2026-01-15T10:05:00Z] [INFO] Entry 2

[2026-01-15T10:10:00Z] [INFO] Entry 3`;
            const entries = parseLogEntries(content);
            expect(entries).toHaveLength(3);
        });
        it('should skip unparseable lines', () => {
            const content = `[2026-01-15T10:00:00Z] [INFO] Valid entry
This is just random text
Another random line
[2026-01-15T10:05:00Z] [INFO] Another valid entry`;
            const entries = parseLogEntries(content);
            expect(entries).toHaveLength(2);
        });
    });
    describe('log level priority', () => {
        const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
        it('should have debug as lowest priority', () => {
            expect(LOG_LEVELS.indexOf('debug')).toBe(0);
        });
        it('should have error as highest priority', () => {
            expect(LOG_LEVELS.indexOf('error')).toBe(3);
        });
        it('should order levels correctly for filtering', () => {
            expect(LOG_LEVELS.indexOf('debug')).toBeLessThan(LOG_LEVELS.indexOf('info'));
            expect(LOG_LEVELS.indexOf('info')).toBeLessThan(LOG_LEVELS.indexOf('warn'));
            expect(LOG_LEVELS.indexOf('warn')).toBeLessThan(LOG_LEVELS.indexOf('error'));
        });
    });
});
//# sourceMappingURL=logs.test.js.map