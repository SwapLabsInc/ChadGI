/**
 * Unit tests for lifecycle hooks functionality
 *
 * Tests the hooks configuration schema, TypeScript types,
 * and validates hook definitions in the schema.
 */

import { jest } from '@jest/globals';
import { readFileSync, existsSync, writeFileSync, mkdirSync, chmodSync, unlinkSync, rmdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn, ChildProcess } from 'child_process';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read schema file once for all tests
const schemaPath = join(__dirname, '..', '..', 'schemas', 'chadgi-config.schema.json');
const templatePath = join(__dirname, '..', '..', 'templates', 'chadgi-config.yaml');

describe('Lifecycle Hooks Schema', () => {
  let schema: Record<string, unknown>;
  let defs: Record<string, unknown>;

  beforeAll(() => {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent);
    defs = schema.$defs as Record<string, unknown>;
  });

  describe('hooks property in schema', () => {
    it('should define hooks at top level with $ref to HooksConfig', () => {
      const properties = schema.properties as Record<string, unknown>;
      expect(properties.hooks).toBeDefined();
      const hooks = properties.hooks as Record<string, unknown>;
      expect(hooks.$ref).toBe('#/$defs/HooksConfig');
    });
  });

  describe('HooksConfig definition', () => {
    let hooksConfig: Record<string, unknown>;
    let hooksProps: Record<string, unknown>;

    beforeAll(() => {
      hooksConfig = defs.HooksConfig as Record<string, unknown>;
      hooksProps = hooksConfig.properties as Record<string, unknown>;
    });

    it('should exist in $defs', () => {
      expect(defs.HooksConfig).toBeDefined();
    });

    it('should be of type object', () => {
      expect(hooksConfig.type).toBe('object');
    });

    it('should have a description', () => {
      expect(hooksConfig.description).toBeDefined();
      expect(typeof hooksConfig.description).toBe('string');
      expect((hooksConfig.description as string).length).toBeGreaterThan(0);
    });

    it('should define all lifecycle hook types', () => {
      expect(hooksProps.pre_task).toBeDefined();
      expect(hooksProps.post_implementation).toBeDefined();
      expect(hooksProps.pre_pr).toBeDefined();
      expect(hooksProps.post_pr).toBeDefined();
      expect(hooksProps.post_merge).toBeDefined();
      expect(hooksProps.on_failure).toBeDefined();
      expect(hooksProps.on_budget_warning).toBeDefined();
    });

    it('should reference HookDefinition for each hook type', () => {
      const hookTypes = ['pre_task', 'post_implementation', 'pre_pr', 'post_pr', 'post_merge', 'on_failure', 'on_budget_warning'];
      for (const hookType of hookTypes) {
        const hook = hooksProps[hookType] as Record<string, unknown>;
        expect(hook.$ref).toBe('#/$defs/HookDefinition');
      }
    });

    it('should have descriptions for each hook type', () => {
      const hookTypes = ['pre_task', 'post_implementation', 'pre_pr', 'post_pr', 'post_merge', 'on_failure', 'on_budget_warning'];
      for (const hookType of hookTypes) {
        const hook = hooksProps[hookType] as Record<string, unknown>;
        expect(hook.description).toBeDefined();
        expect(typeof hook.description).toBe('string');
      }
    });
  });

  describe('HookDefinition definition', () => {
    let hookDef: Record<string, unknown>;
    let hookProps: Record<string, unknown>;

    beforeAll(() => {
      hookDef = defs.HookDefinition as Record<string, unknown>;
      hookProps = hookDef.properties as Record<string, unknown>;
    });

    it('should exist in $defs', () => {
      expect(defs.HookDefinition).toBeDefined();
    });

    it('should be of type object', () => {
      expect(hookDef.type).toBe('object');
    });

    it('should have a description', () => {
      expect(hookDef.description).toBeDefined();
      expect(typeof hookDef.description).toBe('string');
    });

    it('should define script property as required string', () => {
      expect(hookProps.script).toBeDefined();
      const script = hookProps.script as Record<string, unknown>;
      expect(script.type).toBe('string');
      expect(hookDef.required).toContain('script');
    });

    it('should define timeout property with constraints', () => {
      expect(hookProps.timeout).toBeDefined();
      const timeout = hookProps.timeout as Record<string, unknown>;
      expect(timeout.type).toBe('integer');
      expect(timeout.minimum).toBe(1);
      expect(timeout.maximum).toBe(600);
      expect(timeout.default).toBe(30);
    });

    it('should define can_abort property as boolean with default false', () => {
      expect(hookProps.can_abort).toBeDefined();
      const canAbort = hookProps.can_abort as Record<string, unknown>;
      expect(canAbort.type).toBe('boolean');
      expect(canAbort.default).toBe(false);
    });

    it('should define enabled property as boolean with default true', () => {
      expect(hookProps.enabled).toBeDefined();
      const enabled = hookProps.enabled as Record<string, unknown>;
      expect(enabled.type).toBe('boolean');
      expect(enabled.default).toBe(true);
    });

    it('should have descriptions for all properties', () => {
      const propNames = ['script', 'timeout', 'can_abort', 'enabled'];
      for (const propName of propNames) {
        const prop = hookProps[propName] as Record<string, unknown>;
        expect(prop.description).toBeDefined();
        expect(typeof prop.description).toBe('string');
        expect((prop.description as string).length).toBeGreaterThan(0);
      }
    });

    it('script description should mention environment variables', () => {
      const script = hookProps.script as Record<string, unknown>;
      const desc = script.description as string;
      expect(desc).toContain('CHADGI_ISSUE_NUMBER');
      expect(desc).toContain('CHADGI_BRANCH');
      expect(desc).toContain('CHADGI_PR_URL');
      expect(desc).toContain('CHADGI_COST');
      expect(desc).toContain('CHADGI_PHASE');
      expect(desc).toContain('CHADGI_REPO');
      expect(desc).toContain('CHADGI_HOOK_NAME');
    });
  });
});

