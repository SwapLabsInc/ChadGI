/**
 * Unit tests for src/utils/validation.ts
 *
 * Tests numeric validation utilities for CLI options.
 */
import { jest } from '@jest/globals';
import { validateNumeric, createNumericParser, validateNumericOptions, formatConstraintBounds, NUMERIC_CONSTRAINTS, } from '../../utils/validation.js';
describe('validateNumeric', () => {
    describe('basic integer parsing', () => {
        it('should accept valid positive integers', () => {
            const result = validateNumeric('42', 'test', { min: 0, integer: true });
            expect(result.valid).toBe(true);
            expect(result.value).toBe(42);
        });
        it('should accept zero when min is 0', () => {
            const result = validateNumeric('0', 'timeout', 'timeout');
            expect(result.valid).toBe(true);
            expect(result.value).toBe(0);
        });
        it('should reject non-numeric input', () => {
            const result = validateNumeric('abc', 'test', { min: 0, integer: true });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not a valid integer');
        });
        it('should reject empty string', () => {
            const result = validateNumeric('', 'test', { min: 0, integer: true });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not a valid integer');
        });
        it('should reject floating point when integer is required', () => {
            const result = validateNumeric('3.5', 'test', { integer: true, min: 1 });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be an integer');
        });
    });
    describe('floating point parsing', () => {
        it('should accept valid float values', () => {
            const result = validateNumeric('1.5', 'budget', { min: 0.01 });
            expect(result.valid).toBe(true);
            expect(result.value).toBe(1.5);
        });
        it('should accept integer values as floats', () => {
            const result = validateNumeric('5', 'budget', { min: 0.01 });
            expect(result.valid).toBe(true);
            expect(result.value).toBe(5);
        });
    });
    describe('minimum bound checking', () => {
        it('should accept value at minimum bound', () => {
            const result = validateNumeric('100', 'interval', 'interval');
            expect(result.valid).toBe(true);
            expect(result.value).toBe(100);
        });
        it('should reject value below minimum bound', () => {
            const result = validateNumeric('50', 'interval', 'interval');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('at least 100ms');
        });
        it('should reject negative values when min is 0', () => {
            const result = validateNumeric('-5', 'timeout', 'timeout');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('non-negative');
        });
        it('should reject zero when min is 1', () => {
            const result = validateNumeric('0', 'limit', 'limit');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('positive integer');
        });
    });
    describe('maximum bound checking', () => {
        it('should accept value at maximum bound', () => {
            const result = validateNumeric('36500', 'days', 'days');
            expect(result.valid).toBe(true);
            expect(result.value).toBe(36500);
        });
        it('should reject value above maximum bound', () => {
            const result = validateNumeric('999999', 'days', 'days');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('1-36500');
        });
    });
    describe('predefined constraint names', () => {
        it('should use timeout constraint correctly', () => {
            const valid = validateNumeric('30', 'timeout', 'timeout');
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(30);
            const invalid = validateNumeric('-1', 'timeout', 'timeout');
            expect(invalid.valid).toBe(false);
        });
        it('should use interval constraint correctly', () => {
            const valid = validateNumeric('2000', 'interval', 'interval');
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(2000);
            const invalid = validateNumeric('50', 'interval', 'interval');
            expect(invalid.valid).toBe(false);
            expect(invalid.error).toContain('at least 100ms');
        });
        it('should use limit constraint correctly', () => {
            const valid = validateNumeric('10', 'limit', 'limit');
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(10);
            const invalid = validateNumeric('0', 'limit', 'limit');
            expect(invalid.valid).toBe(false);
        });
        it('should use days constraint correctly', () => {
            const valid = validateNumeric('30', 'days', 'days');
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(30);
            const invalidZero = validateNumeric('0', 'days', 'days');
            expect(invalidZero.valid).toBe(false);
            const invalidHigh = validateNumeric('50000', 'days', 'days');
            expect(invalidHigh.valid).toBe(false);
        });
        it('should use budget constraint correctly', () => {
            const valid = validateNumeric('2.50', 'budget', 'budget');
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(2.5);
            const invalid = validateNumeric('0', 'budget', 'budget');
            expect(invalid.valid).toBe(false);
        });
        it('should use iterations constraint correctly', () => {
            const valid = validateNumeric('5', 'iterations', 'iterations');
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(5);
            const invalid = validateNumeric('0', 'iterations', 'iterations');
            expect(invalid.valid).toBe(false);
        });
        it('should use issueNumber constraint correctly', () => {
            const valid = validateNumeric('123', 'pr', 'issueNumber');
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(123);
            const invalid = validateNumeric('0', 'pr', 'issueNumber');
            expect(invalid.valid).toBe(false);
        });
        it('should use priority constraint correctly', () => {
            const validZero = validateNumeric('0', 'priority', 'priority');
            expect(validZero.valid).toBe(true);
            expect(validZero.value).toBe(0);
            const validPositive = validateNumeric('5', 'priority', 'priority');
            expect(validPositive.valid).toBe(true);
            const invalid = validateNumeric('-1', 'priority', 'priority');
            expect(invalid.valid).toBe(false);
        });
        it('should use sessionCount constraint correctly', () => {
            const valid = validateNumeric('5', 'last', 'sessionCount');
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(5);
            const invalid = validateNumeric('0', 'last', 'sessionCount');
            expect(invalid.valid).toBe(false);
        });
    });
    describe('custom constraints', () => {
        it('should accept custom constraint object', () => {
            const constraint = {
                min: 10,
                max: 100,
                integer: true,
                errorMessage: 'Value must be between 10 and 100',
            };
            const valid = validateNumeric('50', 'custom', constraint);
            expect(valid.valid).toBe(true);
            expect(valid.value).toBe(50);
            const invalid = validateNumeric('5', 'custom', constraint);
            expect(invalid.valid).toBe(false);
            expect(invalid.error).toContain('between 10 and 100');
        });
    });
});
describe('createNumericParser', () => {
    let mockExit;
    let mockConsoleError;
    beforeEach(() => {
        mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
            throw new Error('process.exit called');
        });
        mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
    });
    it('should return parsed value for valid input', () => {
        const parser = createNumericParser('timeout', 'timeout');
        expect(parser('30')).toBe(30);
    });
    it('should exit with code 1 for invalid input', () => {
        const parser = createNumericParser('timeout', 'timeout');
        expect(() => parser('-5')).toThrow('process.exit called');
        expect(mockExit).toHaveBeenCalledWith(1);
        expect(mockConsoleError).toHaveBeenCalled();
    });
    it('should print colored error message', () => {
        const parser = createNumericParser('interval', 'interval');
        expect(() => parser('50')).toThrow('process.exit called');
        expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('at least 100ms'));
    });
});
describe('validateNumericOptions', () => {
    it('should validate multiple options successfully', () => {
        const options = { timeout: 30, limit: 10, days: 7 };
        const constraints = {
            timeout: 'timeout',
            limit: 'limit',
            days: 'days',
        };
        const result = validateNumericOptions(options, constraints);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
    it('should collect all errors for invalid options', () => {
        const options = { timeout: -1, limit: 0, days: 50000 };
        const constraints = {
            timeout: 'timeout',
            limit: 'limit',
            days: 'days',
        };
        const result = validateNumericOptions(options, constraints);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
    it('should skip undefined options', () => {
        const options = { timeout: undefined, limit: 10 };
        const constraints = {
            timeout: 'timeout',
            limit: 'limit',
        };
        const result = validateNumericOptions(options, constraints);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });
});
describe('formatConstraintBounds', () => {
    it('should format integer constraints', () => {
        const result = formatConstraintBounds('limit');
        expect(result).toContain('integer');
        expect(result).toContain('>= 1');
    });
    it('should format range constraints', () => {
        const result = formatConstraintBounds('days');
        expect(result).toContain('1-36500');
    });
    it('should format minimum-only constraints', () => {
        const result = formatConstraintBounds('timeout');
        expect(result).toContain('>= 0');
    });
    it('should format float constraints', () => {
        const result = formatConstraintBounds('budget');
        expect(result).toContain('>= 0.01');
        expect(result).not.toContain('integer');
    });
    it('should format custom constraints', () => {
        const constraint = {
            min: 5,
            max: 20,
            integer: true,
        };
        const result = formatConstraintBounds(constraint);
        expect(result).toContain('integer');
        expect(result).toContain('5-20');
    });
});
describe('NUMERIC_CONSTRAINTS', () => {
    it('should have all required constraint definitions', () => {
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('timeout');
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('interval');
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('limit');
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('days');
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('budget');
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('iterations');
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('issueNumber');
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('priority');
        expect(NUMERIC_CONSTRAINTS).toHaveProperty('sessionCount');
    });
    it('should have correct timeout constraint', () => {
        expect(NUMERIC_CONSTRAINTS.timeout.min).toBe(0);
        expect(NUMERIC_CONSTRAINTS.timeout.integer).toBe(true);
    });
    it('should have correct interval constraint', () => {
        expect(NUMERIC_CONSTRAINTS.interval.min).toBe(100);
        expect(NUMERIC_CONSTRAINTS.interval.integer).toBe(true);
    });
    it('should have correct days constraint with upper bound', () => {
        expect(NUMERIC_CONSTRAINTS.days.min).toBe(1);
        expect(NUMERIC_CONSTRAINTS.days.max).toBe(36500);
    });
    it('should have correct budget constraint for floats', () => {
        expect(NUMERIC_CONSTRAINTS.budget.min).toBe(0.01);
        // Budget constraint doesn't have integer: true, so it accepts floats
        expect('integer' in NUMERIC_CONSTRAINTS.budget).toBe(false);
    });
});
//# sourceMappingURL=validation.test.js.map