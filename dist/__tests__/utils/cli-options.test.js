/**
 * Unit tests for src/utils/cli-options.ts
 *
 * Tests centralized CLI option definitions and helper functions.
 */
import { Command } from 'commander';
import { OPTION_DEFINITIONS, STANDARD_OPTION_NAMES, DEFAULT_CONFIG_PATH, addStandardOption, addStandardOptions, getOptionDefinition, isStandardOption, hasOption, OPTION_CONFLICTS, validateOptionConflicts, getConflictRules, hasConflictRules, } from '../../utils/cli-options.js';
describe('OPTION_DEFINITIONS', () => {
    describe('config option', () => {
        it('should have correct flags', () => {
            expect(OPTION_DEFINITIONS.config.flags).toBe('-c, --config <path>');
        });
        it('should include default path in description', () => {
            expect(OPTION_DEFINITIONS.config.description).toContain(DEFAULT_CONFIG_PATH);
        });
        it('should not have a parser', () => {
            expect(OPTION_DEFINITIONS.config.parser).toBeUndefined();
        });
    });
    describe('json option', () => {
        it('should have correct flags', () => {
            expect(OPTION_DEFINITIONS.json.flags).toBe('-j, --json');
        });
        it('should describe machine-readable output', () => {
            expect(OPTION_DEFINITIONS.json.description.toLowerCase()).toContain('json');
        });
        it('should not have a parser (boolean flag)', () => {
            expect(OPTION_DEFINITIONS.json.parser).toBeUndefined();
        });
    });
    describe('limit option', () => {
        it('should have correct flags with value placeholder', () => {
            expect(OPTION_DEFINITIONS.limit.flags).toBe('-l, --limit <n>');
        });
        it('should have a numeric parser', () => {
            expect(OPTION_DEFINITIONS.limit.parser).toBeDefined();
            expect(typeof OPTION_DEFINITIONS.limit.parser).toBe('function');
        });
        it('should parse valid numeric values', () => {
            const parser = OPTION_DEFINITIONS.limit.parser;
            expect(parser('10', undefined)).toBe(10);
            expect(parser('100', undefined)).toBe(100);
        });
    });
    describe('since option', () => {
        it('should have correct flags', () => {
            expect(OPTION_DEFINITIONS.since.flags).toBe('-s, --since <time>');
        });
        it('should mention supported formats in description', () => {
            const desc = OPTION_DEFINITIONS.since.description.toLowerCase();
            expect(desc).toContain('7d');
        });
        it('should have a parser', () => {
            expect(OPTION_DEFINITIONS.since.parser).toBeDefined();
        });
        it('should pass through valid time values', () => {
            const parser = OPTION_DEFINITIONS.since.parser;
            expect(parser('7d', undefined)).toBe('7d');
            expect(parser('2w', undefined)).toBe('2w');
            expect(parser('2024-01-01', undefined)).toBe('2024-01-01');
        });
        it('should pass through invalid values for downstream handling', () => {
            const parser = OPTION_DEFINITIONS.since.parser;
            // Invalid values are passed through - command handler shows warning
            expect(parser('invalid', undefined)).toBe('invalid');
        });
    });
    describe('verbose option', () => {
        it('should have correct flags', () => {
            expect(OPTION_DEFINITIONS.verbose.flags).toBe('-v, --verbose');
        });
        it('should mention debugging in description', () => {
            expect(OPTION_DEFINITIONS.verbose.description.toLowerCase()).toContain('debug');
        });
    });
    describe('dryRun option', () => {
        it('should have correct flags', () => {
            expect(OPTION_DEFINITIONS.dryRun.flags).toBe('-d, --dry-run');
        });
        it('should mention preview in description', () => {
            expect(OPTION_DEFINITIONS.dryRun.description.toLowerCase()).toContain('preview');
        });
    });
    describe('yes option', () => {
        it('should have correct flags', () => {
            expect(OPTION_DEFINITIONS.yes.flags).toBe('-y, --yes');
        });
        it('should mention confirmation in description', () => {
            expect(OPTION_DEFINITIONS.yes.description.toLowerCase()).toContain('confirmation');
        });
    });
    describe('force option', () => {
        it('should have correct flags', () => {
            expect(OPTION_DEFINITIONS.force.flags).toBe('-f, --force');
        });
        it('should mention safety in description', () => {
            expect(OPTION_DEFINITIONS.force.description.toLowerCase()).toContain('safety');
        });
    });
    describe('days option', () => {
        it('should have correct flags', () => {
            expect(OPTION_DEFINITIONS.days.flags).toBe('--days <n>');
        });
        it('should have a numeric parser', () => {
            expect(OPTION_DEFINITIONS.days.parser).toBeDefined();
        });
        it('should parse valid day values', () => {
            const parser = OPTION_DEFINITIONS.days.parser;
            expect(parser('7', undefined)).toBe(7);
            expect(parser('30', undefined)).toBe(30);
        });
    });
    describe('completeness', () => {
        it('should have definitions for all standard option names', () => {
            for (const name of STANDARD_OPTION_NAMES) {
                expect(OPTION_DEFINITIONS[name]).toBeDefined();
                expect(OPTION_DEFINITIONS[name].flags).toBeDefined();
                expect(OPTION_DEFINITIONS[name].description).toBeDefined();
            }
        });
    });
});
describe('STANDARD_OPTION_NAMES', () => {
    it('should include all common options', () => {
        expect(STANDARD_OPTION_NAMES).toContain('config');
        expect(STANDARD_OPTION_NAMES).toContain('json');
        expect(STANDARD_OPTION_NAMES).toContain('limit');
        expect(STANDARD_OPTION_NAMES).toContain('since');
        expect(STANDARD_OPTION_NAMES).toContain('verbose');
        expect(STANDARD_OPTION_NAMES).toContain('dryRun');
        expect(STANDARD_OPTION_NAMES).toContain('yes');
        expect(STANDARD_OPTION_NAMES).toContain('force');
        expect(STANDARD_OPTION_NAMES).toContain('days');
    });
    it('should be a readonly array', () => {
        // TypeScript ensures this at compile time, but we can verify the values are stable
        const names = [...STANDARD_OPTION_NAMES];
        expect(names.length).toBe(9);
    });
});
describe('DEFAULT_CONFIG_PATH', () => {
    it('should point to .chadgi directory', () => {
        expect(DEFAULT_CONFIG_PATH).toContain('.chadgi');
    });
    it('should be a YAML file', () => {
        expect(DEFAULT_CONFIG_PATH).toMatch(/\.yaml$/);
    });
    it('should be the config file', () => {
        expect(DEFAULT_CONFIG_PATH).toContain('chadgi-config');
    });
});
describe('addStandardOption', () => {
    it('should add a single option to a command', () => {
        const cmd = new Command('test');
        addStandardOption(cmd, 'config');
        // Parse with the option
        cmd.parse(['node', 'test', '--config', '/path/to/config.yaml'], { from: 'user' });
        expect(cmd.opts().config).toBe('/path/to/config.yaml');
    });
    it('should add boolean options correctly', () => {
        const cmd = new Command('test');
        addStandardOption(cmd, 'json');
        // Without flag
        cmd.parse(['node', 'test'], { from: 'user' });
        expect(cmd.opts().json).toBeUndefined();
        // With flag
        const cmd2 = new Command('test');
        addStandardOption(cmd2, 'json');
        cmd2.parse(['node', 'test', '--json'], { from: 'user' });
        expect(cmd2.opts().json).toBe(true);
    });
    it('should add options with parsers', () => {
        const cmd = new Command('test');
        addStandardOption(cmd, 'limit');
        cmd.parse(['node', 'test', '--limit', '25'], { from: 'user' });
        expect(cmd.opts().limit).toBe(25);
    });
    it('should return the command for chaining', () => {
        const cmd = new Command('test');
        const result = addStandardOption(cmd, 'config');
        expect(result).toBe(cmd);
    });
});
describe('addStandardOptions', () => {
    it('should add multiple options to a command', () => {
        const cmd = new Command('test');
        addStandardOptions(cmd, ['config', 'json', 'limit']);
        cmd.parse(['node', 'test', '--config', '/path', '--json', '--limit', '50'], { from: 'user' });
        const opts = cmd.opts();
        expect(opts.config).toBe('/path');
        expect(opts.json).toBe(true);
        expect(opts.limit).toBe(50);
    });
    it('should work with empty array', () => {
        const cmd = new Command('test');
        addStandardOptions(cmd, []);
        // Should not throw
        cmd.parse(['node', 'test'], { from: 'user' });
        expect(cmd.opts()).toEqual({});
    });
    it('should return the command for chaining', () => {
        const cmd = new Command('test');
        const result = addStandardOptions(cmd, ['config']);
        expect(result).toBe(cmd);
    });
    it('should allow chaining with additional options', () => {
        const cmd = new Command('test');
        addStandardOptions(cmd, ['config', 'json'])
            .option('--custom <value>', 'Custom option');
        cmd.parse(['node', 'test', '--config', '/path', '--custom', 'test'], { from: 'user' });
        const opts = cmd.opts();
        expect(opts.config).toBe('/path');
        expect(opts.custom).toBe('test');
    });
    it('should preserve option order', () => {
        const cmd = new Command('test');
        addStandardOptions(cmd, ['limit', 'since', 'days']);
        // All options should be parseable
        cmd.parse(['node', 'test', '--limit', '10', '--since', '7d', '--days', '30'], { from: 'user' });
        const opts = cmd.opts();
        expect(opts.limit).toBe(10);
        expect(opts.since).toBe('7d');
        expect(opts.days).toBe(30);
    });
});
describe('getOptionDefinition', () => {
    it('should return the definition for a standard option', () => {
        const def = getOptionDefinition('config');
        expect(def).toBe(OPTION_DEFINITIONS.config);
    });
    it('should return definitions for all standard options', () => {
        for (const name of STANDARD_OPTION_NAMES) {
            const def = getOptionDefinition(name);
            expect(def).toBeDefined();
            expect(def.flags).toBeDefined();
        }
    });
});
describe('isStandardOption', () => {
    it('should return true for standard option names', () => {
        expect(isStandardOption('config')).toBe(true);
        expect(isStandardOption('json')).toBe(true);
        expect(isStandardOption('limit')).toBe(true);
        expect(isStandardOption('since')).toBe(true);
        expect(isStandardOption('verbose')).toBe(true);
        expect(isStandardOption('dryRun')).toBe(true);
        expect(isStandardOption('yes')).toBe(true);
        expect(isStandardOption('force')).toBe(true);
        expect(isStandardOption('days')).toBe(true);
    });
    it('should return false for non-standard option names', () => {
        expect(isStandardOption('custom')).toBe(false);
        expect(isStandardOption('unknown')).toBe(false);
        expect(isStandardOption('')).toBe(false);
        expect(isStandardOption('CONFIG')).toBe(false); // case sensitive
    });
});
describe('hasOption', () => {
    it('should return true when option is defined', () => {
        const options = { config: '/path', json: true };
        expect(hasOption(options, 'config')).toBe(true);
        expect(hasOption(options, 'json')).toBe(true);
    });
    it('should return false when option is undefined', () => {
        const options = { config: undefined };
        expect(hasOption(options, 'config')).toBe(false);
    });
    it('should return false when option is not present', () => {
        const options = { config: '/path' };
        expect(hasOption(options, 'json')).toBe(false);
        expect(hasOption(options, 'limit')).toBe(false);
    });
    it('should handle empty options object', () => {
        const options = {};
        expect(hasOption(options, 'config')).toBe(false);
    });
    it('should handle falsy but defined values', () => {
        const options = { json: false, limit: 0 };
        expect(hasOption(options, 'json')).toBe(true); // false is defined
        expect(hasOption(options, 'limit')).toBe(true); // 0 is defined
    });
});
describe('integration with Commander', () => {
    it('should work with subcommands', () => {
        const program = new Command('chadgi');
        const queueCmd = program.command('queue').description('Queue commands');
        const listCmd = addStandardOptions(queueCmd.command('list').description('List tasks'), ['config', 'json', 'limit']);
        // Verify options were added to the list subcommand
        const options = listCmd.options;
        const optionFlags = options.map((o) => o.flags);
        expect(optionFlags).toContain('-c, --config <path>');
        expect(optionFlags).toContain('-j, --json');
        expect(optionFlags).toContain('-l, --limit <n>');
    });
    it('should allow mixing standard and custom options', () => {
        const cmd = new Command('test');
        addStandardOptions(cmd, ['config', 'json'])
            .option('--status <outcome>', 'Filter by status')
            .option('--priority <level>', 'Filter by priority');
        cmd.parse([
            'node', 'test',
            '--config', '/path',
            '--json',
            '--status', 'success',
            '--priority', 'high',
        ], { from: 'user' });
        const opts = cmd.opts();
        expect(opts.config).toBe('/path');
        expect(opts.json).toBe(true);
        expect(opts.status).toBe('success');
        expect(opts.priority).toBe('high');
    });
    it('should support short flags', () => {
        const cmd = new Command('test');
        addStandardOptions(cmd, ['config', 'json', 'limit', 'verbose', 'yes', 'force']);
        cmd.parse([
            'node', 'test',
            '-c', '/path',
            '-j',
            '-l', '10',
            '-v',
            '-y',
            '-f',
        ], { from: 'user' });
        const opts = cmd.opts();
        expect(opts.config).toBe('/path');
        expect(opts.json).toBe(true);
        expect(opts.limit).toBe(10);
        expect(opts.verbose).toBe(true);
        expect(opts.yes).toBe(true);
        expect(opts.force).toBe(true);
    });
});
// ============================================================================
// Option Conflict Detection Tests
// ============================================================================
describe('OPTION_CONFLICTS', () => {
    it('should define conflict rules for cleanup command', () => {
        expect(OPTION_CONFLICTS.cleanup).toBeDefined();
        expect(Array.isArray(OPTION_CONFLICTS.cleanup)).toBe(true);
        expect(OPTION_CONFLICTS.cleanup.length).toBeGreaterThan(0);
    });
    it('should define conflict rules for replay command', () => {
        expect(OPTION_CONFLICTS.replay).toBeDefined();
        expect(Array.isArray(OPTION_CONFLICTS.replay)).toBe(true);
    });
    it('should define conflict rules for diff command', () => {
        expect(OPTION_CONFLICTS.diff).toBeDefined();
        expect(Array.isArray(OPTION_CONFLICTS.diff)).toBe(true);
    });
    it('should define conflict rules for unlock command', () => {
        expect(OPTION_CONFLICTS.unlock).toBeDefined();
        expect(Array.isArray(OPTION_CONFLICTS.unlock)).toBe(true);
    });
    it('should define conflict rules for logs view subcommand', () => {
        expect(OPTION_CONFLICTS['logs view']).toBeDefined();
        expect(Array.isArray(OPTION_CONFLICTS['logs view'])).toBe(true);
    });
    it('should have valid structure for all rules', () => {
        for (const [command, rules] of Object.entries(OPTION_CONFLICTS)) {
            for (const rule of rules) {
                expect(rule.exclusive).toBeDefined();
                expect(Array.isArray(rule.exclusive)).toBe(true);
                expect(rule.exclusive.length).toBeGreaterThanOrEqual(2);
                expect(rule.message).toBeDefined();
                expect(typeof rule.message).toBe('string');
                expect(rule.message.length).toBeGreaterThan(0);
            }
        }
    });
});
describe('validateOptionConflicts', () => {
    describe('cleanup command', () => {
        it('should return valid when no conflicting options are used', () => {
            const result = validateOptionConflicts('cleanup', { branches: true });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should return valid when only --all is used', () => {
            const result = validateOptionConflicts('cleanup', { all: true });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should detect conflict between --all and --branches', () => {
            const result = validateOptionConflicts('cleanup', { all: true, branches: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--all');
            expect(result.errors[0]).toContain('--branches');
        });
        it('should detect conflict between --all and --diagnostics', () => {
            const result = validateOptionConflicts('cleanup', { all: true, diagnostics: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--all');
            expect(result.errors[0]).toContain('--diagnostics');
        });
        it('should detect conflict between --all and --logs', () => {
            const result = validateOptionConflicts('cleanup', { all: true, logs: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--all');
            expect(result.errors[0]).toContain('--logs');
        });
        it('should detect multiple conflicts when --all is used with multiple options', () => {
            const result = validateOptionConflicts('cleanup', {
                all: true,
                branches: true,
                diagnostics: true,
            });
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
        });
        it('should allow non-conflicting combinations', () => {
            const result = validateOptionConflicts('cleanup', {
                branches: true,
                diagnostics: true,
                logs: true,
            });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });
    describe('replay command', () => {
        it('should return valid when no task selector is used', () => {
            const result = validateOptionConflicts('replay', { fresh: true });
            expect(result.valid).toBe(true);
        });
        it('should return valid when only --last is used', () => {
            const result = validateOptionConflicts('replay', { last: true });
            expect(result.valid).toBe(true);
        });
        it('should return valid when only --all-failed is used', () => {
            const result = validateOptionConflicts('replay', { allFailed: true });
            expect(result.valid).toBe(true);
        });
        it('should return valid when only issue number is used', () => {
            const result = validateOptionConflicts('replay', { issueNumber: 42 });
            expect(result.valid).toBe(true);
        });
        it('should detect conflict between --last and --all-failed', () => {
            const result = validateOptionConflicts('replay', { last: true, allFailed: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--last');
            expect(result.errors[0]).toContain('--all-failed');
        });
        it('should detect conflict between --last and issue number', () => {
            const result = validateOptionConflicts('replay', { last: true, issueNumber: 42 });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--last');
            expect(result.errors[0]).toContain('<issue-number>');
        });
        it('should detect conflict between --all-failed and issue number', () => {
            const result = validateOptionConflicts('replay', { allFailed: true, issueNumber: 42 });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--all-failed');
            expect(result.errors[0]).toContain('<issue-number>');
        });
    });
    describe('diff command', () => {
        it('should return valid when only --pr is used', () => {
            const result = validateOptionConflicts('diff', { pr: 123 });
            expect(result.valid).toBe(true);
        });
        it('should return valid when only issue number is used', () => {
            const result = validateOptionConflicts('diff', { issueNumber: 42 });
            expect(result.valid).toBe(true);
        });
        it('should detect conflict between --pr and issue number', () => {
            const result = validateOptionConflicts('diff', { pr: 123, issueNumber: 42 });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--pr');
            expect(result.errors[0]).toContain('<issue-number>');
        });
    });
    describe('unlock command', () => {
        it('should return valid when only --all is used', () => {
            const result = validateOptionConflicts('unlock', { all: true });
            expect(result.valid).toBe(true);
        });
        it('should return valid when only issue number is used', () => {
            const result = validateOptionConflicts('unlock', { issueNumber: 42 });
            expect(result.valid).toBe(true);
        });
        it('should detect conflict between --all and issue number', () => {
            const result = validateOptionConflicts('unlock', { all: true, issueNumber: 42 });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--all');
            expect(result.errors[0]).toContain('<issue-number>');
        });
    });
    describe('logs view command', () => {
        it('should return valid when only --follow is used', () => {
            const result = validateOptionConflicts('logs view', { follow: true });
            expect(result.valid).toBe(true);
        });
        it('should return valid when only --json is used', () => {
            const result = validateOptionConflicts('logs view', { json: true });
            expect(result.valid).toBe(true);
        });
        it('should detect conflict between --follow and --json', () => {
            const result = validateOptionConflicts('logs view', { follow: true, json: true });
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('--follow');
            expect(result.errors[0]).toContain('--json');
        });
    });
    describe('unknown commands', () => {
        it('should return valid for commands without conflict rules', () => {
            const result = validateOptionConflicts('unknown-command', { any: true, option: true });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should return valid for start command (no conflicts defined)', () => {
            const result = validateOptionConflicts('start', { dryRun: true, workspace: true });
            expect(result.valid).toBe(true);
        });
    });
    describe('edge cases', () => {
        it('should handle empty options object', () => {
            const result = validateOptionConflicts('cleanup', {});
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should ignore undefined option values', () => {
            const result = validateOptionConflicts('cleanup', { all: true, branches: undefined });
            expect(result.valid).toBe(true);
        });
        it('should ignore null option values', () => {
            const result = validateOptionConflicts('cleanup', { all: true, branches: null });
            expect(result.valid).toBe(true);
        });
        it('should ignore false boolean option values', () => {
            const result = validateOptionConflicts('cleanup', { all: true, branches: false });
            expect(result.valid).toBe(true);
        });
        it('should treat numeric values as set when defined', () => {
            // For numeric values like issue numbers, any defined value is considered "set"
            // In practice, 0 is not a valid issue number but the validation still catches it
            const result = validateOptionConflicts('unlock', { all: true, issueNumber: 0 });
            // 0 is a number (not undefined/null), so it's considered "set"
            expect(result.valid).toBe(false);
            const result2 = validateOptionConflicts('unlock', { all: true, issueNumber: 42 });
            expect(result2.valid).toBe(false);
        });
    });
});
describe('getConflictRules', () => {
    it('should return conflict rules for defined commands', () => {
        const rules = getConflictRules('cleanup');
        expect(Array.isArray(rules)).toBe(true);
        expect(rules.length).toBeGreaterThan(0);
    });
    it('should return empty array for undefined commands', () => {
        const rules = getConflictRules('nonexistent');
        expect(Array.isArray(rules)).toBe(true);
        expect(rules).toHaveLength(0);
    });
    it('should return the same rules as OPTION_CONFLICTS', () => {
        const rules = getConflictRules('replay');
        expect(rules).toBe(OPTION_CONFLICTS.replay);
    });
});
describe('hasConflictRules', () => {
    it('should return true for commands with conflict rules', () => {
        expect(hasConflictRules('cleanup')).toBe(true);
        expect(hasConflictRules('replay')).toBe(true);
        expect(hasConflictRules('diff')).toBe(true);
        expect(hasConflictRules('unlock')).toBe(true);
        expect(hasConflictRules('logs view')).toBe(true);
    });
    it('should return false for commands without conflict rules', () => {
        expect(hasConflictRules('start')).toBe(false);
        expect(hasConflictRules('init')).toBe(false);
        expect(hasConflictRules('nonexistent')).toBe(false);
    });
});
//# sourceMappingURL=cli-options.test.js.map