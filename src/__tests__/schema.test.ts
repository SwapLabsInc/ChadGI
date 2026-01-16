/**
 * Unit tests for schemas/chadgi-config.schema.json
 *
 * Tests the JSON schema structure, validates schema syntax,
 * and ensures all configuration options are covered.
 */

import { jest } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read schema file once for all tests
const schemaPath = join(__dirname, '..', '..', 'schemas', 'chadgi-config.schema.json');
const templatePath = join(__dirname, '..', '..', 'templates', 'chadgi-config.yaml');

describe('chadgi-config.schema.json', () => {
  let schema: Record<string, unknown>;

  beforeAll(() => {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent);
  });

  describe('schema file structure', () => {
    it('should exist at the expected path', () => {
      expect(existsSync(schemaPath)).toBe(true);
    });

    it('should be valid JSON', () => {
      expect(() => {
        const content = readFileSync(schemaPath, 'utf-8');
        JSON.parse(content);
      }).not.toThrow();
    });

    it('should have a valid $schema property', () => {
      expect(schema.$schema).toBeDefined();
      expect(schema.$schema).toContain('json-schema.org');
    });

    it('should have a $id property pointing to the published schema URL', () => {
      expect(schema.$id).toBeDefined();
      expect(schema.$id).toContain('SwapLabsInc/ChadGI');
      expect(schema.$id).toContain('chadgi-config.schema.json');
    });

    it('should have title and description', () => {
      expect(schema.title).toBeDefined();
      expect(schema.description).toBeDefined();
      expect(typeof schema.title).toBe('string');
      expect(typeof schema.description).toBe('string');
    });

    it('should be of type object', () => {
      expect(schema.type).toBe('object');
    });
  });

  describe('top-level properties', () => {
    let properties: Record<string, unknown>;

    beforeAll(() => {
      properties = schema.properties as Record<string, unknown>;
    });

    it('should define extends and base_config for inheritance', () => {
      expect(properties.extends).toBeDefined();
      expect(properties.base_config).toBeDefined();
    });

    it('should define task_source with enum values', () => {
      const taskSource = properties.task_source as Record<string, unknown>;
      expect(taskSource).toBeDefined();
      expect(taskSource.enum).toEqual(['github-issues', 'local-file', 'manual']);
    });

    it('should define template path properties', () => {
      expect(properties.prompt_template).toBeDefined();
      expect(properties.generate_template).toBeDefined();
      expect(properties.progress_file).toBeDefined();
    });

    it('should define poll_interval with minimum constraint', () => {
      const pollInterval = properties.poll_interval as Record<string, unknown>;
      expect(pollInterval).toBeDefined();
      expect(pollInterval.type).toBe('integer');
      expect(pollInterval.minimum).toBe(1);
    });

    it('should define on_empty_queue with enum values', () => {
      const onEmptyQueue = properties.on_empty_queue as Record<string, unknown>;
      expect(onEmptyQueue).toBeDefined();
      expect(onEmptyQueue.enum).toEqual(['generate', 'wait', 'exit']);
    });

    it('should define all major config sections', () => {
      expect(properties.github).toBeDefined();
      expect(properties.branch).toBeDefined();
      expect(properties.iteration).toBeDefined();
      expect(properties.output).toBeDefined();
      expect(properties.budget).toBeDefined();
      expect(properties.notifications).toBeDefined();
      expect(properties.branding).toBeDefined();
      expect(properties.priority).toBeDefined();
      expect(properties.category).toBeDefined();
      expect(properties.dependencies).toBeDefined();
    });
  });

  describe('$defs section', () => {
    let defs: Record<string, unknown>;

    beforeAll(() => {
      defs = schema.$defs as Record<string, unknown>;
    });

    it('should define all required sub-schemas', () => {
      expect(defs.GitHubConfig).toBeDefined();
      expect(defs.BranchConfig).toBeDefined();
      expect(defs.IterationConfig).toBeDefined();
      expect(defs.OutputConfig).toBeDefined();
      expect(defs.BudgetConfig).toBeDefined();
      expect(defs.NotificationsConfig).toBeDefined();
      expect(defs.BrandingConfig).toBeDefined();
      expect(defs.PriorityConfig).toBeDefined();
      expect(defs.CategoryConfig).toBeDefined();
      expect(defs.DependenciesConfig).toBeDefined();
    });

    it('should define webhook-related sub-schemas', () => {
      expect(defs.RateLimitConfig).toBeDefined();
      expect(defs.WebhookProviderConfig).toBeDefined();
      expect(defs.GenericWebhookConfig).toBeDefined();
      expect(defs.NotificationEvents).toBeDefined();
    });
  });

  describe('GitHubConfig schema', () => {
    let githubConfig: Record<string, unknown>;

    beforeAll(() => {
      const defs = schema.$defs as Record<string, unknown>;
      githubConfig = defs.GitHubConfig as Record<string, unknown>;
    });

    it('should define repo with pattern constraint', () => {
      const props = githubConfig.properties as Record<string, unknown>;
      const repo = props.repo as Record<string, unknown>;
      expect(repo.pattern).toBeDefined();
      expect(repo.pattern).toContain('/');
    });

    it('should define project_number allowing integer or string', () => {
      const props = githubConfig.properties as Record<string, unknown>;
      const projectNumber = props.project_number as Record<string, unknown>;
      expect(projectNumber.type).toEqual(['integer', 'string']);
    });

    it('should define column name properties', () => {
      const props = githubConfig.properties as Record<string, unknown>;
      expect(props.ready_column).toBeDefined();
      expect(props.in_progress_column).toBeDefined();
      expect(props.review_column).toBeDefined();
      expect(props.done_column).toBeDefined();
    });

    it('should require repo and project_number', () => {
      expect(githubConfig.required).toContain('repo');
      expect(githubConfig.required).toContain('project_number');
    });
  });

  describe('IterationConfig schema', () => {
    let iterationConfig: Record<string, unknown>;
    let iterationProps: Record<string, unknown>;

    beforeAll(() => {
      const defs = schema.$defs as Record<string, unknown>;
      iterationConfig = defs.IterationConfig as Record<string, unknown>;
      iterationProps = iterationConfig.properties as Record<string, unknown>;
    });

    it('should define max_iterations with bounds', () => {
      const maxIterations = iterationProps.max_iterations as Record<string, unknown>;
      expect(maxIterations.type).toBe('integer');
      expect(maxIterations.minimum).toBe(1);
      expect(maxIterations.maximum).toBe(100);
    });

    it('should define on_max_iterations with enum values', () => {
      const onMaxIterations = iterationProps.on_max_iterations as Record<string, unknown>;
      expect(onMaxIterations.enum).toContain('skip');
      expect(onMaxIterations.enum).toContain('rollback');
      expect(onMaxIterations.enum).toContain('retry-later');
      expect(onMaxIterations.enum).toContain('fail');
    });

    it('should define gigachad_mode as boolean', () => {
      const gigachadMode = iterationProps.gigachad_mode as Record<string, unknown>;
      expect(gigachadMode.type).toBe('boolean');
      expect(gigachadMode.default).toBe(false);
    });

    it('should define retry_backoff with enum values', () => {
      const retryBackoff = iterationProps.retry_backoff as Record<string, unknown>;
      expect(retryBackoff.enum).toEqual(['fixed', 'linear', 'exponential']);
    });

    it('should require max_iterations', () => {
      expect(iterationConfig.required).toContain('max_iterations');
    });
  });

  describe('BudgetConfig schema', () => {
    let budgetProps: Record<string, unknown>;

    beforeAll(() => {
      const defs = schema.$defs as Record<string, unknown>;
      const budgetConfig = defs.BudgetConfig as Record<string, unknown>;
      budgetProps = budgetConfig.properties as Record<string, unknown>;
    });

    it('should define per_task_limit with minimum 0', () => {
      const perTaskLimit = budgetProps.per_task_limit as Record<string, unknown>;
      expect(perTaskLimit.type).toBe('number');
      expect(perTaskLimit.minimum).toBe(0);
    });

    it('should define on_task_budget_exceeded with enum', () => {
      const onExceeded = budgetProps.on_task_budget_exceeded as Record<string, unknown>;
      expect(onExceeded.enum).toEqual(['skip', 'fail', 'warn']);
    });

    it('should define on_session_budget_exceeded with enum', () => {
      const onExceeded = budgetProps.on_session_budget_exceeded as Record<string, unknown>;
      expect(onExceeded.enum).toEqual(['stop', 'warn']);
    });

    it('should define warning_threshold with bounds 0-100', () => {
      const threshold = budgetProps.warning_threshold as Record<string, unknown>;
      expect(threshold.type).toBe('integer');
      expect(threshold.minimum).toBe(0);
      expect(threshold.maximum).toBe(100);
    });
  });

  describe('OutputConfig schema', () => {
    let outputProps: Record<string, unknown>;

    beforeAll(() => {
      const defs = schema.$defs as Record<string, unknown>;
      const outputConfig = defs.OutputConfig as Record<string, unknown>;
      outputProps = outputConfig.properties as Record<string, unknown>;
    });

    it('should define log_level with enum values', () => {
      const logLevel = outputProps.log_level as Record<string, unknown>;
      expect(logLevel.enum).toEqual(['DEBUG', 'INFO', 'WARN', 'ERROR']);
    });

    it('should define truncate_length with minimum', () => {
      const truncateLength = outputProps.truncate_length as Record<string, unknown>;
      expect(truncateLength.type).toBe('integer');
      expect(truncateLength.minimum).toBe(10);
    });

    it('should define max_log_size_mb with minimum', () => {
      const maxLogSize = outputProps.max_log_size_mb as Record<string, unknown>;
      expect(maxLogSize.type).toBe('integer');
      expect(maxLogSize.minimum).toBe(1);
    });
  });

  describe('NotificationsConfig schema', () => {
    let notificationsConfig: Record<string, unknown>;
    let notificationsProps: Record<string, unknown>;

    beforeAll(() => {
      const defs = schema.$defs as Record<string, unknown>;
      notificationsConfig = defs.NotificationsConfig as Record<string, unknown>;
      notificationsProps = notificationsConfig.properties as Record<string, unknown>;
    });

    it('should define enabled as boolean', () => {
      const enabled = notificationsProps.enabled as Record<string, unknown>;
      expect(enabled.type).toBe('boolean');
      expect(enabled.default).toBe(false);
    });

    it('should reference rate_limit, slack, discord, and generic configs', () => {
      expect(notificationsProps.rate_limit).toBeDefined();
      expect(notificationsProps.slack).toBeDefined();
      expect(notificationsProps.discord).toBeDefined();
      expect(notificationsProps.generic).toBeDefined();
    });
  });

  describe('NotificationEvents schema', () => {
    let eventsProps: Record<string, unknown>;

    beforeAll(() => {
      const defs = schema.$defs as Record<string, unknown>;
      const eventsConfig = defs.NotificationEvents as Record<string, unknown>;
      eventsProps = eventsConfig.properties as Record<string, unknown>;
    });

    it('should define all notification event types', () => {
      expect(eventsProps.task_started).toBeDefined();
      expect(eventsProps.task_completed).toBeDefined();
      expect(eventsProps.task_failed).toBeDefined();
      expect(eventsProps.gigachad_merge).toBeDefined();
      expect(eventsProps.session_ended).toBeDefined();
    });

    it('should define events as booleans with default true', () => {
      const taskStarted = eventsProps.task_started as Record<string, unknown>;
      expect(taskStarted.type).toBe('boolean');
      expect(taskStarted.default).toBe(true);
    });
  });

  describe('required fields', () => {
    it('should require github, branch, and iteration sections', () => {
      expect(schema.required).toContain('github');
      expect(schema.required).toContain('branch');
      expect(schema.required).toContain('iteration');
    });
  });

  describe('field descriptions for IDE hover documentation', () => {
    it('should have descriptions for all top-level properties', () => {
      const properties = schema.properties as Record<string, unknown>;
      for (const [key, value] of Object.entries(properties)) {
        const prop = value as Record<string, unknown>;
        // $ref properties get descriptions from the referenced definition
        if (!prop.$ref) {
          expect(prop.description).toBeDefined();
          expect(typeof prop.description).toBe('string');
          expect((prop.description as string).length).toBeGreaterThan(0);
        }
      }
    });

    it('should have descriptions for GitHubConfig properties', () => {
      const defs = schema.$defs as Record<string, unknown>;
      const githubConfig = defs.GitHubConfig as Record<string, unknown>;
      const props = githubConfig.properties as Record<string, unknown>;

      for (const [key, value] of Object.entries(props)) {
        const prop = value as Record<string, unknown>;
        expect(prop.description).toBeDefined();
        expect(typeof prop.description).toBe('string');
      }
    });

    it('should have descriptions for IterationConfig properties', () => {
      const defs = schema.$defs as Record<string, unknown>;
      const iterationConfig = defs.IterationConfig as Record<string, unknown>;
      const props = iterationConfig.properties as Record<string, unknown>;

      for (const [key, value] of Object.entries(props)) {
        const prop = value as Record<string, unknown>;
        expect(prop.description).toBeDefined();
        expect(typeof prop.description).toBe('string');
      }
    });

    it('should have descriptions for BudgetConfig properties', () => {
      const defs = schema.$defs as Record<string, unknown>;
      const budgetConfig = defs.BudgetConfig as Record<string, unknown>;
      const props = budgetConfig.properties as Record<string, unknown>;

      for (const [key, value] of Object.entries(props)) {
        const prop = value as Record<string, unknown>;
        expect(prop.description).toBeDefined();
        expect(typeof prop.description).toBe('string');
      }
    });
  });

  describe('template file integration', () => {
    it('should have yaml-language-server schema reference in template', () => {
      expect(existsSync(templatePath)).toBe(true);
      const templateContent = readFileSync(templatePath, 'utf-8');
      expect(templateContent).toContain('# yaml-language-server: $schema=');
      expect(templateContent).toContain('chadgi-config.schema.json');
    });

    it('schema URL in template should match schema $id', () => {
      const templateContent = readFileSync(templatePath, 'utf-8');
      const schemaUrlMatch = templateContent.match(/\$schema=([^\s]+)/);
      expect(schemaUrlMatch).not.toBeNull();
      const templateSchemaUrl = schemaUrlMatch![1];
      expect(schema.$id).toBe(templateSchemaUrl);
    });
  });
});

