/**
 * Queue command implementation using the middleware system.
 *
 * This is a refactored version of queue.ts that demonstrates the middleware
 * pattern for commands that need configuration loading.
 */
import { execSync } from 'child_process';
// Import middleware utilities
import { withCommand, withDirectory, withDirectoryValidation, withConfig, 
// JSON output utilities
createJsonResponse, } from './utils/index.js';
import { colors } from './utils/colors.js';
import { parseYamlValue, parseYamlBoolean } from './utils/config.js';
// Parse dependency patterns from config
function parseDependencyPatterns(content) {
    const value = parseYamlValue(content, 'dependency_patterns');
    if (value) {
        return value.split(/\s+/).filter(p => p.length > 0);
    }
    return ['depends on', 'blocked by', 'requires'];
}
// Parse priority labels from config
function parsePriorityLabels(content, level) {
    const lines = content.split('\n');
    let inPriority = false;
    let inLabels = false;
    for (const line of lines) {
        if (line.match(/^priority:/)) {
            inPriority = true;
            continue;
        }
        if (inPriority && line.match(/^\s+labels:/)) {
            inLabels = true;
            continue;
        }
        if (inPriority && line.match(/^[a-z]/)) {
            inPriority = false;
            inLabels = false;
        }
        if (inLabels && line.match(new RegExp(`^\\s+${level}:`))) {
            const match = line.match(/\[([^\]]+)\]/);
            if (match) {
                return match[1].split(',').map(l => l.trim().replace(/["']/g, '').toLowerCase());
            }
        }
    }
    // Default priority labels
    const defaults = {
        critical: ['priority:critical', 'p0', 'urgent'],
        high: ['priority:high', 'p1'],
        normal: ['priority:normal', 'p2'],
        low: ['priority:low', 'p3', 'backlog'],
    };
    return defaults[level] || [];
}
// Parse category mappings from config
function parseCategoryMappings(content) {
    const mappings = {};
    const lines = content.split('\n');
    let inCategory = false;
    let inMappings = false;
    for (const line of lines) {
        if (line.match(/^category:/)) {
            inCategory = true;
            continue;
        }
        if (inCategory && line.match(/^\s+mappings:/)) {
            inMappings = true;
            continue;
        }
        if (inCategory && line.match(/^[a-z]/)) {
            inCategory = false;
            inMappings = false;
        }
        if (inMappings) {
            const match = line.match(/^\s+(\w+):\s*\[([^\]]+)\]/);
            if (match) {
                const category = match[1];
                const labels = match[2].split(',').map(l => l.trim().replace(/["']/g, '').toLowerCase());
                mappings[category] = labels;
            }
        }
    }
    // Default mappings
    if (Object.keys(mappings).length === 0) {
        return {
            bug: ['bug', 'bugfix', 'fix', 'hotfix'],
            feature: ['feature', 'enhancement', 'new-feature'],
            refactor: ['refactor', 'refactoring', 'cleanup', 'tech-debt'],
            docs: ['docs', 'documentation'],
            test: ['test', 'testing', 'tests'],
            chore: ['chore', 'maintenance', 'ci', 'build'],
        };
    }
    return mappings;
}
// Get issue labels from GitHub
function getIssueLabels(issueNumber, repo) {
    try {
        const output = execSync(`gh issue view ${issueNumber} --repo "${repo}" --json labels -q '.labels[].name'`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return output.trim().split('\n').filter(l => l).map(l => l.toLowerCase());
    }
    catch {
        return [];
    }
}
// Get issue body from GitHub
function getIssueBody(issueNumber, repo) {
    try {
        const output = execSync(`gh issue view ${issueNumber} --repo "${repo}" --json body -q '.body'`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return output.trim();
    }
    catch {
        return '';
    }
}
// Determine category from labels
function getCategoryFromLabels(labels, mappings) {
    for (const [category, categoryLabels] of Object.entries(mappings)) {
        for (const label of labels) {
            if (categoryLabels.includes(label)) {
                return category;
            }
        }
    }
    return undefined;
}
// Determine priority from labels
function getPriorityFromLabels(labels, priorityLabels) {
    for (const label of labels) {
        if (priorityLabels.critical.includes(label)) {
            return { priority: 0, name: 'critical' };
        }
        if (priorityLabels.high.includes(label)) {
            return { priority: 1, name: 'high' };
        }
        if (priorityLabels.low.includes(label)) {
            return { priority: 3, name: 'low' };
        }
        if (priorityLabels.normal.includes(label)) {
            return { priority: 2, name: 'normal' };
        }
    }
    return { priority: 2, name: 'normal' };
}
// Parse dependencies from issue body
function parseDependencies(body, patterns) {
    if (!body)
        return [];
    const deps = [];
    const patternRegex = patterns.map(p => p.replace(/\s+/g, '\\s+')).join('|');
    const regex = new RegExp(`(?:${patternRegex})\\s+#?(\\d+)(?:[,\\s]+(?:and\\s+)?#?(\\d+))*`, 'gi');
    let match;
    while ((match = regex.exec(body)) !== null) {
        const issueRefs = match[0].match(/#?\d+/g);
        if (issueRefs) {
            for (const ref of issueRefs) {
                const num = parseInt(ref.replace('#', ''), 10);
                if (!isNaN(num) && !deps.includes(num)) {
                    deps.push(num);
                }
            }
        }
    }
    return deps;
}
// Check if an issue is completed
function isIssueCompleted(issueNumber, repo, doneColumn, projectNumber, repoOwner) {
    try {
        const issueOutput = execSync(`gh issue view ${issueNumber} --repo "${repo}" --json state -q '.state'`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        if (issueOutput.trim() === 'CLOSED') {
            return true;
        }
        const projectOutput = execSync(`gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const items = JSON.parse(projectOutput);
        for (const item of items.items || []) {
            if (item.content?.type === 'Issue' && item.content?.number === issueNumber) {
                return item.status === doneColumn;
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
// Check dependency status for a task
function checkDependencyStatus(task, repo, doneColumn, projectNumber, repoOwner) {
    if (!task.dependencies || task.dependencies.length === 0) {
        return { status: 'resolved', blockingIssues: [] };
    }
    const blocking = [];
    for (const dep of task.dependencies) {
        if (!isIssueCompleted(dep, repo, doneColumn, projectNumber, repoOwner)) {
            blocking.push(dep);
        }
    }
    return {
        status: blocking.length === 0 ? 'resolved' : 'blocked',
        blockingIssues: blocking,
    };
}
// Get tasks in the Ready column from GitHub project board
function getQueueTasks(repo, projectNumber, readyColumn, doneColumn, configContent, checkDependencies) {
    const repoOwner = repo.split('/')[0];
    try {
        const output = execSync(`gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const items = JSON.parse(output);
        const tasks = [];
        const categoryMappings = parseCategoryMappings(configContent);
        const priorityEnabled = parseYamlBoolean(configContent, 'priority', 'enabled');
        const dependenciesEnabled = parseYamlBoolean(configContent, 'dependencies', 'enabled');
        const dependencyPatterns = parseDependencyPatterns(configContent);
        const priorityLabels = {
            critical: parsePriorityLabels(configContent, 'critical'),
            high: parsePriorityLabels(configContent, 'high'),
            normal: parsePriorityLabels(configContent, 'normal'),
            low: parsePriorityLabels(configContent, 'low'),
        };
        for (const item of items.items || []) {
            if (item.status === readyColumn && item.content?.type === 'Issue') {
                const task = {
                    number: item.content.number,
                    title: item.content.title,
                    url: item.content.url,
                    itemId: item.id,
                };
                const labels = getIssueLabels(task.number, repo);
                task.labels = labels;
                task.category = getCategoryFromLabels(labels, categoryMappings);
                if (priorityEnabled) {
                    const { priority, name } = getPriorityFromLabels(labels, priorityLabels);
                    task.priority = priority;
                    task.priorityName = name;
                }
                if (dependenciesEnabled && checkDependencies) {
                    const body = getIssueBody(task.number, repo);
                    task.dependencies = parseDependencies(body, dependencyPatterns);
                    if (task.dependencies.length > 0) {
                        const depStatus = checkDependencyStatus(task, repo, doneColumn, projectNumber, repoOwner);
                        task.dependencyStatus = depStatus.status;
                        task.blockingIssues = depStatus.blockingIssues;
                    }
                    else {
                        task.dependencyStatus = 'resolved';
                        task.blockingIssues = [];
                    }
                }
                tasks.push(task);
            }
        }
        if (priorityEnabled) {
            tasks.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
        }
        return tasks;
    }
    catch (error) {
        console.error(`Warning: Could not fetch tasks from project board: ${error.message}`);
        return [];
    }
}
// Print queue in table format
function printQueue(tasks, readyColumn, dependenciesEnabled) {
    console.log(`${colors.purple}${colors.bold}`);
    console.log('ChadGI Task Queue');
    console.log('=================');
    console.log(`${colors.reset}`);
    console.log(`${colors.cyan}${readyColumn} column:${colors.reset} ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`);
    console.log('');
    if (tasks.length === 0) {
        console.log(`${colors.yellow}No tasks found in ${readyColumn} column.${colors.reset}`);
        console.log('Add issues to your project board and move them to "Ready" to see them here.');
        return;
    }
    const hasCategory = tasks.some(t => t.category);
    const hasPriority = tasks.some(t => t.priorityName);
    let header = ` #   Issue   `;
    if (hasPriority)
        header += `Priority   `;
    if (hasCategory)
        header += `Category   `;
    header += `Title`;
    if (dependenciesEnabled)
        header += `                              Status`;
    console.log(`${colors.dim}${header}${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(Math.max(80, header.length))}${colors.reset}`);
    tasks.forEach((task, index) => {
        const num = String(index + 1).padStart(2);
        const issueNum = `#${task.number}`.padEnd(6);
        let line = ` ${num}   ${issueNum}  `;
        if (hasPriority) {
            const priorityStr = (task.priorityName || 'normal').padEnd(9);
            const priorityColor = task.priorityName === 'critical' ? colors.red
                : task.priorityName === 'high' ? colors.yellow
                    : task.priorityName === 'low' ? colors.dim
                        : colors.reset;
            line += `${priorityColor}${priorityStr}${colors.reset}  `;
        }
        if (hasCategory) {
            const categoryStr = (task.category || '-').padEnd(9);
            line += `${colors.cyan}${categoryStr}${colors.reset}  `;
        }
        const maxTitleLen = dependenciesEnabled ? 30 : 50;
        const title = task.title.length > maxTitleLen
            ? task.title.substring(0, maxTitleLen - 3) + '...'
            : task.title.padEnd(maxTitleLen);
        line += title;
        if (dependenciesEnabled) {
            if (task.dependencyStatus === 'blocked') {
                const blocking = task.blockingIssues?.map(n => `#${n}`).join(', ') || '';
                line += `  ${colors.red}blocked by ${blocking}${colors.reset}`;
            }
            else if (task.dependencies && task.dependencies.length > 0) {
                line += `  ${colors.green}deps resolved${colors.reset}`;
            }
        }
        console.log(line);
    });
    console.log('');
    console.log(`${colors.dim}Commands:${colors.reset}`);
    console.log(`  ${colors.cyan}chadgi queue skip <issue-number>${colors.reset}      Move task to Backlog`);
    console.log(`  ${colors.cyan}chadgi queue promote <issue-number>${colors.reset}   Move task to front`);
    console.log(`  ${colors.cyan}chadgi start${colors.reset}                          Process queue`);
}
/**
 * Queue command handler using middleware pattern.
 *
 * Note how the handler receives config already loaded via the context:
 * - ctx.github contains the GitHub configuration
 * - ctx.configContent contains the raw YAML for additional parsing
 * - ctx.configExists indicates if config file was found
 */
async function queueHandler(ctx) {
    const { github, configContent, configExists, options } = ctx;
    // Validate repo is configured
    if (!configExists || github.repo === 'owner/repo') {
        console.error('Error: Repository not configured in chadgi-config.yaml');
        console.error('Please set github.repo in your configuration.');
        process.exit(1);
    }
    const dependenciesEnabled = parseYamlBoolean(configContent, 'dependencies', 'enabled');
    // Get tasks
    let tasks = getQueueTasks(github.repo, github.project_number, github.ready_column, github.done_column || 'Done', configContent, dependenciesEnabled);
    // Apply limit if specified
    if (options.limit && options.limit > 0) {
        tasks = tasks.slice(0, options.limit);
    }
    // For JSON output
    if (options.json) {
        const result = {
            readyColumn: github.ready_column,
            taskCount: tasks.length,
            tasks,
        };
        // Check if unified format is requested (opt-in)
        const useUnified = options.jsonUnified || process.env.CHADGI_JSON_UNIFIED === '1';
        if (useUnified) {
            const response = createJsonResponse({
                data: result,
                command: 'queue',
                startTime: ctx.startTime,
                pagination: {
                    total: tasks.length,
                    limit: options.limit,
                },
            });
            return { data: response };
        }
        // Legacy format (backwards compatible)
        return { data: result };
    }
    // Print formatted queue
    printQueue(tasks, github.ready_column, dependenciesEnabled);
    return { success: true };
}
/**
 * Queue command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 * 5. withDirectoryValidation - ensures .chadgi directory exists
 * 6. withConfig - loads configuration from file
 */
export const queueMiddleware = withCommand([withDirectory, withDirectoryValidation, withConfig], queueHandler);
//# sourceMappingURL=queue-middleware.js.map