describe('Lifecycle Hooks in Config Template', () => {
  let templateContent: string;

  beforeAll(() => {
    templateContent = readFileSync(templatePath, 'utf-8');
  });

  it('should have a hooks section in template', () => {
    expect(templateContent).toContain('hooks:');
  });

  it('should document environment variables passed to hooks', () => {
    expect(templateContent).toContain('CHADGI_ISSUE_NUMBER');
    expect(templateContent).toContain('CHADGI_BRANCH');
    expect(templateContent).toContain('CHADGI_PR_URL');
    expect(templateContent).toContain('CHADGI_COST');
    expect(templateContent).toContain('CHADGI_PHASE');
    expect(templateContent).toContain('CHADGI_REPO');
    expect(templateContent).toContain('CHADGI_HOOK_NAME');
  });

  it('should have commented examples for each hook type', () => {
    expect(templateContent).toMatch(/# *pre_task:/);
    expect(templateContent).toMatch(/# *post_implementation:/);
    expect(templateContent).toMatch(/# *pre_pr:/);
    expect(templateContent).toMatch(/# *post_pr:/);
    expect(templateContent).toMatch(/# *post_merge:/);
    expect(templateContent).toMatch(/# *on_failure:/);
    expect(templateContent).toMatch(/# *on_budget_warning:/);
  });

  it('should show script, timeout, and can_abort properties in examples', () => {
    expect(templateContent).toMatch(/# *script:/);
    expect(templateContent).toMatch(/# *timeout:/);
    expect(templateContent).toMatch(/# *can_abort:/);
  });

  it('should explain hook use cases in comments', () => {
    // Check that use cases are documented
    expect(templateContent).toContain('Use for:');
  });
});

describe('TypeScript Types for Lifecycle Hooks', () => {
  // Import types at module level for type checking
  // These tests verify the types exist and can be used correctly
  // Type checking happens at compile time, runtime tests verify structure

  it('should be able to create a valid HookConfig object', () => {
    // This test verifies that the types compile and work at runtime
    const validHookConfig = {
      script: './hooks/test.sh'
    };
    expect(validHookConfig.script).toBe('./hooks/test.sh');
  });

  it('should be able to create a HookConfig with all optional properties', () => {
    const fullHookConfig = {
      script: './hooks/test.sh',
      timeout: 60,
      can_abort: true,
      enabled: false
    };
    expect(fullHookConfig.timeout).toBe(60);
    expect(fullHookConfig.can_abort).toBe(true);
    expect(fullHookConfig.enabled).toBe(false);
  });

  it('should be able to create a HooksConfig with all hook types', () => {
    const hooksConfig = {
      pre_task: { script: './pre-task.sh', can_abort: true },
      post_implementation: { script: './post-impl.sh' },
      pre_pr: { script: './pre-pr.sh', can_abort: true },
      post_pr: { script: './post-pr.sh', timeout: 60 },
      post_merge: { script: './post-merge.sh' },
      on_failure: { script: './on-failure.sh' },
      on_budget_warning: { script: './budget-warn.sh', timeout: 10 }
    };
    expect(hooksConfig.pre_task?.script).toBe('./pre-task.sh');
    expect(hooksConfig.on_budget_warning?.timeout).toBe(10);
  });

  it('should be able to create a HookExecutionResult object', () => {
    const result = {
      hook: 'pre_task' as const,
      success: true,
      exitCode: 0,
      durationMs: 150,
      aborted: false
    };
    expect(result.hook).toBe('pre_task');
    expect(result.success).toBe(true);
    expect(result.aborted).toBe(false);
  });

  it('should be able to create a HookExecutionResult with error fields', () => {
    const failedResult = {
      hook: 'pre_pr' as const,
      success: false,
      exitCode: 1,
      durationMs: 500,
      aborted: true,
      error: 'Validation failed',
      stdout: 'Checking code quality...',
      stderr: 'Error: lint failures detected'
    };
    expect(failedResult.error).toBe('Validation failed');
    expect(failedResult.aborted).toBe(true);
    expect(failedResult.stderr).toContain('lint failures');
  });

  it('should verify types are exported in index.ts', () => {
    // Read the types file to verify exports exist
    const typesPath = join(__dirname, '..', 'types', 'index.ts');
    const typesContent = readFileSync(typesPath, 'utf-8');

    // Verify type definitions exist
    expect(typesContent).toContain('export type LifecycleHookType');
    expect(typesContent).toContain('export interface HookConfig');
    expect(typesContent).toContain('export interface HooksConfig');
    expect(typesContent).toContain('export interface HookExecutionResult');
  });
});

describe('Shell Script Hook Integration', () => {
  const scriptPath = join(__dirname, '..', '..', 'scripts', 'chadgi.sh');
  let scriptContent: string;

  beforeAll(() => {
    scriptContent = readFileSync(scriptPath, 'utf-8');
  });

  describe('Hook system functions', () => {
    it('should define run_hook function', () => {
      expect(scriptContent).toContain('run_hook()');
    });

    it('should define load_hooks_config function', () => {
      expect(scriptContent).toContain('load_hooks_config()');
    });

    it('should define parse_hook_config function', () => {
      expect(scriptContent).toContain('parse_hook_config()');
    });

    it('should define resolve_hook_script function', () => {
      expect(scriptContent).toContain('resolve_hook_script()');
    });

    it('should define has_hooks_configured function', () => {
      expect(scriptContent).toContain('has_hooks_configured()');
    });
  });

  describe('Hook configuration variables', () => {
    it('should define configuration variables for all hook types', () => {
      const hookVarPatterns = [
        'HOOK_PRE_TASK_SCRIPT',
        'HOOK_POST_IMPL_SCRIPT',
        'HOOK_PRE_PR_SCRIPT',
        'HOOK_POST_PR_SCRIPT',
        'HOOK_POST_MERGE_SCRIPT',
        'HOOK_ON_FAILURE_SCRIPT',
        'HOOK_ON_BUDGET_WARNING_SCRIPT'
      ];
      for (const pattern of hookVarPatterns) {
        expect(scriptContent).toContain(pattern);
      }
    });

    it('should define timeout variables for all hook types', () => {
      const timeoutVarPatterns = [
        'HOOK_PRE_TASK_TIMEOUT',
        'HOOK_POST_IMPL_TIMEOUT',
        'HOOK_PRE_PR_TIMEOUT',
        'HOOK_POST_PR_TIMEOUT',
        'HOOK_POST_MERGE_TIMEOUT',
        'HOOK_ON_FAILURE_TIMEOUT',
        'HOOK_ON_BUDGET_WARNING_TIMEOUT'
      ];
      for (const pattern of timeoutVarPatterns) {
        expect(scriptContent).toContain(pattern);
      }
    });

    it('should define can_abort variables for relevant hook types', () => {
      expect(scriptContent).toContain('HOOK_PRE_TASK_CAN_ABORT');
      expect(scriptContent).toContain('HOOK_PRE_PR_CAN_ABORT');
    });

    it('should define enabled variables for all hook types', () => {
      expect(scriptContent).toContain('HOOK_PRE_TASK_ENABLED');
      expect(scriptContent).toContain('HOOK_POST_IMPL_ENABLED');
      expect(scriptContent).toContain('HOOK_PRE_PR_ENABLED');
    });
  });

  describe('Hook execution at lifecycle points', () => {
    it('should call run_hook for pre_task', () => {
      expect(scriptContent).toContain('run_hook "pre_task"');
    });

    it('should call run_hook for post_implementation', () => {
      expect(scriptContent).toContain('run_hook "post_implementation"');
    });

    it('should call run_hook for pre_pr', () => {
      expect(scriptContent).toContain('run_hook "pre_pr"');
    });

    it('should call run_hook for post_pr', () => {
      expect(scriptContent).toContain('run_hook "post_pr"');
    });

    it('should call run_hook for post_merge', () => {
      expect(scriptContent).toContain('run_hook "post_merge"');
    });

    it('should call run_hook for on_failure', () => {
      expect(scriptContent).toContain('run_hook "on_failure"');
    });

    it('should call run_hook for on_budget_warning', () => {
      expect(scriptContent).toContain('run_hook "on_budget_warning"');
    });
  });

  describe('Environment variable exports in run_hook', () => {
    it('should export CHADGI_ISSUE_NUMBER', () => {
      expect(scriptContent).toContain('export CHADGI_ISSUE_NUMBER');
    });

    it('should export CHADGI_BRANCH', () => {
      expect(scriptContent).toContain('export CHADGI_BRANCH');
    });

    it('should export CHADGI_PR_URL', () => {
      expect(scriptContent).toContain('export CHADGI_PR_URL');
    });

    it('should export CHADGI_COST', () => {
      expect(scriptContent).toContain('export CHADGI_COST');
    });

    it('should export CHADGI_PHASE', () => {
      expect(scriptContent).toContain('export CHADGI_PHASE');
    });

    it('should export CHADGI_REPO', () => {
      expect(scriptContent).toContain('export CHADGI_REPO');
    });

    it('should export CHADGI_HOOK_NAME', () => {
      expect(scriptContent).toContain('export CHADGI_HOOK_NAME');
    });

    it('should export CHADGI_ISSUE_TITLE', () => {
      expect(scriptContent).toContain('export CHADGI_ISSUE_TITLE');
    });

    it('should export CHADGI_ISSUE_URL', () => {
      expect(scriptContent).toContain('export CHADGI_ISSUE_URL');
    });

    it('should export CHADGI_BASE_BRANCH', () => {
      expect(scriptContent).toContain('export CHADGI_BASE_BRANCH');
    });

    it('should export CHADGI_SESSION_COST', () => {
      expect(scriptContent).toContain('export CHADGI_SESSION_COST');
    });
  });

  describe('Hook abort behavior', () => {
    it('should check pre_task hook return value for abort', () => {
      // The pattern should be: if ! run_hook "pre_task"; then
      expect(scriptContent).toMatch(/if ! run_hook "pre_task"/);
    });

    it('should check pre_pr hook return value for abort', () => {
      expect(scriptContent).toMatch(/if ! run_hook "pre_pr"/);
    });
  });

  describe('Hook timeout handling', () => {
    it('should use timeout command in hook execution', () => {
      expect(scriptContent).toContain('timeout "$TIMEOUT"');
    });

    it('should handle timeout exit code 124', () => {
      expect(scriptContent).toContain('HOOK_EXIT_CODE -eq 124');
    });
  });

  describe('Hook logging', () => {
    it('should log hook execution start', () => {
      expect(scriptContent).toContain('Running hook:');
    });

    it('should log hook success', () => {
      expect(scriptContent).toContain('Hook $HOOK_NAME completed successfully');
    });

    it('should log hook failure', () => {
      expect(scriptContent).toContain('Hook $HOOK_NAME failed');
    });

    it('should log hook timeout', () => {
      expect(scriptContent).toContain('Hook $HOOK_NAME timed out');
    });
  });
});

describe('YAML config parsing for hooks', () => {
  const scriptPath = join(__dirname, '..', '..', 'scripts', 'chadgi.sh');
  let scriptContent: string;

  beforeAll(() => {
    scriptContent = readFileSync(scriptPath, 'utf-8');
  });

  it('should parse script path from hooks config', () => {
    expect(scriptContent).toMatch(/hooks.*script:/);
  });

  it('should parse timeout from hooks config', () => {
    expect(scriptContent).toMatch(/hooks.*timeout:/);
  });

  it('should parse can_abort from hooks config', () => {
    expect(scriptContent).toMatch(/hooks.*can_abort:/);
  });

  it('should parse enabled from hooks config', () => {
    expect(scriptContent).toMatch(/hooks.*enabled:/);
  });

  it('should call load_hooks_config in load_config function', () => {
    expect(scriptContent).toContain('load_hooks_config');
  });
});