describe('schema coverage of config template', () => {
  let schema: Record<string, unknown>;
  let templateContent: string;

  beforeAll(() => {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent);
    templateContent = readFileSync(templatePath, 'utf-8');
  });

  it('should cover all top-level keys from template', () => {
    const properties = schema.properties as Record<string, unknown>;
    const topLevelKeys = Object.keys(properties);

    // Extract top-level keys from YAML template (lines that start with a letter and end with :)
    const templateTopLevelKeys = templateContent
      .split('\n')
      .filter(line => /^[a-z_]+:/.test(line))
      .map(line => line.split(':')[0]);

    for (const key of templateTopLevelKeys) {
      expect(topLevelKeys).toContain(key);
    }
  });

  it('should cover github section keys from template', () => {
    const defs = schema.$defs as Record<string, unknown>;
    const githubConfig = defs.GitHubConfig as Record<string, unknown>;
    const githubProps = Object.keys(githubConfig.properties as Record<string, unknown>);

    // Extract github section keys from template
    const githubSectionMatch = templateContent.match(/github:\n((?:  [a-z_]+:.*\n)+)/);
    expect(githubSectionMatch).not.toBeNull();

    const githubKeys = githubSectionMatch![1]
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.trim().split(':')[0]);

    for (const key of githubKeys) {
      expect(githubProps).toContain(key);
    }
  });

  it('should cover iteration section keys from template', () => {
    const defs = schema.$defs as Record<string, unknown>;
    const iterationConfig = defs.IterationConfig as Record<string, unknown>;
    const iterationProps = Object.keys(iterationConfig.properties as Record<string, unknown>);

    // Extract iteration section keys from template
    const iterationSectionMatch = templateContent.match(/iteration:\n((?:  [a-z_]+:.*\n)+)/);
    expect(iterationSectionMatch).not.toBeNull();

    const iterationKeys = iterationSectionMatch![1]
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('#'))
      .map(line => line.trim().split(':')[0]);

    for (const key of iterationKeys) {
      expect(iterationProps).toContain(key);
    }
  });

  it('should cover budget section keys from template', () => {
    const defs = schema.$defs as Record<string, unknown>;
    const budgetConfig = defs.BudgetConfig as Record<string, unknown>;
    const budgetProps = Object.keys(budgetConfig.properties as Record<string, unknown>);

    // Extract budget section keys from template (allowing for comment lines)
    const budgetSectionMatch = templateContent.match(/budget:\n((?:  (?:[a-z_]+:.*|#.*)\n)+)/);
    expect(budgetSectionMatch).not.toBeNull();

    const budgetKeys = budgetSectionMatch![1]
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('#'))
      .map(line => line.trim().split(':')[0]);

    for (const key of budgetKeys) {
      expect(budgetProps).toContain(key);
    }
  });
});
