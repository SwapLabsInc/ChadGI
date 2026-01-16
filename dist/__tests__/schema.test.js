/**
 * Unit tests for schemas/chadgi-config.schema.json
 *
 * Tests the JSON schema structure, validates schema syntax,
 * and ensures all configuration options are covered.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Read schema file once for all tests
const schemaPath = join(__dirname, '..', '..', 'schemas', 'chadgi-config.schema.json');
const templatePath = join(__dirname, '..', '..', 'templates', 'chadgi-config.yaml');
describe('chadgi-config.schema.json', () => {
    let schema;
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
        let properties;
        beforeAll(() => {
            properties = schema.properties;
        });
        it('should define extends and base_config for inheritance', () => {
            expect(properties.extends).toBeDefined();
            expect(properties.base_config).toBeDefined();
        });
        it('should define task_source with enum values', () => {
            const taskSource = properties.task_source;
            expect(taskSource).toBeDefined();
            expect(taskSource.enum).toEqual(['github-issues', 'local-file', 'manual']);
        });
        it('should define template path properties', () => {
            expect(properties.prompt_template).toBeDefined();
            expect(properties.generate_template).toBeDefined();
            expect(properties.progress_file).toBeDefined();
        });
        it('should define poll_interval with minimum constraint', () => {
            const pollInterval = properties.poll_interval;
            expect(pollInterval).toBeDefined();
            expect(pollInterval.type).toBe('integer');
            expect(pollInterval.minimum).toBe(1);
        });
        it('should define on_empty_queue with enum values', () => {
            const onEmptyQueue = properties.on_empty_queue;
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
        let defs;
        beforeAll(() => {
            defs = schema.$defs;
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
        let githubConfig;
        beforeAll(() => {
            const defs = schema.$defs;
            githubConfig = defs.GitHubConfig;
        });
        it('should define repo with pattern constraint', () => {
            const props = githubConfig.properties;
            const repo = props.repo;
            expect(repo.pattern).toBeDefined();
            expect(repo.pattern).toContain('/');
        });
        it('should define project_number allowing integer or string', () => {
            const props = githubConfig.properties;
            const projectNumber = props.project_number;
            expect(projectNumber.type).toEqual(['integer', 'string']);
        });
        it('should define column name properties', () => {
            const props = githubConfig.properties;
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
        let iterationConfig;
        let iterationProps;
        beforeAll(() => {
            const defs = schema.$defs;
            iterationConfig = defs.IterationConfig;
            iterationProps = iterationConfig.properties;
        });
        it('should define max_iterations with bounds', () => {
            const maxIterations = iterationProps.max_iterations;
            expect(maxIterations.type).toBe('integer');
            expect(maxIterations.minimum).toBe(1);
            expect(maxIterations.maximum).toBe(100);
        });
        it('should define on_max_iterations with enum values', () => {
            const onMaxIterations = iterationProps.on_max_iterations;
            expect(onMaxIterations.enum).toContain('skip');
            expect(onMaxIterations.enum).toContain('rollback');
            expect(onMaxIterations.enum).toContain('retry-later');
            expect(onMaxIterations.enum).toContain('fail');
        });
        it('should define gigachad_mode as boolean', () => {
            const gigachadMode = iterationProps.gigachad_mode;
            expect(gigachadMode.type).toBe('boolean');
            expect(gigachadMode.default).toBe(false);
        });
        it('should define retry_backoff with enum values', () => {
            const retryBackoff = iterationProps.retry_backoff;
            expect(retryBackoff.enum).toEqual(['fixed', 'linear', 'exponential']);
        });
        it('should require max_iterations', () => {
            expect(iterationConfig.required).toContain('max_iterations');
        });
    });
    describe('BudgetConfig schema', () => {
        let budgetProps;
        beforeAll(() => {
            const defs = schema.$defs;
            const budgetConfig = defs.BudgetConfig;
            budgetProps = budgetConfig.properties;
        });
        it('should define per_task_limit with minimum 0', () => {
            const perTaskLimit = budgetProps.per_task_limit;
            expect(perTaskLimit.type).toBe('number');
            expect(perTaskLimit.minimum).toBe(0);
        });
        it('should define on_task_budget_exceeded with enum', () => {
            const onExceeded = budgetProps.on_task_budget_exceeded;
            expect(onExceeded.enum).toEqual(['skip', 'fail', 'warn']);
        });
        it('should define on_session_budget_exceeded with enum', () => {
            const onExceeded = budgetProps.on_session_budget_exceeded;
            expect(onExceeded.enum).toEqual(['stop', 'warn']);
        });
        it('should define warning_threshold with bounds 0-100', () => {
            const threshold = budgetProps.warning_threshold;
            expect(threshold.type).toBe('integer');
            expect(threshold.minimum).toBe(0);
            expect(threshold.maximum).toBe(100);
        });
    });
    describe('OutputConfig schema', () => {
        let outputProps;
        beforeAll(() => {
            const defs = schema.$defs;
            const outputConfig = defs.OutputConfig;
            outputProps = outputConfig.properties;
        });
        it('should define log_level with enum values', () => {
            const logLevel = outputProps.log_level;
            expect(logLevel.enum).toEqual(['DEBUG', 'INFO', 'WARN', 'ERROR']);
        });
        it('should define truncate_length with minimum', () => {
            const truncateLength = outputProps.truncate_length;
            expect(truncateLength.type).toBe('integer');
            expect(truncateLength.minimum).toBe(10);
        });
        it('should define max_log_size_mb with minimum', () => {
            const maxLogSize = outputProps.max_log_size_mb;
            expect(maxLogSize.type).toBe('integer');
            expect(maxLogSize.minimum).toBe(1);
        });
    });
    describe('NotificationsConfig schema', () => {
        let notificationsConfig;
        let notificationsProps;
        beforeAll(() => {
            const defs = schema.$defs;
            notificationsConfig = defs.NotificationsConfig;
            notificationsProps = notificationsConfig.properties;
        });
        it('should define enabled as boolean', () => {
            const enabled = notificationsProps.enabled;
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
        let eventsProps;
        beforeAll(() => {
            const defs = schema.$defs;
            const eventsConfig = defs.NotificationEvents;
            eventsProps = eventsConfig.properties;
        });
        it('should define all notification event types', () => {
            expect(eventsProps.task_started).toBeDefined();
            expect(eventsProps.task_completed).toBeDefined();
            expect(eventsProps.task_failed).toBeDefined();
            expect(eventsProps.gigachad_merge).toBeDefined();
            expect(eventsProps.session_ended).toBeDefined();
        });
        it('should define events as booleans with default true', () => {
            const taskStarted = eventsProps.task_started;
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
            const properties = schema.properties;
            for (const [key, value] of Object.entries(properties)) {
                const prop = value;
                // $ref properties get descriptions from the referenced definition
                if (!prop.$ref) {
                    expect(prop.description).toBeDefined();
                    expect(typeof prop.description).toBe('string');
                    expect(prop.description.length).toBeGreaterThan(0);
                }
            }
        });
        it('should have descriptions for GitHubConfig properties', () => {
            const defs = schema.$defs;
            const githubConfig = defs.GitHubConfig;
            const props = githubConfig.properties;
            for (const [key, value] of Object.entries(props)) {
                const prop = value;
                expect(prop.description).toBeDefined();
                expect(typeof prop.description).toBe('string');
            }
        });
        it('should have descriptions for IterationConfig properties', () => {
            const defs = schema.$defs;
            const iterationConfig = defs.IterationConfig;
            const props = iterationConfig.properties;
            for (const [key, value] of Object.entries(props)) {
                const prop = value;
                expect(prop.description).toBeDefined();
                expect(typeof prop.description).toBe('string');
            }
        });
        it('should have descriptions for BudgetConfig properties', () => {
            const defs = schema.$defs;
            const budgetConfig = defs.BudgetConfig;
            const props = budgetConfig.properties;
            for (const [key, value] of Object.entries(props)) {
                const prop = value;
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
            const templateSchemaUrl = schemaUrlMatch[1];
            expect(schema.$id).toBe(templateSchemaUrl);
        });
    });
});
describe('schema coverage of config template', () => {
    let schema;
    let templateContent;
    beforeAll(() => {
        const schemaContent = readFileSync(schemaPath, 'utf-8');
        schema = JSON.parse(schemaContent);
        templateContent = readFileSync(templatePath, 'utf-8');
    });
    it('should cover all top-level keys from template', () => {
        const properties = schema.properties;
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
        const defs = schema.$defs;
        const githubConfig = defs.GitHubConfig;
        const githubProps = Object.keys(githubConfig.properties);
        // Extract github section keys from template
        const githubSectionMatch = templateContent.match(/github:\n((?:  [a-z_]+:.*\n)+)/);
        expect(githubSectionMatch).not.toBeNull();
        const githubKeys = githubSectionMatch[1]
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.trim().split(':')[0]);
        for (const key of githubKeys) {
            expect(githubProps).toContain(key);
        }
    });
    it('should cover iteration section keys from template', () => {
        const defs = schema.$defs;
        const iterationConfig = defs.IterationConfig;
        const iterationProps = Object.keys(iterationConfig.properties);
        // Extract iteration section keys from template
        const iterationSectionMatch = templateContent.match(/iteration:\n((?:  [a-z_]+:.*\n)+)/);
        expect(iterationSectionMatch).not.toBeNull();
        const iterationKeys = iterationSectionMatch[1]
            .split('\n')
            .filter(line => line.trim() && !line.trim().startsWith('#'))
            .map(line => line.trim().split(':')[0]);
        for (const key of iterationKeys) {
            expect(iterationProps).toContain(key);
        }
    });
    it('should cover budget section keys from template', () => {
        const defs = schema.$defs;
        const budgetConfig = defs.BudgetConfig;
        const budgetProps = Object.keys(budgetConfig.properties);
        // Extract budget section keys from template (allowing for comment lines)
        const budgetSectionMatch = templateContent.match(/budget:\n((?:  (?:[a-z_]+:.*|#.*)\n)+)/);
        expect(budgetSectionMatch).not.toBeNull();
        const budgetKeys = budgetSectionMatch[1]
            .split('\n')
            .filter(line => line.trim() && !line.trim().startsWith('#'))
            .map(line => line.trim().split(':')[0]);
        for (const key of budgetKeys) {
            expect(budgetProps).toContain(key);
        }
    });
});
//# sourceMappingURL=schema.test.js.map