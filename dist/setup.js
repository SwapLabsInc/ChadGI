import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { colors } from './utils/colors.js';
import { parseYamlNested } from './utils/config.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function execCommandSilent(command) {
    try {
        return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }
    catch {
        return null;
    }
}
function detectRepository() {
    const remoteUrl = execCommandSilent('git remote get-url origin');
    if (remoteUrl) {
        const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
        if (match) {
            return match[1].replace(/\.git$/, '');
        }
    }
    return null;
}
async function listGitHubProjects(owner) {
    const result = execCommandSilent(`gh project list --owner "${owner}" --format json`);
    if (!result) {
        return [];
    }
    try {
        const data = JSON.parse(result);
        return data.projects.map((p) => ({
            number: p.number,
            title: p.title,
            url: p.url,
        }));
    }
    catch {
        return [];
    }
}
async function validateProjectColumns(owner, projectNumber) {
    const result = execCommandSilent(`gh project field-list ${projectNumber} --owner "${owner}" --format json`);
    if (!result) {
        return { valid: false, columns: [], missing: [] };
    }
    try {
        const data = JSON.parse(result);
        const statusField = data.fields.find((f) => f.name === 'Status');
        if (!statusField) {
            return { valid: false, columns: [], missing: ['Status field not found'] };
        }
        const existingOptions = statusField.options?.map((o) => o.name) || [];
        const requiredColumns = ['Ready', 'In progress', 'In review'];
        const missing = requiredColumns.filter(col => !existingOptions.includes(col));
        return {
            valid: missing.length === 0,
            columns: existingOptions,
            missing,
        };
    }
    catch {
        return { valid: false, columns: [], missing: [] };
    }
}
function createReadlineInterface() {
    return createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}
