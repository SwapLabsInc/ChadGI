import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, dirname, resolve, basename } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Read version from package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const CHADGI_VERSION = packageJson.version;
// Default workspace config filename
export const WORKSPACE_CONFIG_FILENAME = 'workspace.yaml';
export const WORKSPACE_DIR = '.chadgi';
// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
};
// Helper to parse simple YAML values
function parseYamlValue(content, key) {
    const regex = new RegExp(`^${key}:\\s*(.*)$`, 'm');
    const match = content.match(regex);
    if (match) {
        let value = match[1].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        return value || undefined;
    }
    return undefined;
}
// Parse YAML to object (simplified parser for workspace config)
function parseYamlToObject(content) {
    const result = {};
    const lines = content.split('\n');
    const stack = [{ obj: result, indent: -1 }];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip empty lines and comments
        if (!line.trim() || line.trim().startsWith('#')) {
            continue;
        }
        // Calculate indentation
        const indent = line.search(/\S/);
        const trimmed = line.trim();
        // Skip if no content
        if (!trimmed)
            continue;
        // Handle key: value pairs
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
            const key = trimmed.substring(0, colonIndex).trim();
            let value = trimmed.substring(colonIndex + 1).trim();
            // Handle quoted values first
            if ((value.startsWith('"') && value.includes('"', 1)) ||
                (value.startsWith("'") && value.includes("'", 1))) {
                const quoteChar = value[0];
                const endQuoteIndex = value.indexOf(quoteChar, 1);
                if (endQuoteIndex > 0) {
                    value = value.slice(1, endQuoteIndex);
                }
            }
            else {
                // Remove inline comments for unquoted values
                const commentIndex = value.indexOf('#');
                if (commentIndex > 0) {
                    value = value.substring(0, commentIndex).trim();
                }
            }
            // Pop from stack while indent is less than or equal to current parent
            while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
                stack.pop();
            }
            const parent = stack[stack.length - 1].obj;
            if (value === '') {
                // This is a nested object
                const newObj = {};
                parent[key] = newObj;
                stack.push({ obj: newObj, indent });
            }
            else if (value.startsWith('[') && value.endsWith(']')) {
                // Array value like ["a", "b", "c"]
                try {
                    parent[key] = JSON.parse(value);
                }
                catch {
                    parent[key] = value;
                }
            }
            else if (value === 'true') {
                parent[key] = true;
            }
            else if (value === 'false') {
                parent[key] = false;
            }
            else if (!isNaN(Number(value)) && value !== '') {
                parent[key] = Number(value);
            }
            else {
                parent[key] = value;
            }
        }
    }
    return result;
}
// Convert object to YAML string
function objectToYaml(obj, indent = 0) {
    const lines = [];
    const prefix = '  '.repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
            lines.push(`${prefix}${key}:`);
        }
        else if (typeof value === 'object' && !Array.isArray(value)) {
            lines.push(`${prefix}${key}:`);
            lines.push(objectToYaml(value, indent + 1));
        }
        else if (Array.isArray(value)) {
            // Format arrays as JSON-style inline
            const arrayStr = JSON.stringify(value);
            lines.push(`${prefix}${key}: ${arrayStr}`);
        }
        else if (typeof value === 'string') {
            // Quote strings that contain special characters
            if (value.includes(':') || value.includes('#') || value.includes('"') ||
                value.includes("'") || value.startsWith(' ') || value.endsWith(' ')) {
                lines.push(`${prefix}${key}: "${value.replace(/"/g, '\\"')}"`);
            }
            else if (value === '') {
                lines.push(`${prefix}${key}: ""`);
            }
            else {
                lines.push(`${prefix}${key}: ${value}`);
            }
        }
        else {
            lines.push(`${prefix}${key}: ${value}`);
        }
    }
    return lines.filter(l => l !== '').join('\n');
}
// Detect repository from git remote
function detectRepository() {
    try {
        const remoteUrl = execSync('git remote get-url origin', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
        if (match) {
            return match[1].replace(/\.git$/, '');
        }
    }
    catch {
        // Not in a git repo or no origin
    }
    return null;
}
// Get the default workspace config path
export function getWorkspaceConfigPath(options) {
    const cwd = process.cwd();
    if (options?.config) {
        return resolve(options.config);
    }
    return join(cwd, WORKSPACE_DIR, WORKSPACE_CONFIG_FILENAME);
}
// Load workspace configuration
export function loadWorkspaceConfig(configPath) {
    if (!existsSync(configPath)) {
        return null;
    }
    try {
        const content = readFileSync(configPath, 'utf-8');
        const parsed = parseYamlToObject(content);
        // Ensure repos is an object
        if (!parsed.repos) {
            parsed.repos = {};
        }
        return parsed;
    }
    catch (err) {
        console.error(`${colors.red}Error:${colors.reset} Failed to parse workspace config: ${err.message}`);
        return null;
    }
}
// Save workspace configuration
export function saveWorkspaceConfig(configPath, config) {
    const configDir = dirname(configPath);
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }
    // Update timestamp
    config.updated_at = new Date().toISOString();
    // Generate YAML content with header comment
    const yamlContent = `# ChadGI Workspace Configuration
# Multi-repository workspace for ChadGI task automation
# Generated by ChadGI v${CHADGI_VERSION}

${objectToYaml(config)}
`;
    writeFileSync(configPath, yamlContent);
}
// Create readline interface
function createReadlineInterface() {
    return createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}
