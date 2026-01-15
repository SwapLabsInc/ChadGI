import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
function checkCommand(command) {
    try {
        execSync(`which ${command}`, { stdio: 'pipe' });
        return true;
    }
    catch {
        return false;
    }
}
function getCommandVersion(command) {
    try {
        return execSync(`${command} --version`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
            .split('\n')[0]
            .trim();
    }
    catch {
        return null;
    }
}
function parseYamlValue(content, key) {
    const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (match) {
        return match[1].replace(/["']/g, '').replace(/#.*$/, '').trim();
    }
    return null;
}
function parseYamlNested(content, parent, key) {
    const lines = content.split('\n');
    let inParent = false;
    for (const line of lines) {
        if (line.match(new RegExp(`^${parent}:`))) {
            inParent = true;
            continue;
        }
        if (inParent && line.match(/^[a-z]/)) {
            inParent = false;
        }
        if (inParent && line.match(new RegExp(`^\\s+${key}:`))) {
            const value = line.split(':')[1];
            if (value) {
                return value.replace(/["']/g, '').replace(/#.*$/, '').trim();
            }
        }
    }
    return null;
}
export async function validate(options = {}) {
    const results = [];
    const cwd = process.cwd();
    const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
    const configPath = options.config ? resolve(options.config) : defaultConfigPath;
    const quiet = options.quiet || false;
    if (!quiet) {
        console.log('Validating ChadGI configuration...\n');
        console.log('Checking dependencies:\n');
    }
    // Check required commands
    const requiredCommands = ['claude', 'gh', 'jq', 'git'];
    for (const cmd of requiredCommands) {
        if (checkCommand(cmd)) {
            const version = getCommandVersion(cmd);
            results.push({
                name: cmd,
                status: 'ok',
                message: version || 'installed'
            });
        }
        else {
            results.push({
                name: cmd,
                status: 'error',
                message: 'not found'
            });
        }
    }
    // Check optional commands
    const optionalCommands = ['perl'];
    for (const cmd of optionalCommands) {
        if (checkCommand(cmd)) {
            results.push({
                name: cmd,
                status: 'ok',
                message: 'installed (optional)'
            });
        }
        else {
            results.push({
                name: cmd,
                status: 'warning',
                message: 'not found (optional, used for multiline templates)'
            });
        }
    }
    // Print dependency results
    if (!quiet) {
        for (const result of results) {
            const icon = result.status === 'ok' ? '+' : result.status === 'warning' ? '!' : 'x';
            const color = result.status === 'ok' ? '\x1b[32m' : result.status === 'warning' ? '\x1b[33m' : '\x1b[31m';
            console.log(`${color}${icon}\x1b[0m ${result.name}: ${result.message}`);
        }
        console.log('');
    }
    // Check GitHub CLI authentication
    if (!quiet) {
        console.log('Checking GitHub CLI authentication:\n');
    }
    try {
        execSync('gh auth status', { stdio: 'pipe' });
        results.push({
            name: 'gh auth',
            status: 'ok',
            message: 'authenticated'
        });
        if (!quiet) {
            console.log('\x1b[32m+\x1b[0m GitHub CLI authenticated');
        }
    }
    catch {
        results.push({
            name: 'gh auth',
            status: 'error',
            message: 'not authenticated'
        });
        if (!quiet) {
            console.log('\x1b[31mx\x1b[0m GitHub CLI not authenticated');
            console.log('  Run: gh auth login');
        }
    }
    if (!quiet) {
        console.log('');
        console.log('Checking configuration:\n');
    }
    // Check config file exists
    if (existsSync(configPath)) {
        results.push({
            name: 'config file',
            status: 'ok',
            message: configPath
        });
        if (!quiet) {
            console.log(`\x1b[32m+\x1b[0m Config file found: ${configPath}`);
        }
        // Parse and validate config
        const configContent = readFileSync(configPath, 'utf-8');
        // Check required fields
        const repo = parseYamlNested(configContent, 'github', 'repo');
        const projectNumber = parseYamlNested(configContent, 'github', 'project_number');
        if (repo && repo !== 'owner/repo') {
            results.push({
                name: 'github.repo',
                status: 'ok',
                message: repo
            });
            if (!quiet) {
                console.log(`\x1b[32m+\x1b[0m Repository: ${repo}`);
            }
        }
        else {
            results.push({
                name: 'github.repo',
                status: 'warning',
                message: 'not configured (using default)'
            });
            if (!quiet) {
                console.log('\x1b[33m!\x1b[0m Repository not configured (still using default owner/repo)');
            }
        }
        if (projectNumber) {
            results.push({
                name: 'github.project_number',
                status: 'ok',
                message: `Project #${projectNumber}`
            });
            if (!quiet) {
                console.log(`\x1b[32m+\x1b[0m Project number: ${projectNumber}`);
            }
        }
        else {
            results.push({
                name: 'github.project_number',
                status: 'warning',
                message: 'not configured'
            });
            if (!quiet) {
                console.log('\x1b[33m!\x1b[0m Project number not configured');
            }
        }
        // Check template files
        const chadgiDir = dirname(configPath);
        const promptTemplate = parseYamlValue(configContent, 'prompt_template') || './chadgi-task.md';
        const generateTemplate = parseYamlValue(configContent, 'generate_template') || './chadgi-generate-task.md';
        const templatePath = promptTemplate.startsWith('/') ? promptTemplate : join(chadgiDir, promptTemplate);
        const generateTemplatePath = generateTemplate.startsWith('/') ? generateTemplate : join(chadgiDir, generateTemplate);
        if (existsSync(templatePath)) {
            results.push({
                name: 'prompt_template',
                status: 'ok',
                message: templatePath
            });
            if (!quiet) {
                console.log(`\x1b[32m+\x1b[0m Task template found`);
            }
        }
        else {
            results.push({
                name: 'prompt_template',
                status: 'error',
                message: `not found: ${templatePath}`
            });
            if (!quiet) {
                console.log(`\x1b[31mx\x1b[0m Task template not found: ${templatePath}`);
            }
        }
        if (existsSync(generateTemplatePath)) {
            results.push({
                name: 'generate_template',
                status: 'ok',
                message: generateTemplatePath
            });
            if (!quiet) {
                console.log(`\x1b[32m+\x1b[0m Generate template found`);
            }
        }
        else {
            results.push({
                name: 'generate_template',
                status: 'error',
                message: `not found: ${generateTemplatePath}`
            });
            if (!quiet) {
                console.log(`\x1b[31mx\x1b[0m Generate template not found: ${generateTemplatePath}`);
            }
        }
    }
    else {
        results.push({
            name: 'config file',
            status: 'error',
            message: `not found: ${configPath}`
        });
        if (!quiet) {
            console.log(`\x1b[31mx\x1b[0m Config file not found: ${configPath}`);
            console.log('  Run: chadgi init');
        }
    }
    // Check if in a git repository
    try {
        execSync('git rev-parse --git-dir', { stdio: 'pipe', cwd });
        results.push({
            name: 'git repository',
            status: 'ok',
            message: 'in git repository'
        });
        if (!quiet) {
            console.log('\x1b[32m+\x1b[0m In git repository');
        }
    }
    catch {
        results.push({
            name: 'git repository',
            status: 'warning',
            message: 'not in git repository'
        });
        if (!quiet) {
            console.log('\x1b[33m!\x1b[0m Not in a git repository');
        }
    }
    // Summary
    const errors = results.filter(r => r.status === 'error');
    const warnings = results.filter(r => r.status === 'warning');
    if (!quiet) {
        console.log('\n---');
        console.log(`Validation complete: ${errors.length} error(s), ${warnings.length} warning(s)`);
        if (errors.length > 0) {
            console.log('\nPlease fix the errors above before running ChadGI.');
        }
        else if (warnings.length > 0) {
            console.log('\nChadGI can run with warnings, but consider fixing them for optimal operation.');
        }
        else {
            console.log('\nAll checks passed! Run `chadgi start` to begin.');
        }
    }
    return errors.length === 0;
}
//# sourceMappingURL=validate.js.map