async function prompt(rl, question, defaultValue) {
    return new Promise((resolve) => {
        const displayQuestion = defaultValue
            ? `${question} [${defaultValue}]: `
            : `${question}: `;
        rl.question(displayQuestion, (answer) => {
            resolve(answer.trim() || defaultValue || '');
        });
    });
}
async function promptYesNo(rl, question, defaultYes = false) {
    const hint = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = await prompt(rl, `${question} ${hint}`);
    if (!answer) {
        return defaultYes;
    }
    return answer.toLowerCase().startsWith('y');
}
async function promptSelect(rl, question, options) {
    console.log(`\n${question}`);
    options.forEach((opt, idx) => {
        console.log(`  ${colors.cyan}${idx + 1}.${colors.reset} ${opt.label}`);
    });
    const answer = await prompt(rl, 'Enter number');
    const num = parseInt(answer, 10);
    if (num >= 1 && num <= options.length) {
        return options[num - 1].value;
    }
    // Default to first option if invalid
    return options[0].value;
}
function loadExistingConfig(configPath) {
    if (!existsSync(configPath)) {
        return {};
    }
    try {
        const content = readFileSync(configPath, 'utf-8');
        return {
            repo: parseYamlNested(content, 'github', 'repo') || undefined,
            projectNumber: parseInt(parseYamlNested(content, 'github', 'project_number') || '', 10) || undefined,
            baseBranch: parseYamlNested(content, 'branch', 'base') || undefined,
            gigachadMode: parseYamlNested(content, 'iteration', 'gigachad_mode') === 'true',
            perTaskLimit: parseYamlNested(content, 'budget', 'per_task_limit') || undefined,
            perSessionLimit: parseYamlNested(content, 'budget', 'per_session_limit') || undefined,
            slackWebhookUrl: parseYamlNested(content, 'slack', 'webhook_url') || undefined,
            discordWebhookUrl: parseYamlNested(content, 'discord', 'webhook_url') || undefined,
        };
    }
    catch {
        return {};
    }
}
function updateConfigFile(configPath, values) {
    let content = readFileSync(configPath, 'utf-8');
    // Update github.repo
    content = content.replace(/^(\s*repo:\s*).*$/m, `$1${values.repo}`);
    // Update github.project_number
    content = content.replace(/^(\s*project_number:\s*).*$/m, `$1${values.projectNumber}`);
    // Update branch.base
    content = content.replace(/^(\s*base:\s*).*$/m, `$1${values.baseBranch}`);
    // Update iteration.gigachad_mode
    content = content.replace(/^(\s*gigachad_mode:\s*).*$/m, `$1${values.gigachadMode}`);
    // Update budget.per_task_limit
    if (values.perTaskLimit) {
        content = content.replace(/^(\s*per_task_limit:\s*).*$/m, `$1${values.perTaskLimit}`);
    }
    // Update budget.per_session_limit
    if (values.perSessionLimit) {
        content = content.replace(/^(\s*per_session_limit:\s*).*$/m, `$1${values.perSessionLimit}`);
    }
    // Update notifications.enabled and slack webhook if provided
    if (values.slackWebhookUrl) {
        // Enable notifications
        content = content.replace(/^(\s*notifications:\s*\n\s*# Enable\/disable.*\n\s*enabled:\s*)false/m, '$1true');
        // Enable slack
        content = content.replace(/^(\s*slack:\s*\n\s*enabled:\s*)false/m, '$1true');
        // Set webhook URL
        content = content.replace(/^(\s*slack:\s*\n\s*enabled:\s*\w+\n\s*webhook_url:\s*).*$/m, `$1"${values.slackWebhookUrl}"`);
    }
    // Update discord webhook if provided
    if (values.discordWebhookUrl) {
        // Enable notifications
        content = content.replace(/^(\s*notifications:\s*\n\s*# Enable\/disable.*\n\s*enabled:\s*)false/m, '$1true');
        // Enable discord
        content = content.replace(/^(\s*discord:\s*\n\s*enabled:\s*)false/m, '$1true');
        // Set webhook URL
        content = content.replace(/^(\s*discord:\s*\n\s*enabled:\s*\w+\n\s*webhook_url:\s*).*$/m, `$1"${values.discordWebhookUrl}"`);
    }
    writeFileSync(configPath, content);
}
function getDefaultValues(repo) {
    return {
        repo: repo || 'owner/repo',
        projectNumber: 1,
        baseBranch: 'main',
        gigachadMode: false,
        perTaskLimit: '2.00',
        perSessionLimit: '20.00',
        slackWebhookUrl: '',
        discordWebhookUrl: '',
    };
}
export async function setup(options = {}) {
    const cwd = process.cwd();
    const chadgiDir = options.config
        ? dirname(resolve(options.config))
        : join(cwd, '.chadgi');
    const configPath = options.config
        ? resolve(options.config)
        : join(chadgiDir, 'chadgi-config.yaml');
    console.log(`\n${colors.bold}${colors.magenta}ChadGI Setup Wizard${colors.reset}\n`);
    // Check if .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        console.error(`${colors.red}Error:${colors.reset} .chadgi directory not found.`);
        console.log('Run "chadgi init" first to create the configuration directory.\n');
        process.exit(1);
    }
    // Check if config file exists
    if (!existsSync(configPath)) {
        console.error(`${colors.red}Error:${colors.reset} Configuration file not found at ${configPath}`);
        console.log('Run "chadgi init" first to create the configuration file.\n');
        process.exit(1);
    }
    // Load existing configuration values as defaults
    const existingConfig = loadExistingConfig(configPath);
    const detectedRepo = detectRepository();
    const defaults = getDefaultValues(detectedRepo);
    // Merge existing config with defaults (existing takes precedence)
    const mergedDefaults = {
        ...defaults,
        ...Object.fromEntries(Object.entries(existingConfig).filter(([_, v]) => v !== undefined && v !== '')),
    };
    // If detected repo is different from existing, prefer detected
    if (detectedRepo && existingConfig.repo && existingConfig.repo !== detectedRepo) {
        mergedDefaults.repo = detectedRepo;
    }
    if (detectedRepo) {
        console.log(`${colors.dim}Detected repository:${colors.reset} ${detectedRepo}`);
    }
    // Non-interactive mode
    if (options.nonInteractive) {
        console.log(`${colors.cyan}Running in non-interactive mode with sensible defaults...${colors.reset}\n`);
        // Use detected/existing values or defaults
        const finalValues = {
            repo: detectedRepo || existingConfig.repo || defaults.repo,
            projectNumber: existingConfig.projectNumber || defaults.projectNumber,
            baseBranch: existingConfig.baseBranch || defaults.baseBranch,
            gigachadMode: existingConfig.gigachadMode ?? defaults.gigachadMode,
            perTaskLimit: existingConfig.perTaskLimit || defaults.perTaskLimit,
            perSessionLimit: existingConfig.perSessionLimit || defaults.perSessionLimit,
            slackWebhookUrl: existingConfig.slackWebhookUrl || '',
            discordWebhookUrl: existingConfig.discordWebhookUrl || '',
        };
        // Show what will be configured
        console.log(`${colors.bold}Configuration:${colors.reset}`);
        console.log(`  Repository: ${finalValues.repo}`);
        console.log(`  Project Number: ${finalValues.projectNumber}`);
        console.log(`  Base Branch: ${finalValues.baseBranch}`);
        console.log(`  GigaChad Mode: ${finalValues.gigachadMode}`);
        console.log(`  Per-Task Budget: $${finalValues.perTaskLimit}`);
        console.log(`  Per-Session Budget: $${finalValues.perSessionLimit}`);
        console.log('');
        updateConfigFile(configPath, finalValues);
        console.log(`${colors.green}Configuration saved to${colors.reset} ${configPath}`);
        console.log(`Run '${colors.cyan}chadgi validate${colors.reset}' to verify your setup.\n`);
        return;
    }
    // Interactive mode
    const rl = createReadlineInterface();
    try {
        const finalValues = {
            repo: '',
            projectNumber: 0,
            baseBranch: '',
            gigachadMode: false,
            perTaskLimit: '',
            perSessionLimit: '',
            slackWebhookUrl: '',
            discordWebhookUrl: '',
        };
        // Step 1: Repository
        console.log(`\n${colors.bold}Step 1: GitHub Repository${colors.reset}`);
        finalValues.repo = await prompt(rl, '? Repository (owner/repo)', mergedDefaults.repo);
        if (!finalValues.repo.includes('/')) {
            console.log(`${colors.yellow}Warning:${colors.reset} Repository should be in 'owner/repo' format`);
        }
        // Step 2: GitHub Project
        console.log(`\n${colors.bold}Step 2: GitHub Project${colors.reset}`);
        const [owner] = finalValues.repo.split('/');
        // Try to list existing projects
        console.log(`${colors.dim}Fetching projects for ${owner}...${colors.reset}`);
        const projects = await listGitHubProjects(owner);
        if (projects.length > 0) {
            const projectOptions = projects.map(p => ({
                label: `${p.title} (#${p.number})`,
                value: p.number,
            }));
            projectOptions.push({
                label: 'Enter project number manually',
                value: -1,
            });
            const selectedProject = await promptSelect(rl, '? Select GitHub Project:', projectOptions);
            if (selectedProject === -1) {
                const manualNum = await prompt(rl, '? Project number', mergedDefaults.projectNumber.toString());
                finalValues.projectNumber = parseInt(manualNum, 10) || 1;
            }
            else {
                finalValues.projectNumber = selectedProject;
            }
        }
        else {
            console.log(`${colors.yellow}Could not fetch projects.${colors.reset} You can enter the project number manually.`);
            const manualNum = await prompt(rl, '? Project number', mergedDefaults.projectNumber.toString());
            finalValues.projectNumber = parseInt(manualNum, 10) || 1;
        }
        // Validate project columns
        console.log(`\n${colors.dim}Validating project board columns...${colors.reset}`);
        const validation = await validateProjectColumns(owner, finalValues.projectNumber);
        if (validation.columns.length > 0) {
            console.log(`${colors.green}Found Status field with options:${colors.reset} ${validation.columns.join(', ')}`);
            if (validation.missing.length > 0) {
                console.log(`${colors.yellow}Warning:${colors.reset} Missing required columns: ${validation.missing.join(', ')}`);
                console.log(`${colors.dim}You may need to add these columns in the GitHub web interface.${colors.reset}`);
            }
        }
        else {
            console.log(`${colors.yellow}Could not validate project columns.${colors.reset} Make sure to configure them manually.`);
        }
        // Step 3: Base Branch
        console.log(`\n${colors.bold}Step 3: Branch Configuration${colors.reset}`);
        finalValues.baseBranch = await prompt(rl, '? Base branch', mergedDefaults.baseBranch);
        // Step 4: GigaChad Mode
        console.log(`\n${colors.bold}Step 4: GigaChad Mode${colors.reset}`);
        console.log(`${colors.dim}GigaChad mode auto-merges PRs without human review.${colors.reset}`);
        console.log(`${colors.yellow}Warning: Use with caution - this bypasses human review!${colors.reset}`);
        finalValues.gigachadMode = await promptYesNo(rl, '? Enable GigaChad mode (auto-merge PRs)?', mergedDefaults.gigachadMode);
        // Step 5: Budget Limits
        console.log(`\n${colors.bold}Step 5: Budget Limits${colors.reset}`);
        const taskLimitInput = await prompt(rl, '? Per-task budget limit (USD, blank for no limit)', mergedDefaults.perTaskLimit);
        finalValues.perTaskLimit = taskLimitInput || '';
        const sessionLimitInput = await prompt(rl, '? Per-session budget limit (USD, blank for no limit)', mergedDefaults.perSessionLimit);
        finalValues.perSessionLimit = sessionLimitInput || '';
        // Step 6: Notifications (optional)
        console.log(`\n${colors.bold}Step 6: Notifications (Optional)${colors.reset}`);
        const configureSlack = await promptYesNo(rl, '? Configure Slack notifications?', false);
        if (configureSlack) {
            finalValues.slackWebhookUrl = await prompt(rl, '? Slack webhook URL', mergedDefaults.slackWebhookUrl);
        }
        const configureDiscord = await promptYesNo(rl, '? Configure Discord notifications?', false);
        if (configureDiscord) {
            finalValues.discordWebhookUrl = await prompt(rl, '? Discord webhook URL', mergedDefaults.discordWebhookUrl);
        }
        // Summary
        console.log(`\n${colors.bold}${colors.magenta}Configuration Summary${colors.reset}`);
        console.log('='.repeat(50));
        console.log(`  ${colors.cyan}Repository:${colors.reset}        ${finalValues.repo}`);
        console.log(`  ${colors.cyan}Project Number:${colors.reset}    ${finalValues.projectNumber}`);
        console.log(`  ${colors.cyan}Base Branch:${colors.reset}       ${finalValues.baseBranch}`);
        console.log(`  ${colors.cyan}GigaChad Mode:${colors.reset}     ${finalValues.gigachadMode ? `${colors.yellow}enabled${colors.reset}` : 'disabled'}`);
        console.log(`  ${colors.cyan}Per-Task Budget:${colors.reset}   ${finalValues.perTaskLimit ? `$${finalValues.perTaskLimit}` : '(no limit)'}`);
        console.log(`  ${colors.cyan}Per-Session Budget:${colors.reset} ${finalValues.perSessionLimit ? `$${finalValues.perSessionLimit}` : '(no limit)'}`);
        if (finalValues.slackWebhookUrl) {
            console.log(`  ${colors.cyan}Slack:${colors.reset}             configured`);
        }
        if (finalValues.discordWebhookUrl) {
            console.log(`  ${colors.cyan}Discord:${colors.reset}           configured`);
        }
        console.log('='.repeat(50));
        const confirmSave = await promptYesNo(rl, '\n? Save this configuration?', true);
        if (confirmSave) {
            updateConfigFile(configPath, finalValues);
            console.log(`\n${colors.green}Configuration saved to${colors.reset} ${configPath}`);
            console.log(`Run '${colors.cyan}chadgi validate${colors.reset}' to verify your setup.\n`);
        }
        else {
            console.log(`\n${colors.yellow}Configuration not saved.${colors.reset}\n`);
        }
    }
    finally {
        rl.close();
    }
}
//# sourceMappingURL=setup.js.map