// Prompt user for input
async function prompt(rl, question) {
    return new Promise((resolve) => {
        rl.question(`${question}: `, (answer) => {
            resolve(answer.trim());
        });
    });
}
// Validate that a path is a valid ChadGI repository
export function validateRepoPath(repoPath) {
    if (!existsSync(repoPath)) {
        return { valid: false, error: `Path does not exist: ${repoPath}` };
    }
    const stat = statSync(repoPath);
    if (!stat.isDirectory()) {
        return { valid: false, error: `Path is not a directory: ${repoPath}` };
    }
    // Check for .chadgi directory
    const chadgiDir = join(repoPath, '.chadgi');
    if (!existsSync(chadgiDir)) {
        return { valid: false, error: `Not a ChadGI project (missing .chadgi directory): ${repoPath}` };
    }
    // Check for config file
    const configFile = join(chadgiDir, 'chadgi-config.yaml');
    if (!existsSync(configFile)) {
        return { valid: false, error: `Missing chadgi-config.yaml in ${chadgiDir}` };
    }
    return { valid: true };
}
// Get GitHub repo info from local path
function getRepoInfoFromPath(repoPath) {
    try {
        const remoteUrl = execSync('git remote get-url origin', {
            encoding: 'utf-8',
            cwd: repoPath,
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
        const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
        if (match) {
            return {
                repo: match[1].replace(/\.git$/, ''),
                remote: remoteUrl
            };
        }
        return { remote: remoteUrl };
    }
    catch {
        return {};
    }
}
// Get tasks from a repository's queue
async function getRepoTasks(repoPath, limit) {
    const chadgiDir = join(repoPath, '.chadgi');
    const configPath = join(chadgiDir, 'chadgi-config.yaml');
    if (!existsSync(configPath)) {
        return [];
    }
    const configContent = readFileSync(configPath, 'utf-8');
    const parsed = parseYamlToObject(configContent);
    const github = parsed.github;
    if (!github) {
        return [];
    }
    const repo = github.repo;
    const projectNumber = github.project_number;
    const readyColumn = github.ready_column || 'Ready';
    if (!repo || !projectNumber) {
        return [];
    }
    try {
        // Get project items using gh CLI
        const query = `
      query($repo: String!, $owner: String!, $number: Int!) {
        repository(name: $repo, owner: $owner) {
          projectV2(number: $number) {
            items(first: 50) {
              nodes {
                fieldValueByName(name: "Status") {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                  }
                }
                content {
                  ... on Issue {
                    number
                    title
                    labels(first: 10) {
                      nodes { name }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
        const [owner, repoName] = repo.split('/');
        const result = execSync(`gh api graphql -f query='${query.replace(/'/g, "'\\''")}' -F owner='${owner}' -F repo='${repoName}' -F number=${projectNumber}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const data = JSON.parse(result);
        const items = data.data?.repository?.projectV2?.items?.nodes || [];
        const tasks = [];
        for (const item of items) {
            const statusValue = item.fieldValueByName?.name;
            if (statusValue === readyColumn && item.content?.number) {
                const task = {
                    issueNumber: item.content.number,
                    title: item.content.title || `Issue #${item.content.number}`,
                    priority: undefined,
                    category: undefined,
                };
                // Parse labels for priority and category
                const labels = item.content?.labels?.nodes || [];
                for (const label of labels) {
                    const labelName = label.name?.toLowerCase() || '';
                    if (labelName.includes('critical') || labelName.includes('p0')) {
                        task.priority = 'critical';
                    }
                    else if (labelName.includes('high') || labelName.includes('p1')) {
                        task.priority = task.priority || 'high';
                    }
                    else if (labelName.includes('low') || labelName.includes('p3')) {
                        task.priority = task.priority || 'low';
                    }
                    if (labelName.includes('bug')) {
                        task.category = 'bug';
                    }
                    else if (labelName.includes('feature') || labelName.includes('enhancement')) {
                        task.category = task.category || 'feature';
                    }
                    else if (labelName.includes('refactor')) {
                        task.category = task.category || 'refactor';
                    }
                }
                tasks.push(task);
            }
        }
        if (limit && tasks.length > limit) {
            return tasks.slice(0, limit);
        }
        return tasks;
    }
    catch {
        return [];
    }
}
// Initialize a new workspace
export async function workspaceInit(options = {}) {
    const configPath = getWorkspaceConfigPath(options);
    const configDir = dirname(configPath);
    console.log(`\n${colors.bold}${colors.magenta}ChadGI Workspace Init${colors.reset}\n`);
    // Check if workspace already exists
    if (existsSync(configPath) && !options.force) {
        console.error(`${colors.red}Error:${colors.reset} Workspace already exists at ${configPath}`);
        console.log(`Use ${colors.cyan}--force${colors.reset} to overwrite.`);
        process.exit(1);
    }
    // Create default workspace configuration
    const workspaceName = options.name || basename(process.cwd()) + '-workspace';
    const config = {
        version: CHADGI_VERSION,
        name: workspaceName,
        description: 'Multi-repository ChadGI workspace',
        strategy: 'round-robin',
        repos: {},
        settings: {
            auto_clone: false,
            parallel_validation: true,
            aggregate_stats: true,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
    // Check if current directory is a ChadGI project
    const currentRepo = detectRepository();
    const currentChadgiConfig = join(process.cwd(), '.chadgi', 'chadgi-config.yaml');
    if (existsSync(currentChadgiConfig) && currentRepo) {
        console.log(`${colors.cyan}Detected current repository:${colors.reset} ${currentRepo}`);
        const rl = createReadlineInterface();
        try {
            const addCurrent = await prompt(rl, 'Add current repository to workspace? [Y/n]');
            if (addCurrent.toLowerCase() !== 'n') {
                config.repos[currentRepo] = {
                    path: process.cwd(),
                    enabled: true,
                    priority: 1,
                };
                console.log(`${colors.green}Added:${colors.reset} ${currentRepo}`);
            }
        }
        finally {
            rl.close();
        }
    }
    // Save workspace config
    saveWorkspaceConfig(configPath, config);
    console.log(`\n${colors.green}Workspace initialized!${colors.reset}`);
    console.log(`Configuration saved to: ${colors.cyan}${configPath}${colors.reset}`);
    console.log(`\nNext steps:`);
    console.log(`  ${colors.dim}1.${colors.reset} Add repositories: ${colors.cyan}chadgi workspace add <path-or-repo>${colors.reset}`);
    console.log(`  ${colors.dim}2.${colors.reset} View workspace: ${colors.cyan}chadgi workspace list${colors.reset}`);
    console.log(`  ${colors.dim}3.${colors.reset} Start processing: ${colors.cyan}chadgi start --workspace${colors.reset}`);
}
// Add a repository to the workspace
export async function workspaceAdd(repo, options = {}) {
    const configPath = getWorkspaceConfigPath(options);
    console.log(`\n${colors.bold}${colors.magenta}ChadGI Workspace Add${colors.reset}\n`);
    // Load existing workspace config
    const config = loadWorkspaceConfig(configPath);
    if (!config) {
        console.error(`${colors.red}Error:${colors.reset} Workspace not initialized.`);
        console.log(`Run ${colors.cyan}chadgi workspace init${colors.reset} first.`);
        process.exit(1);
    }
    // Determine if repo is a path or a GitHub repo reference
    let repoPath;
    let repoName;
    let remoteUrl;
    if (repo.includes('/') && !existsSync(repo)) {
        // Looks like a GitHub repo reference (owner/repo)
        repoName = repo;
        if (options.path) {
            repoPath = resolve(options.path);
        }
        else {
            // Default to a directory named after the repo
            repoPath = resolve(repo.split('/')[1]);
        }
        // Clone if doesn't exist
        if (!existsSync(repoPath)) {
            if (options.remote) {
                remoteUrl = options.remote;
            }
            else {
                remoteUrl = `https://github.com/${repo}.git`;
            }
            console.log(`${colors.cyan}Cloning repository...${colors.reset}`);
            try {
                execSync(`git clone ${remoteUrl} ${repoPath}`, {
                    stdio: 'inherit'
                });
                console.log(`${colors.green}Cloned to:${colors.reset} ${repoPath}`);
            }
            catch (err) {
                console.error(`${colors.red}Error:${colors.reset} Failed to clone repository`);
                process.exit(1);
            }
        }
    }
    else {
        // Treat as a local path
        repoPath = resolve(repo);
        // Get repo info from git
        const repoInfo = getRepoInfoFromPath(repoPath);
        repoName = repoInfo.repo || basename(repoPath);
        remoteUrl = repoInfo.remote;
    }
    // Validate the repository
    const validation = validateRepoPath(repoPath);
    if (!validation.valid) {
        console.error(`${colors.red}Error:${colors.reset} ${validation.error}`);
        console.log(`\nMake sure the repository has been initialized with ${colors.cyan}chadgi init${colors.reset}`);
        process.exit(1);
    }
    // Check if already in workspace
    if (config.repos[repoName]) {
        console.log(`${colors.yellow}Warning:${colors.reset} Repository ${repoName} already in workspace.`);
        console.log(`Updating configuration...`);
    }
    // Add to workspace
    const repoConfig = {
        path: repoPath,
        remote: remoteUrl,
        enabled: options.enabled !== false,
        priority: options.priority ?? (Object.keys(config.repos).length + 1),
    };
    config.repos[repoName] = repoConfig;
    // Save config
    saveWorkspaceConfig(configPath, config);
    console.log(`${colors.green}Added repository:${colors.reset} ${repoName}`);
    console.log(`  Path: ${repoPath}`);
    if (remoteUrl) {
        console.log(`  Remote: ${remoteUrl}`);
    }
    console.log(`  Priority: ${repoConfig.priority}`);
    console.log(`  Enabled: ${repoConfig.enabled}`);
}
// Remove a repository from the workspace
export async function workspaceRemove(repo, options = {}) {
    const configPath = getWorkspaceConfigPath(options);
    console.log(`\n${colors.bold}${colors.magenta}ChadGI Workspace Remove${colors.reset}\n`);
    // Load existing workspace config
    const config = loadWorkspaceConfig(configPath);
    if (!config) {
        console.error(`${colors.red}Error:${colors.reset} Workspace not initialized.`);
        console.log(`Run ${colors.cyan}chadgi workspace init${colors.reset} first.`);
        process.exit(1);
    }
    // Find the repo by name or path
    let repoName;
    if (config.repos[repo]) {
        repoName = repo;
    }
    else {
        // Try to find by path
        const resolvedPath = resolve(repo);
        for (const [name, repoConfig] of Object.entries(config.repos)) {
            if (repoConfig.path === resolvedPath) {
                repoName = name;
                break;
            }
        }
    }
    if (!repoName) {
        console.error(`${colors.red}Error:${colors.reset} Repository not found in workspace: ${repo}`);
        console.log(`\nCurrent repositories:`);
        for (const name of Object.keys(config.repos)) {
            console.log(`  - ${name}`);
        }
        process.exit(1);
    }
    // Confirm removal unless force flag
    if (!options.force) {
        const rl = createReadlineInterface();
        try {
            const confirm = await prompt(rl, `Remove ${repoName} from workspace? [y/N]`);
            if (confirm.toLowerCase() !== 'y') {
                console.log('Cancelled.');
                return;
            }
        }
        finally {
            rl.close();
        }
    }
    // Remove from workspace
    delete config.repos[repoName];
    // Save config
    saveWorkspaceConfig(configPath, config);
    console.log(`${colors.green}Removed:${colors.reset} ${repoName}`);
    console.log(`\n${colors.dim}Note: The repository files were not deleted. Only removed from workspace config.${colors.reset}`);
}
// List repositories in the workspace
export async function workspaceList(options = {}) {
    const configPath = getWorkspaceConfigPath(options);
    // Load workspace config
    const config = loadWorkspaceConfig(configPath);
    if (!config) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'Workspace not initialized' }, null, 2));
        }
        else {
            console.error(`${colors.red}Error:${colors.reset} Workspace not initialized.`);
            console.log(`Run ${colors.cyan}chadgi workspace init${colors.reset} first.`);
        }
        process.exit(1);
    }
    const repos = Object.entries(config.repos);
    if (options.json) {
        const result = {
            success: true,
            workspace: {
                name: config.name,
                strategy: config.strategy,
                version: config.version,
                repo_count: repos.length,
            },
            repos: repos.map(([name, repoConfig]) => {
                const validation = validateRepoPath(repoConfig.path);
                return {
                    name,
                    path: repoConfig.path,
                    remote: repoConfig.remote,
                    enabled: repoConfig.enabled !== false,
                    priority: repoConfig.priority,
                    valid: validation.valid,
                    error: validation.error,
                };
            }),
        };
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log(`\n${colors.bold}==========================================================`);
    console.log(`                  CHADGI WORKSPACE`);
    console.log(`==========================================================${colors.reset}\n`);
    console.log(`${colors.cyan}Workspace:${colors.reset} ${config.name || 'Unnamed'}`);
    console.log(`${colors.cyan}Strategy:${colors.reset} ${config.strategy}`);
    console.log(`${colors.cyan}Repositories:${colors.reset} ${repos.length}`);
    if (repos.length === 0) {
        console.log(`\n${colors.dim}No repositories configured.${colors.reset}`);
        console.log(`Add repositories with: ${colors.cyan}chadgi workspace add <path-or-repo>${colors.reset}`);
        return;
    }
    console.log(`\n${colors.bold}Repositories${colors.reset}`);
    console.log('─'.repeat(70));
    // Sort by priority
    const sortedRepos = [...repos].sort((a, b) => {
        const priorityA = a[1].priority ?? 999;
        const priorityB = b[1].priority ?? 999;
        return priorityA - priorityB;
    });
    for (const [name, repoConfig] of sortedRepos) {
        const validation = validateRepoPath(repoConfig.path);
        const statusIcon = validation.valid ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
        const enabledStr = repoConfig.enabled !== false ? '' : `${colors.dim}(disabled)${colors.reset}`;
        console.log(`\n${statusIcon} ${colors.bold}${name}${colors.reset} ${enabledStr}`);
        console.log(`  ${colors.dim}Path:${colors.reset} ${repoConfig.path}`);
        if (repoConfig.remote) {
            console.log(`  ${colors.dim}Remote:${colors.reset} ${repoConfig.remote}`);
        }
        console.log(`  ${colors.dim}Priority:${colors.reset} ${repoConfig.priority ?? 'default'}`);
        if (!validation.valid) {
            console.log(`  ${colors.red}Error:${colors.reset} ${validation.error}`);
        }
    }
    console.log('\n' + '─'.repeat(70));
}
// Show workspace status with combined queue view
export async function workspaceStatus(options = {}) {
    const configPath = getWorkspaceConfigPath(options);
    // Load workspace config
    const config = loadWorkspaceConfig(configPath);
    if (!config) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'Workspace not initialized' }, null, 2));
        }
        else {
            console.error(`${colors.red}Error:${colors.reset} Workspace not initialized.`);
            console.log(`Run ${colors.cyan}chadgi workspace init${colors.reset} first.`);
        }
        process.exit(1);
    }
    const repos = Object.entries(config.repos).filter(([, repoConfig]) => repoConfig.enabled !== false);
    // Gather tasks from all repos
    const allTasks = [];
    for (const [repoName, repoConfig] of repos) {
        const validation = validateRepoPath(repoConfig.path);
        if (!validation.valid)
            continue;
        const tasks = await getRepoTasks(repoConfig.path, options.limit);
        for (const task of tasks) {
            allTasks.push({
                repo: repoName,
                ...task,
            });
        }
    }
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    allTasks.sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        return pa - pb;
    });
    if (options.json) {
        const result = {
            success: true,
            workspace: {
                name: config.name,
                strategy: config.strategy,
                active_repos: repos.length,
            },
            queue: {
                total_tasks: allTasks.length,
                tasks: allTasks,
            },
        };
        console.log(JSON.stringify(result, null, 2));
        return;
    }
    console.log(`\n${colors.bold}==========================================================`);
    console.log(`                CHADGI WORKSPACE STATUS`);
    console.log(`==========================================================${colors.reset}\n`);
    console.log(`${colors.cyan}Workspace:${colors.reset} ${config.name || 'Unnamed'}`);
    console.log(`${colors.cyan}Active Repositories:${colors.reset} ${repos.length}`);
    console.log(`${colors.cyan}Total Tasks:${colors.reset} ${allTasks.length}`);
    if (allTasks.length === 0) {
        console.log(`\n${colors.dim}No tasks in queue across all repositories.${colors.reset}`);
        return;
    }
    console.log(`\n${colors.bold}Combined Task Queue${colors.reset}`);
    console.log('─'.repeat(80));
    // Header
    console.log(`${colors.dim} #   Repository${' '.repeat(20)}Issue   Priority   Category   Title${colors.reset}`);
    console.log('─'.repeat(80));
    const displayTasks = options.limit ? allTasks.slice(0, options.limit) : allTasks;
    for (let i = 0; i < displayTasks.length; i++) {
        const task = displayTasks[i];
        const num = String(i + 1).padStart(2, ' ');
        const repoShort = task.repo.length > 25 ? task.repo.slice(0, 22) + '...' : task.repo.padEnd(25);
        const issueNum = String('#' + task.issueNumber).padEnd(7);
        const priority = (task.priority || 'normal').padEnd(10);
        const category = (task.category || '-').padEnd(10);
        const title = task.title.length > 30 ? task.title.slice(0, 27) + '...' : task.title;
        // Color priority
        let priorityColored = priority;
        if (task.priority === 'critical') {
            priorityColored = `${colors.red}${priority}${colors.reset}`;
        }
        else if (task.priority === 'high') {
            priorityColored = `${colors.yellow}${priority}${colors.reset}`;
        }
        console.log(` ${num}  ${repoShort} ${issueNum} ${priorityColored} ${category} ${title}`);
    }
    if (allTasks.length > displayTasks.length) {
        console.log(`\n${colors.dim}... and ${allTasks.length - displayTasks.length} more tasks${colors.reset}`);
    }
    console.log('\n' + '─'.repeat(80));
    console.log(`\nRun ${colors.cyan}chadgi start --workspace${colors.reset} to process tasks across all repositories.`);
}
//# sourceMappingURL=workspace.js.map