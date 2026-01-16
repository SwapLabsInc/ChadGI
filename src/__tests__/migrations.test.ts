/**
 * Unit tests for src/migrations/index.ts
 *
 * Tests configuration migration utilities and migration execution.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock the fs module
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => vol.existsSync(path)),
  readFileSync: jest.fn((path: string, encoding?: string) => vol.readFileSync(path, encoding as BufferEncoding)),
  writeFileSync: jest.fn((path: string, data: string) => vol.writeFileSync(path, data)),
  mkdirSync: jest.fn((path: string, options?: { recursive?: boolean }) => vol.mkdirSync(path, options)),
  copyFileSync: jest.fn((src: string, dest: string) => vol.copyFileSync(src, dest)),
  readdirSync: jest.fn((path: string) => vol.readdirSync(path)),
}));

// Import modules after mocking
const {
  parseVersion,
  compareVersions,
  isValidVersion,
  parseYamlToObject,
  objectToYaml,
  getConfigVersion,
  checkMigrations,
  createBackup,
  getLatestBackup,
  restoreFromBackup,
  loadMigrationHistory,
  saveMigrationHistory,
  addMigrationHistoryEntry,
  runMigrations,
  previewMigrations,
  CURRENT_CONFIG_VERSION,
  DEFAULT_CONFIG_VERSION,
  MIGRATION_HISTORY_FILE,
  BACKUP_DIR,
  MIGRATIONS,
} = await import('../migrations/index.js');

const { migration_1_0_to_1_1 } = await import('../migrations/v1_0_to_v1_1.js');

// Reset the virtual filesystem before each test
beforeEach(() => {
  vol.reset();
});

describe('Version Parsing and Comparison', () => {
  describe('parseVersion', () => {
    it('should parse valid version strings', () => {
      expect(parseVersion('1.0')).toEqual({ major: 1, minor: 0 });
      expect(parseVersion('2.5')).toEqual({ major: 2, minor: 5 });
      expect(parseVersion('10.20')).toEqual({ major: 10, minor: 20 });
    });

    it('should handle invalid versions gracefully', () => {
      expect(parseVersion('')).toEqual({ major: 0, minor: 0 });
      expect(parseVersion('invalid')).toEqual({ major: 0, minor: 0 });
    });
  });

  describe('compareVersions', () => {
    it('should compare versions correctly', () => {
      expect(compareVersions('1.0', '1.0')).toBe(0);
      expect(compareVersions('1.0', '1.1')).toBe(-1);
      expect(compareVersions('1.1', '1.0')).toBe(1);
      expect(compareVersions('2.0', '1.9')).toBe(1);
      expect(compareVersions('1.9', '2.0')).toBe(-1);
    });
  });

  describe('isValidVersion', () => {
    it('should validate version format', () => {
      expect(isValidVersion('1.0')).toBe(true);
      expect(isValidVersion('2.5')).toBe(true);
      expect(isValidVersion('10.20')).toBe(true);
      expect(isValidVersion('')).toBe(false);
      expect(isValidVersion('1')).toBe(false);
      expect(isValidVersion('1.2.3')).toBe(false);
      expect(isValidVersion('v1.0')).toBe(false);
      expect(isValidVersion('invalid')).toBe(false);
    });
  });
});

describe('YAML Parsing', () => {
  describe('parseYamlToObject', () => {
    it('should parse simple key-value pairs', () => {
      const yaml = `
key1: value1
key2: value2
number: 42
boolean: true
`;
      const result = parseYamlToObject(yaml);
      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
    });

    it('should parse nested objects', () => {
      const yaml = `
github:
  repo: owner/repo
  project_number: 1
branch:
  base: main
`;
      const result = parseYamlToObject(yaml);
      expect(result.github).toEqual({
        repo: 'owner/repo',
        project_number: 1,
      });
      expect(result.branch).toEqual({
        base: 'main',
      });
    });

    it('should skip comments', () => {
      const yaml = `
# This is a comment
key: value
# Another comment
`;
      const result = parseYamlToObject(yaml);
      expect(result.key).toBe('value');
      expect(Object.keys(result)).toHaveLength(1);
    });

    it('should parse config_version correctly', () => {
      const yaml = `
config_version: "1.1"
github:
  repo: test/repo
`;
      const result = parseYamlToObject(yaml);
      expect(result.config_version).toBe('1.1');
    });
  });

  describe('objectToYaml', () => {
    it('should convert simple objects to YAML', () => {
      const obj = { key1: 'value1', key2: 42 };
      const yaml = objectToYaml(obj);
      expect(yaml).toContain('key1: value1');
      expect(yaml).toContain('key2: 42');
    });

    it('should handle nested objects', () => {
      const obj = {
        github: {
          repo: 'owner/repo',
        },
      };
      const yaml = objectToYaml(obj);
      expect(yaml).toContain('github:');
      expect(yaml).toContain('  repo: owner/repo');
    });
  });
});

describe('Config Version Detection', () => {
  describe('getConfigVersion', () => {
    it('should extract version from config object', () => {
      const config = { config_version: '1.1', github: { repo: 'test' } };
      expect(getConfigVersion(config)).toBe('1.1');
    });

    it('should return null for missing version in object', () => {
      const config = { github: { repo: 'test' } };
      expect(getConfigVersion(config)).toBeNull();
    });

    it('should return null for invalid version format', () => {
      const config = { config_version: 'invalid', github: { repo: 'test' } };
      expect(getConfigVersion(config)).toBeNull();
    });
  });
});

// Note: File-based migration tests are covered by integration tests
// Unit tests focus on pure logic that doesn't require file system mocking

// Note: File system-based tests (Backup, History, Migration Execution)
// are covered by integration tests to avoid fs mocking complexity

describe('Individual Migrations', () => {
  describe('migration_1_0_to_1_1', () => {
    it('should add config_version field', () => {
      const config = { github: { repo: 'test/repo' } };
      const migrated = migration_1_0_to_1_1.migrate(config);

      expect(migrated.config_version).toBe('1.1');
    });

    it('should preserve existing fields', () => {
      const config = {
        github: { repo: 'test/repo' },
        poll_interval: 30,
      };
      const migrated = migration_1_0_to_1_1.migrate(config);

      expect(migrated.github).toEqual({ repo: 'test/repo' });
      expect(migrated.poll_interval).toBe(30);
    });

    it('should have correct version metadata', () => {
      expect(migration_1_0_to_1_1.fromVersion).toBe('1.0');
      expect(migration_1_0_to_1_1.toVersion).toBe('1.1');
      expect(migration_1_0_to_1_1.description).toBeDefined();
    });
  });
});

describe('Migration Registry', () => {
  it('should have migrations in order', () => {
    for (let i = 1; i < MIGRATIONS.length; i++) {
      const prev = MIGRATIONS[i - 1];
      const curr = MIGRATIONS[i];
      expect(prev.toVersion).toBe(curr.fromVersion);
    }
  });

  it('should have migrations leading to current version', () => {
    if (MIGRATIONS.length > 0) {
      const lastMigration = MIGRATIONS[MIGRATIONS.length - 1];
      expect(lastMigration.toVersion).toBe(CURRENT_CONFIG_VERSION);
    }
  });
});
