/**
 * Unit tests for src/utils/formatting.ts
 *
 * Tests formatting utilities for dates, durations, costs, and other values.
 */
import { jest } from '@jest/globals';
import { formatDuration, formatDurationMs, formatDate, formatShortDate, formatCost, formatBytes, formatPercent, formatNumber, truncate, pad, parseSince, horizontalLine, } from '../../utils/formatting.js';
describe('formatDuration', () => {
    it('should format seconds only', () => {
        expect(formatDuration(45)).toBe('45s');
        expect(formatDuration(0)).toBe('0s');
        expect(formatDuration(59)).toBe('59s');
    });
    it('should format minutes and seconds', () => {
        expect(formatDuration(60)).toBe('1m 0s');
        expect(formatDuration(90)).toBe('1m 30s');
        expect(formatDuration(125)).toBe('2m 5s');
        expect(formatDuration(3599)).toBe('59m 59s');
    });
    it('should format hours, minutes, and seconds', () => {
        expect(formatDuration(3600)).toBe('1h 0m 0s');
        expect(formatDuration(3661)).toBe('1h 1m 1s');
        expect(formatDuration(7200)).toBe('2h 0m 0s');
        expect(formatDuration(7323)).toBe('2h 2m 3s');
    });
    it('should round fractional seconds', () => {
        expect(formatDuration(45.4)).toBe('45s');
        expect(formatDuration(45.6)).toBe('46s');
    });
});
describe('formatDurationMs', () => {
    it('should convert milliseconds to seconds and format', () => {
        expect(formatDurationMs(45000)).toBe('45s');
        expect(formatDurationMs(90000)).toBe('1m 30s');
        expect(formatDurationMs(3661000)).toBe('1h 1m 1s');
    });
});
describe('formatDate', () => {
    it('should format ISO date to localized string', () => {
        const result = formatDate('2026-01-15T10:30:00Z');
        // The exact format depends on locale, but should contain these elements
        expect(result).toContain('15');
        expect(result).toContain('2026');
    });
    it('should handle different dates', () => {
        const result = formatDate('2025-12-25T00:00:00Z');
        expect(result).toContain('25');
        expect(result).toContain('2025');
    });
});
describe('formatShortDate', () => {
    it('should format date without time', () => {
        const result = formatShortDate('2026-01-15T10:30:00Z');
        expect(result).toContain('15');
        expect(result).toContain('2026');
    });
});
describe('formatCost', () => {
    it('should format cost with default precision', () => {
        expect(formatCost(1.2345)).toBe('$1.2345');
        expect(formatCost(0.5)).toBe('$0.5000');
        expect(formatCost(0)).toBe('$0.0000');
    });
    it('should format cost with custom precision', () => {
        expect(formatCost(1.2345, 2)).toBe('$1.23');
        expect(formatCost(1.2345, 0)).toBe('$1');
        expect(formatCost(0.99999, 2)).toBe('$1.00');
    });
});
describe('formatBytes', () => {
    it('should format bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(500)).toBe('500 B');
        expect(formatBytes(1023)).toBe('1023 B');
    });
    it('should format kilobytes', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(10240)).toBe('10.0 KB');
    });
    it('should format megabytes', () => {
        expect(formatBytes(1048576)).toBe('1.0 MB');
        expect(formatBytes(1572864)).toBe('1.5 MB');
    });
    it('should format gigabytes', () => {
        expect(formatBytes(1073741824)).toBe('1.0 GB');
    });
});
describe('formatPercent', () => {
    it('should format percentage values', () => {
        expect(formatPercent(75)).toBe('75%');
        expect(formatPercent(100)).toBe('100%');
        expect(formatPercent(0)).toBe('0%');
        expect(formatPercent(33.33)).toBe('33%');
    });
    it('should format decimal values', () => {
        expect(formatPercent(0.75, true)).toBe('75%');
        expect(formatPercent(1.0, true)).toBe('100%');
        expect(formatPercent(0.5, true)).toBe('50%');
    });
});
describe('formatNumber', () => {
    it('should format numbers with thousands separator', () => {
        expect(formatNumber(1000)).toBe('1,000');
        expect(formatNumber(1000000)).toBe('1,000,000');
        expect(formatNumber(123)).toBe('123');
        expect(formatNumber(0)).toBe('0');
    });
});
describe('truncate', () => {
    it('should not truncate short strings', () => {
        expect(truncate('hello', 10)).toBe('hello');
        expect(truncate('hello', 5)).toBe('hello');
    });
    it('should truncate long strings with ellipsis', () => {
        expect(truncate('hello world', 8)).toBe('hello...');
        expect(truncate('this is a long string', 10)).toBe('this is...');
    });
    it('should use custom suffix', () => {
        expect(truncate('hello world', 8, '~')).toBe('hello w~');
        expect(truncate('hello world', 9, '..')).toBe('hello w..');
    });
    it('should use default max length of 60', () => {
        const longString = 'a'.repeat(100);
        const result = truncate(longString);
        expect(result.length).toBe(60);
        expect(result.endsWith('...')).toBe(true);
    });
});
describe('pad', () => {
    it('should pad left by default', () => {
        expect(pad('hello', 10)).toBe('hello     ');
        expect(pad('hi', 5)).toBe('hi   ');
    });
    it('should pad right when specified', () => {
        expect(pad('hello', 10, 'right')).toBe('     hello');
        expect(pad('hi', 5, 'right')).toBe('   hi');
    });
    it('should pad center when specified', () => {
        expect(pad('hi', 6, 'center')).toBe('  hi  ');
        expect(pad('hello', 9, 'center')).toBe('  hello  ');
    });
    it('should use custom padding character', () => {
        expect(pad('hello', 10, 'left', '-')).toBe('hello-----');
        expect(pad('hello', 10, 'right', '0')).toBe('00000hello');
    });
    it('should not pad if string is already at or exceeds width', () => {
        expect(pad('hello', 5)).toBe('hello');
        expect(pad('hello world', 5)).toBe('hello world');
    });
});
describe('parseSince', () => {
    describe('relative time formats', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2026-01-15T12:00:00Z'));
        });
        afterEach(() => {
            jest.useRealTimers();
        });
        it('should parse hours', () => {
            const result = parseSince('24h');
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2026-01-14T12:00:00.000Z');
        });
        it('should parse days', () => {
            const result = parseSince('7d');
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2026-01-08T12:00:00.000Z');
        });
        it('should parse weeks', () => {
            const result = parseSince('2w');
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2026-01-01T12:00:00.000Z');
        });
        it('should parse months', () => {
            const result = parseSince('1m');
            expect(result).toBeInstanceOf(Date);
            expect(result.toISOString()).toBe('2025-12-15T12:00:00.000Z');
        });
        it('should be case insensitive', () => {
            const resultLower = parseSince('7d');
            const resultUpper = parseSince('7D');
            expect(resultLower.getTime()).toBe(resultUpper.getTime());
        });
    });
    describe('ISO date formats', () => {
        it('should parse ISO date string', () => {
            const result = parseSince('2026-01-01');
            expect(result).toBeInstanceOf(Date);
            // Check UTC values since the function parses it as local time
            expect(result.getUTCFullYear()).toBe(2026);
            expect(result.getUTCMonth()).toBe(0); // January is 0
        });
        it('should parse full ISO datetime string', () => {
            const result = parseSince('2026-01-15T10:30:00Z');
            expect(result).toBeInstanceOf(Date);
            expect(result.getUTCFullYear()).toBe(2026);
        });
    });
    describe('invalid formats', () => {
        it('should return null for empty string', () => {
            expect(parseSince('')).toBeNull();
        });
        it('should return null for invalid format', () => {
            expect(parseSince('invalid')).toBeNull();
            expect(parseSince('abc')).toBeNull();
        });
    });
});
describe('horizontalLine', () => {
    it('should create a line with default length and character', () => {
        const result = horizontalLine();
        expect(result.length).toBe(78);
        expect(result).toBe('─'.repeat(78));
    });
    it('should create a line with custom length', () => {
        const result = horizontalLine(40);
        expect(result.length).toBe(40);
        expect(result).toBe('─'.repeat(40));
    });
    it('should create a line with custom character', () => {
        const result = horizontalLine(10, '=');
        expect(result).toBe('==========');
    });
});
//# sourceMappingURL=formatting.test.js.map