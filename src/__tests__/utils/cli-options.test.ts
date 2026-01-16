/**
 * Unit tests for src/utils/cli-options.ts
 *
 * Tests centralized CLI option definitions and helper functions.
 */

import { jest } from '@jest/globals';
import { Command } from 'commander';
import {
  OPTION_DEFINITIONS,
  STANDARD_OPTION_NAMES,
  DEFAULT_CONFIG_PATH,
  addStandardOption,
  addStandardOptions,
  getOptionDefinition,
  isStandardOption,
  hasOption,
  type StandardOptionName,
} from '../../utils/cli-options.js';

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
      const parser = OPTION_DEFINITIONS.limit.parser!;
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
      const parser = OPTION_DEFINITIONS.since.parser!;
      expect(parser('7d', undefined)).toBe('7d');
      expect(parser('2w', undefined)).toBe('2w');
      expect(parser('2024-01-01', undefined)).toBe('2024-01-01');
    });

    it('should pass through invalid values for downstream handling', () => {
      const parser = OPTION_DEFINITIONS.since.parser!;
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
      const parser = OPTION_DEFINITIONS.days.parser!;
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

    const listCmd = addStandardOptions(
      queueCmd.command('list').description('List tasks'),
      ['config', 'json', 'limit']
    );

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
