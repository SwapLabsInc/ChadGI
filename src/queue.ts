import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { colors } from './utils/colors.js';
import { parseYamlValue, parseYamlNested, parseYamlBoolean } from './utils/config.js';

// Queue task from GitHub project board
interface QueueTask {
  number: number;
  title: string;
  url: string;
  itemId: string;
  category?: string;
  priority?: number;
  priorityName?: string;
  labels?: string[];
  dependencies?: number[];
  dependencyStatus?: 'resolved' | 'blocked';
  blockingIssues?: number[];
}

// Queue result for JSON output
interface QueueResult {
  readyColumn: string;
  taskCount: number;
  tasks: QueueTask[];
}

// Skip/Promote result
interface ActionResult {
  success: boolean;
  action: 'skip' | 'promote';
  issueNumber: number;
  message: string;
  targetColumn?: string;
}

interface QueueOptions {
  config?: string;
  json?: boolean;
  limit?: number;
}

interface QueueSkipOptions extends QueueOptions {
  issueNumber: number;
}

interface QueuePromoteOptions extends QueueOptions {
  issueNumber: number;
}

// Parse dependency patterns from config
function parseDependencyPatterns(content: string): string[] {
  const value = parseYamlValue(content, 'dependency_patterns');
  if (value) {
    return value.split(/\s+/).filter(p => p.length > 0);
  }
  return ['depends on', 'blocked by', 'requires'];
}

// Parse priority labels from config
function parsePriorityLabels(content: string, level: string): string[] {
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
  const defaults: Record<string, string[]> = {
    critical: ['priority:critical', 'p0', 'urgent'],
    high: ['priority:high', 'p1'],
    normal: ['priority:normal', 'p2'],
    low: ['priority:low', 'p3', 'backlog'],
  };
  return defaults[level] || [];
}

