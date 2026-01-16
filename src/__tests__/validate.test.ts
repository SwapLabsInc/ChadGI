/**
 * Unit tests for src/validate.ts
 *
 * Tests the configuration validation and template variable validation logic.
 */

import { jest } from '@jest/globals';
import { vol } from 'memfs';

// Mock the fs module
jest.unstable_mockModule('fs', () => ({
  existsSync: jest.fn((path: string) => vol.existsSync(path)),
  readFileSync: jest.fn((path: string, encoding?: string) => vol.readFileSync(path, encoding as BufferEncoding)),
}));

// Mock child_process to prevent actual command execution
jest.unstable_mockModule('child_process', () => ({
  execSync: jest.fn((cmd: string) => {
    if (cmd.includes('which claude')) return '/usr/local/bin/claude';
    if (cmd.includes('which gh')) return '/usr/local/bin/gh';
    if (cmd.includes('which jq')) return '/usr/local/bin/jq';
    if (cmd.includes('which git')) return '/usr/bin/git';
    if (cmd.includes('which perl')) return '/usr/bin/perl';
    if (cmd.includes('--version')) return 'mock version 1.0.0';
    if (cmd.includes('gh auth status')) return '';
    if (cmd.includes('git rev-parse')) return '/project/.git';
    throw new Error(`Command not mocked: ${cmd}`);
  }),
}));

// Mock secrets module - use full path relative to the validate module
jest.unstable_mockModule('../utils/secrets.js', () => ({
  maskSecrets: jest.fn((text: string) => text),
  setMaskingDisabled: jest.fn(),
}));

const { validateTemplateVariables } = await import('../validate.js');

import {
  validConfig,
  taskTemplate,
  taskTemplateWithUnknownVars,
  configWithCustomVariables,
} from './fixtures/configs.js';

describe('validate module', () => {
  beforeEach(() => {
    vol.reset();
    jest.clearAllMocks();
  });

  describe('validateTemplateVariables', () => {
    it('should pass for valid template variables', () => {
      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': taskTemplate,
      });

      const result = validateTemplateVariables('/project/.chadgi/chadgi-task.md');
      expect(result.templatePath).toBe('/project/.chadgi/chadgi-task.md');
      expect(result.unknownVariables).toHaveLength(0);
    });

    it('should detect unknown template variables', () => {
      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': taskTemplateWithUnknownVars,
      });

      const result = validateTemplateVariables('/project/.chadgi/chadgi-task.md');
      expect(result.unknownVariables.length).toBeGreaterThan(0);

      const unknownVarNames = result.unknownVariables.map((v) => v.variable);
      expect(unknownVarNames).toContain('UNKNOWN_VARIABLE');
      expect(unknownVarNames).toContain('ANOTHER_UNKNOWN');
    });

    it('should accept custom variables when provided', () => {
      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': '{{CUSTOM_VAR_ONE}} {{CUSTOM_VAR_TWO}}',
      });

      const result = validateTemplateVariables(
        '/project/.chadgi/chadgi-task.md',
        ['CUSTOM_VAR_ONE', 'CUSTOM_VAR_TWO']
      );
      expect(result.unknownVariables).toHaveLength(0);
    });

    it('should include line and column info for unknown variables', () => {
      const template = `Line one
Issue: {{UNKNOWN_VAR}}
Line three`;

      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': template,
      });

      const result = validateTemplateVariables('/project/.chadgi/chadgi-task.md');
      expect(result.unknownVariables).toHaveLength(1);
      expect(result.unknownVariables[0].line).toBe(2);
      expect(result.unknownVariables[0].column).toBeGreaterThan(0);
    });

    it('should detect multiple unknown variables on the same line', () => {
      const template = '{{UNKNOWN_ONE}} and {{UNKNOWN_TWO}} here';

      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': template,
      });

      const result = validateTemplateVariables('/project/.chadgi/chadgi-task.md');
      expect(result.unknownVariables).toHaveLength(2);
    });

    it('should recognize all valid built-in variables', () => {
      const validVars = [
        'ISSUE_NUMBER',
        'ISSUE_TITLE',
        'ISSUE_URL',
        'ISSUE_BODY',
        'BRANCH_NAME',
        'BASE_BRANCH',
        'REPO',
        'REPO_OWNER',
        'PROJECT_NUMBER',
        'READY_COLUMN',
        'COMPLETION_PROMISE',
        'TEST_COMMAND',
        'BUILD_COMMAND',
        'CHAD_TAGLINE',
        'CHAD_LABEL',
        'CHAD_FOOTER',
        'ISSUE_PREFIX',
        'EXISTING_ISSUES',
        'GITHUB_USERNAME',
      ];

      const template = validVars.map((v) => `{{${v}}}`).join('\n');

      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': template,
      });

      const result = validateTemplateVariables('/project/.chadgi/chadgi-task.md');
      expect(result.unknownVariables).toHaveLength(0);
    });

    it('should not match lowercase variables', () => {
      const template = '{{issue_number}}';

      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': template,
      });

      // Lowercase won't match the variable pattern
      const result = validateTemplateVariables('/project/.chadgi/chadgi-task.md');
      expect(result.unknownVariables).toHaveLength(0);
    });

    it('should handle empty templates', () => {
      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': '',
      });

      const result = validateTemplateVariables('/project/.chadgi/chadgi-task.md');
      expect(result.unknownVariables).toHaveLength(0);
    });

    it('should handle templates with no variables', () => {
      vol.fromJSON({
        '/project/.chadgi/chadgi-task.md': 'Just plain text content',
      });

      const result = validateTemplateVariables('/project/.chadgi/chadgi-task.md');
      expect(result.unknownVariables).toHaveLength(0);
    });
  });
});