// Parse category mappings from config
function parseCategoryMappings(content: string): Record<string, string[]> {
  const mappings: Record<string, string[]> = {};
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
function getIssueLabels(issueNumber: number, repo: string): string[] {
  try {
    const output = execSync(
      `gh issue view ${issueNumber} --repo "${repo}" --json labels -q '.labels[].name'`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return output.trim().split('\n').filter(l => l).map(l => l.toLowerCase());
  } catch {
    return [];
  }
}

// Get issue body from GitHub
function getIssueBody(issueNumber: number, repo: string): string {
  try {
    const output = execSync(
      `gh issue view ${issueNumber} --repo "${repo}" --json body -q '.body'`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return output.trim();
  } catch {
    return '';
  }
}

// Determine category from labels
function getCategoryFromLabels(labels: string[], mappings: Record<string, string[]>): string | undefined {
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
function getPriorityFromLabels(
  labels: string[],
  priorityLabels: { critical: string[]; high: string[]; normal: string[]; low: string[] }
): { priority: number; name: string } {
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
function parseDependencies(body: string, patterns: string[]): number[] {
  if (!body) return [];

  const deps: number[] = [];
  const patternRegex = patterns.map(p => p.replace(/\s+/g, '\\s+')).join('|');
  const regex = new RegExp(`(?:${patternRegex})\\s+#?(\\d+)(?:[,\\s]+(?:and\\s+)?#?(\\d+))*`, 'gi');

  let match;
  while ((match = regex.exec(body)) !== null) {
    // Extract all issue numbers from the match
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

// Check if an issue is completed (closed or in Done column)
function isIssueCompleted(issueNumber: number, repo: string, doneColumn: string, projectNumber: string, repoOwner: string): boolean {
  try {
    // Check if issue is closed
    const issueOutput = execSync(
      `gh issue view ${issueNumber} --repo "${repo}" --json state -q '.state'`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    if (issueOutput.trim() === 'CLOSED') {
      return true;
    }

    // Check if issue is in Done column
    const projectOutput = execSync(
      `gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const items = JSON.parse(projectOutput);
    for (const item of items.items || []) {
      if (item.content?.type === 'Issue' && item.content?.number === issueNumber) {
        return item.status === doneColumn;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Check dependency status for a task
function checkDependencyStatus(
  task: QueueTask,
  repo: string,
  doneColumn: string,
  projectNumber: string,
  repoOwner: string
): { status: 'resolved' | 'blocked'; blockingIssues: number[] } {
  if (!task.dependencies || task.dependencies.length === 0) {
    return { status: 'resolved', blockingIssues: [] };
  }

  const blocking: number[] = [];
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
function getQueueTasks(
  repo: string,
  projectNumber: string,
  readyColumn: string,
  doneColumn: string,
  configContent: string,
  checkDependencies: boolean
): QueueTask[] {
  const repoOwner = repo.split('/')[0];

  try {
    // Get all project items
    const output = execSync(
      `gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const items = JSON.parse(output);

    const tasks: QueueTask[] = [];
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
        const task: QueueTask = {
          number: item.content.number,
          title: item.content.title,
          url: item.content.url,
          itemId: item.id,
        };

        // Get additional details
        const labels = getIssueLabels(task.number, repo);
        task.labels = labels;
        task.category = getCategoryFromLabels(labels, categoryMappings);

        if (priorityEnabled) {
          const { priority, name } = getPriorityFromLabels(labels, priorityLabels);
          task.priority = priority;
          task.priorityName = name;
        }

        // Check dependencies
        if (dependenciesEnabled && checkDependencies) {
          const body = getIssueBody(task.number, repo);
          task.dependencies = parseDependencies(body, dependencyPatterns);

          if (task.dependencies.length > 0) {
            const depStatus = checkDependencyStatus(task, repo, doneColumn, projectNumber, repoOwner);
            task.dependencyStatus = depStatus.status;
            task.blockingIssues = depStatus.blockingIssues;
          } else {
            task.dependencyStatus = 'resolved';
            task.blockingIssues = [];
          }
        }

        tasks.push(task);
      }
    }

    // Sort by priority if enabled
    if (priorityEnabled) {
      tasks.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));
    }

    return tasks;
  } catch (error) {
    console.error(`Warning: Could not fetch tasks from project board: ${(error as Error).message}`);
    return [];
  }
}

// Get project board metadata (project ID, field IDs, option IDs)
function getProjectBoardMetadata(projectNumber: string, repoOwner: string): {
  projectId: string;
  statusFieldId: string;
  optionIds: Record<string, string>;
} | null {
  try {
    // Get project ID
    const projectOutput = execSync(
      `gh project list --owner "${repoOwner}" --format json`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const projects = JSON.parse(projectOutput);
    const project = projects.projects?.find((p: { number: number }) => p.number === parseInt(projectNumber, 10));

    if (!project) {
      return null;
    }

    const projectId = project.id;

    // Get field info
    const fieldOutput = execSync(
      `gh project field-list ${projectNumber} --owner "${repoOwner}" --format json`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const fields = JSON.parse(fieldOutput);
    const statusField = fields.fields?.find((f: { name: string }) => f.name === 'Status');

    if (!statusField) {
      return null;
    }

    const optionIds: Record<string, string> = {};
    for (const option of statusField.options || []) {
      optionIds[option.name] = option.id;
    }

    return {
      projectId,
      statusFieldId: statusField.id,
      optionIds,
    };
  } catch {
    return null;
  }
}

// Move an item to a different column
function moveItemToColumn(
  itemId: string,
  projectId: string,
  statusFieldId: string,
  optionId: string
): boolean {
  try {
    execSync(
      `gh project item-edit --project-id "${projectId}" --id "${itemId}" --field-id "${statusFieldId}" --single-select-option-id "${optionId}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch {
    return false;
  }
}

// Print queue in table format
function printQueue(tasks: QueueTask[], readyColumn: string, dependenciesEnabled: boolean): void {
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

  // Print header
  const hasCategory = tasks.some(t => t.category);
  const hasPriority = tasks.some(t => t.priorityName);

  let header = ` #   Issue   `;
  if (hasPriority) header += `Priority   `;
  if (hasCategory) header += `Category   `;
  header += `Title`;
  if (dependenciesEnabled) header += `                              Status`;

  console.log(`${colors.dim}${header}${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(Math.max(80, header.length))}${colors.reset}`);

  // Print tasks
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

    // Truncate title to fit
    const maxTitleLen = dependenciesEnabled ? 30 : 50;
    const title = task.title.length > maxTitleLen
      ? task.title.substring(0, maxTitleLen - 3) + '...'
      : task.title.padEnd(maxTitleLen);
    line += title;

    if (dependenciesEnabled) {
      if (task.dependencyStatus === 'blocked') {
        const blocking = task.blockingIssues?.map(n => `#${n}`).join(', ') || '';
        line += `  ${colors.red}blocked by ${blocking}${colors.reset}`;
      } else if (task.dependencies && task.dependencies.length > 0) {
        line += `  ${colors.green}deps resolved${colors.reset}`;
      }
    }

    console.log(line);
  });

  // Print commands
  console.log('');
  console.log(`${colors.dim}Commands:${colors.reset}`);
  console.log(`  ${colors.cyan}chadgi queue skip <issue-number>${colors.reset}      Move task to Backlog`);
  console.log(`  ${colors.cyan}chadgi queue promote <issue-number>${colors.reset}   Move task to front`);
  console.log(`  ${colors.cyan}chadgi start${colors.reset}                          Process queue`);
}

// List tasks in the queue
export async function queue(options: QueueOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const chadgiDir = dirname(configPath);

  // Check if .chadgi directory exists
  if (!existsSync(chadgiDir)) {
    console.error('Error: .chadgi directory not found.');
    console.error('Run `chadgi init` to initialize ChadGI in this directory.');
    process.exit(1);
  }

  // Load config
  let configContent = '';
  let repo = 'owner/repo';
  let projectNumber = '1';
  let readyColumn = 'Ready';
  let doneColumn = 'Done';

  if (existsSync(configPath)) {
    configContent = readFileSync(configPath, 'utf-8');
    repo = parseYamlNested(configContent, 'github', 'repo') || repo;
    projectNumber = parseYamlNested(configContent, 'github', 'project_number') || projectNumber;
    readyColumn = parseYamlNested(configContent, 'github', 'ready_column') || readyColumn;
    doneColumn = parseYamlNested(configContent, 'github', 'done_column') || doneColumn;
  } else {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }

  // Validate repo is configured
  if (repo === 'owner/repo') {
    console.error('Error: Repository not configured in chadgi-config.yaml');
    console.error('Please set github.repo in your configuration.');
    process.exit(1);
  }

  const dependenciesEnabled = parseYamlBoolean(configContent, 'dependencies', 'enabled');

  // Get tasks
  let tasks = getQueueTasks(repo, projectNumber, readyColumn, doneColumn, configContent, dependenciesEnabled);

  // Apply limit if specified
  if (options.limit && options.limit > 0) {
    tasks = tasks.slice(0, options.limit);
  }

  // Output as JSON if requested
  if (options.json) {
    const result: QueueResult = {
      readyColumn,
      taskCount: tasks.length,
      tasks,
    };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Print formatted queue
  printQueue(tasks, readyColumn, dependenciesEnabled);
}

// Skip a task (move to Backlog)
export async function queueSkip(options: QueueSkipOptions): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const chadgiDir = dirname(configPath);

  // Check if .chadgi directory exists
  if (!existsSync(chadgiDir)) {
    console.error('Error: .chadgi directory not found.');
    console.error('Run `chadgi init` to initialize ChadGI in this directory.');
    process.exit(1);
  }

  // Load config
  let repo = 'owner/repo';
  let projectNumber = '1';
  let readyColumn = 'Ready';

  if (existsSync(configPath)) {
    const configContent = readFileSync(configPath, 'utf-8');
    repo = parseYamlNested(configContent, 'github', 'repo') || repo;
    projectNumber = parseYamlNested(configContent, 'github', 'project_number') || projectNumber;
    readyColumn = parseYamlNested(configContent, 'github', 'ready_column') || readyColumn;
  } else {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }

  if (repo === 'owner/repo') {
    console.error('Error: Repository not configured in chadgi-config.yaml');
    process.exit(1);
  }

  const repoOwner = repo.split('/')[0];

  // Find the task in the Ready column
  try {
    const output = execSync(
      `gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const items = JSON.parse(output);

    const item = items.items?.find((i: { content?: { type: string; number: number }; status: string }) =>
      i.content?.type === 'Issue' &&
      i.content?.number === options.issueNumber &&
      i.status === readyColumn
    );

    if (!item) {
      const result: ActionResult = {
        success: false,
        action: 'skip',
        issueNumber: options.issueNumber,
        message: `Issue #${options.issueNumber} not found in ${readyColumn} column`,
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error(`${colors.red}Error:${colors.reset} Issue #${options.issueNumber} not found in ${readyColumn} column`);
      }
      process.exit(1);
    }

    // Get project metadata
    const metadata = getProjectBoardMetadata(projectNumber, repoOwner);
    if (!metadata) {
      console.error('Error: Could not get project board metadata');
      process.exit(1);
    }

    // Move to Backlog (clear the status to move out of board columns, or use a Backlog column if it exists)
    const backlogOptionId = metadata.optionIds['Backlog'];
    if (backlogOptionId) {
      const success = moveItemToColumn(item.id, metadata.projectId, metadata.statusFieldId, backlogOptionId);

      const result: ActionResult = {
        success,
        action: 'skip',
        issueNumber: options.issueNumber,
        message: success
          ? `Moved issue #${options.issueNumber} to Backlog`
          : `Failed to move issue #${options.issueNumber}`,
        targetColumn: 'Backlog',
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (success) {
        console.log(`${colors.green}Success:${colors.reset} Moved issue #${options.issueNumber} to Backlog`);
      } else {
        console.error(`${colors.red}Error:${colors.reset} Failed to move issue #${options.issueNumber}`);
        process.exit(1);
      }
    } else {
      // No Backlog column - try to remove from project or report error
      const result: ActionResult = {
        success: false,
        action: 'skip',
        issueNumber: options.issueNumber,
        message: 'Backlog column not found in project. Available columns: ' + Object.keys(metadata.optionIds).join(', '),
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error(`${colors.red}Error:${colors.reset} Backlog column not found in project.`);
        console.error(`Available columns: ${Object.keys(metadata.optionIds).join(', ')}`);
        console.error('Add a "Backlog" column to your project board to use the skip command.');
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Promote a task (move to front of queue)
export async function queuePromote(options: QueuePromoteOptions): Promise<void> {
  const cwd = process.cwd();
  const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
  const configPath = options.config ? resolve(options.config) : defaultConfigPath;
  const chadgiDir = dirname(configPath);

  // Check if .chadgi directory exists
  if (!existsSync(chadgiDir)) {
    console.error('Error: .chadgi directory not found.');
    console.error('Run `chadgi init` to initialize ChadGI in this directory.');
    process.exit(1);
  }

  // Load config
  let configContent = '';
  let repo = 'owner/repo';
  let projectNumber = '1';
  let readyColumn = 'Ready';

  if (existsSync(configPath)) {
    configContent = readFileSync(configPath, 'utf-8');
    repo = parseYamlNested(configContent, 'github', 'repo') || repo;
    projectNumber = parseYamlNested(configContent, 'github', 'project_number') || projectNumber;
    readyColumn = parseYamlNested(configContent, 'github', 'ready_column') || readyColumn;
  } else {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exit(1);
  }

  if (repo === 'owner/repo') {
    console.error('Error: Repository not configured in chadgi-config.yaml');
    process.exit(1);
  }

  const repoOwner = repo.split('/')[0];

  // Find the task in the Ready column
  try {
    const output = execSync(
      `gh project item-list ${projectNumber} --owner "${repoOwner}" --format json --limit 100`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const items = JSON.parse(output);

    const item = items.items?.find((i: { content?: { type: string; number: number }; status: string }) =>
      i.content?.type === 'Issue' &&
      i.content?.number === options.issueNumber &&
      i.status === readyColumn
    );

    if (!item) {
      const result: ActionResult = {
        success: false,
        action: 'promote',
        issueNumber: options.issueNumber,
        message: `Issue #${options.issueNumber} not found in ${readyColumn} column`,
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error(`${colors.red}Error:${colors.reset} Issue #${options.issueNumber} not found in ${readyColumn} column`);
      }
      process.exit(1);
    }

    // To promote a task, we add the critical priority label
    // This will make it appear first when the queue is sorted by priority
    const priorityEnabled = parseYamlBoolean(configContent, 'priority', 'enabled');

    if (!priorityEnabled) {
      const result: ActionResult = {
        success: false,
        action: 'promote',
        issueNumber: options.issueNumber,
        message: 'Priority-based ordering is not enabled. Enable priority in your config to use promote.',
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error(`${colors.yellow}Note:${colors.reset} Priority-based ordering is not enabled.`);
        console.error('Enable priority in your config to use the promote command:');
        console.error('  priority:');
        console.error('    enabled: true');
      }
      process.exit(1);
    }

    // Get the critical priority labels
    const criticalLabels = parsePriorityLabels(configContent, 'critical');
    const labelToAdd = criticalLabels[0] || 'priority:critical';

    // Add the priority label to the issue
    try {
      execSync(
        `gh issue edit ${options.issueNumber} --repo "${repo}" --add-label "${labelToAdd}"`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const result: ActionResult = {
        success: true,
        action: 'promote',
        issueNumber: options.issueNumber,
        message: `Promoted issue #${options.issueNumber} by adding "${labelToAdd}" label`,
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`${colors.green}Success:${colors.reset} Promoted issue #${options.issueNumber} to front of queue`);
        console.log(`${colors.dim}Added label: ${labelToAdd}${colors.reset}`);
      }
    } catch (labelError) {
      const result: ActionResult = {
        success: false,
        action: 'promote',
        issueNumber: options.issueNumber,
        message: `Failed to add priority label: ${(labelError as Error).message}`,
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error(`${colors.red}Error:${colors.reset} Failed to add priority label`);
        console.error(`You can manually promote by adding the "${labelToAdd}" label to issue #${options.issueNumber}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  }
}
