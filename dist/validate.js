import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
function getExtendsPath(configContent) {
    // Check for 'extends' field first, then 'base_config'
    let extendsValue = parseYamlValue(configContent, 'extends');
    if (!extendsValue) {
        extendsValue = parseYamlValue(configContent, 'base_config');
    }
    return extendsValue;
}
function resolveConfigPath(baseDir, configPath) {
    if (!configPath)
        return '';
    if (configPath.startsWith('/')) {
        return configPath; // Absolute path
    }
    return join(baseDir, configPath); // Relative path
}
function loadConfigChain(configPath, visited = new Set()) {
    const resolvedPath = resolve(configPath);
    // Cycle detection
    if (visited.has(resolvedPath)) {
        return {
            configFiles: [],
            error: `Circular inheritance detected: ${resolvedPath} was already visited`
        };
    }
    // Check if file exists
    if (!existsSync(resolvedPath)) {
        return {
            configFiles: [],
            error: `Config file not found: ${resolvedPath}`
        };
    }
    visited.add(resolvedPath);
    const configContent = readFileSync(resolvedPath, 'utf-8');
    const extendsValue = getExtendsPath(configContent);
    if (extendsValue) {
        // Resolve the base config path relative to current config's directory
        const baseConfigPath = resolveConfigPath(dirname(resolvedPath), extendsValue);
        // Recursively load the base config
        const baseResult = loadConfigChain(baseConfigPath, visited);
        if (baseResult.error) {
            return {
                configFiles: [],
                error: `${baseResult.error}\n  Referenced from: ${resolvedPath}`
            };
        }
        // Return base configs first, then current config
        return {
            configFiles: [...baseResult.configFiles, resolvedPath],
            error: null
        };
    }
    // No inheritance, just return this config
    return {
        configFiles: [resolvedPath],
        error: null
    };
}
function mergeConfigs(configFiles) {
    const merged = {};
    for (const configFile of configFiles) {
        const content = readFileSync(configFile, 'utf-8');
        const lines = content.split('\n');
        let currentSection = null;
        let currentSubsection = null;
        for (const line of lines) {
            // Skip empty lines and comments
            if (!line.trim() || line.trim().startsWith('#'))
                continue;
            // Top-level key (no indentation)
            const topLevelMatch = line.match(/^([a-z_]+):\s*(.*)$/);
            if (topLevelMatch) {
                currentSection = topLevelMatch[1];
                currentSubsection = null;
                const value = topLevelMatch[2].replace(/["']/g, '').replace(/#.*$/, '').trim();
                if (value && currentSection !== 'extends' && currentSection !== 'base_config') {
                    merged[currentSection] = value;
                }
                else if (!value && currentSection !== 'extends' && currentSection !== 'base_config') {
                    // Object value - initialize if not exists
                    if (!merged[currentSection] || typeof merged[currentSection] !== 'object') {
                        merged[currentSection] = {};
                    }
                }
                continue;
            }
            // First-level nested key (2 spaces)
            const nestedMatch = line.match(/^  ([a-z_]+):\s*(.*)$/);
            if (nestedMatch && currentSection) {
                currentSubsection = nestedMatch[1];
                const value = nestedMatch[2].replace(/["']/g, '').replace(/#.*$/, '').trim();
                if (typeof merged[currentSection] !== 'object' || merged[currentSection] === null) {
                    merged[currentSection] = {};
                }
                if (value) {
                    merged[currentSection][currentSubsection] = value;
                }
                else {
                    // Object value
                    if (!merged[currentSection][currentSubsection] ||
                        typeof merged[currentSection][currentSubsection] !== 'object') {
                        merged[currentSection][currentSubsection] = {};
                    }
                }
                continue;
            }
            // Second-level nested key (4 spaces)
            const deepNestedMatch = line.match(/^    ([a-z_]+):\s*(.*)$/);
            if (deepNestedMatch && currentSection && currentSubsection) {
                const key = deepNestedMatch[1];
                const value = deepNestedMatch[2].replace(/["']/g, '').replace(/#.*$/, '').trim();
                if (typeof merged[currentSection] === 'object' && merged[currentSection] !== null) {
                    const section = merged[currentSection];
                    if (typeof section[currentSubsection] !== 'object' || section[currentSubsection] === null) {
                        section[currentSubsection] = {};
                    }
                    section[currentSubsection][key] = value || null;
                }
            }
        }
    }
    return merged;
}
function formatMergedConfig(merged, indent = 0) {
    const lines = [];
    const prefix = '  '.repeat(indent);
    for (const [key, value] of Object.entries(merged)) {
        if (value === null || value === undefined) {
            continue;
        }
        if (typeof value === 'object') {
            lines.push(`${prefix}${key}:`);
            lines.push(formatMergedConfig(value, indent + 1));
        }
        else {
            lines.push(`${prefix}${key}: ${value}`);
        }
    }
    return lines.filter(l => l.trim()).join('\n');
}
// Valid template variables as documented in README.md
const VALID_TEMPLATE_VARIABLES = new Set([
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
    // Additional internal variables used in templates
    'CHAD_TAGLINE',
    'CHAD_LABEL',
    'CHAD_FOOTER',
    'ISSUE_PREFIX',
    'EXISTING_ISSUES',
    'GITHUB_USERNAME',
]);
function extractTemplateVariables(content) {
    const matches = [];
    const lines = content.split('\n');
    const variablePattern = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        let match;
        while ((match = variablePattern.exec(line)) !== null) {
            matches.push({
                variable: match[1],
                line: lineIndex + 1,
                column: match.index + 1,
            });
        }
    }
    return matches;
}
function parseCustomVariables(configContent) {
    const customVars = [];
    const lines = configContent.split('\n');
    let inCustomVars = false;
    for (const line of lines) {
        if (line.match(/^custom_template_variables:/)) {
            inCustomVars = true;
            continue;
        }
        if (inCustomVars && line.match(/^[a-z]/)) {
            inCustomVars = false;
        }
        if (inCustomVars && line.match(/^\s+-\s*/)) {
            const varName = line.replace(/^\s+-\s*/, '').replace(/["']/g, '').trim();
            if (varName) {
                customVars.push(varName);
            }
        }
    }
    return customVars;
}
export function validateTemplateVariables(templatePath, customVariables = []) {
    const content = readFileSync(templatePath, 'utf-8');
    const matches = extractTemplateVariables(content);
    const allValidVariables = new Set([...VALID_TEMPLATE_VARIABLES, ...customVariables]);
    const unknownVariables = matches.filter(m => !allValidVariables.has(m.variable));
    return {
        templatePath,
        unknownVariables,
    };
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
    // Check config file exists and validate inheritance chain
    if (existsSync(configPath)) {
        results.push({
            name: 'config file',
            status: 'ok',
            message: configPath
        });
        if (!quiet) {
            console.log(`\x1b[32m+\x1b[0m Config file found: ${configPath}`);
        }
        // Load and validate config inheritance chain
        const chainResult = loadConfigChain(configPath);
        let configFiles = [];
        if (chainResult.error) {
            results.push({
                name: 'config inheritance',
                status: 'error',
                message: chainResult.error
            });
            if (!quiet) {
                console.log(`\x1b[31mx\x1b[0m Config inheritance error:`);
                console.log(`    ${chainResult.error.replace(/\n/g, '\n    ')}`);
            }
        }
        else {
            configFiles = chainResult.configFiles;
            if (configFiles.length > 1) {
                results.push({
                    name: 'config inheritance',
                    status: 'ok',
                    message: `${configFiles.length} config files in chain`
                });
                if (!quiet) {
                    console.log(`\x1b[32m+\x1b[0m Config inheritance chain (${configFiles.length} files):`);
                    for (const cfg of configFiles) {
                        console.log(`    - ${cfg}`);
                    }
                }
            }
        }
        // Show merged config if requested
        if (options.showMerged && configFiles.length > 0) {
            console.log('');
            console.log('Merged configuration:\n');
            const merged = mergeConfigs(configFiles);
            console.log(formatMergedConfig(merged));
            console.log('');
        }
        // Parse and validate config (using merged values from all config files)
        // For simplicity, read the primary config for now
        const configContent = readFileSync(configPath, 'utf-8');
        // Check required fields (using merged config chain)
        let repo = null;
        let projectNumber = null;
        for (const cfg of configFiles) {
            const content = readFileSync(cfg, 'utf-8');
            const cfgRepo = parseYamlNested(content, 'github', 'repo');
            const cfgProjectNumber = parseYamlNested(content, 'github', 'project_number');
            if (cfgRepo)
                repo = cfgRepo;
            if (cfgProjectNumber)
                projectNumber = cfgProjectNumber;
        }
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
        // Validate template variables
        if (!quiet) {
            console.log('');
            console.log('Checking template variables:\n');
        }
        const customVariables = parseCustomVariables(configContent);
        const templatesToValidate = [];
        if (existsSync(templatePath)) {
            templatesToValidate.push(templatePath);
        }
        if (existsSync(generateTemplatePath)) {
            templatesToValidate.push(generateTemplatePath);
        }
        let hasUnknownVariables = false;
        for (const tmplPath of templatesToValidate) {
            const validation = validateTemplateVariables(tmplPath, customVariables);
            const templateBasename = tmplPath.split('/').pop() || tmplPath;
            if (validation.unknownVariables.length === 0) {
                results.push({
                    name: `template vars: ${templateBasename}`,
                    status: 'ok',
                    message: 'all variables valid'
                });
                if (!quiet) {
                    console.log(`\x1b[32m+\x1b[0m ${templateBasename}: all variables valid`);
                }
            }
            else {
                hasUnknownVariables = true;
                // In strict mode, unknown variables are errors; otherwise warnings
                const status = options.strict ? 'error' : 'warning';
                const icon = options.strict ? 'x' : '!';
                const color = options.strict ? '\x1b[31m' : '\x1b[33m';
                results.push({
                    name: `template vars: ${templateBasename}`,
                    status,
                    message: `${validation.unknownVariables.length} unknown variable(s)`
                });
                if (!quiet) {
                    console.log(`${color}${icon}\x1b[0m ${templateBasename}: ${validation.unknownVariables.length} unknown variable(s)`);
                    for (const v of validation.unknownVariables) {
                        console.log(`    Line ${v.line}, col ${v.column}: {{${v.variable}}} (unknown)`);
                    }
                }
            }
        }
        if (hasUnknownVariables && !quiet) {
            console.log('');
            if (options.strict) {
                console.log('\x1b[33m!\x1b[0m Unknown variables cause errors in --strict mode');
            }
            else {
                console.log('\x1b[33m!\x1b[0m Tip: Add custom variables to config with custom_template_variables:');
                console.log('    custom_template_variables:');
                console.log('      - MY_CUSTOM_VAR');
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
    // Test webhook notifications if requested
    if (options.notifyTest) {
        if (!quiet) {
            console.log('\nTesting webhook notifications:\n');
        }
        // Get the script directory from this module's location
        const scriptDir = join(__dirname, '..', 'scripts');
        const testScript = `
      source "${scriptDir}/chadgi.sh" 2>/dev/null || true
      CONFIG_FILE="${configPath}"
      load_config 2>/dev/null || true
      test_webhook_connectivity
    `;
        try {
            execSync(`bash -c '${testScript}'`, {
                stdio: quiet ? 'pipe' : 'inherit',
                env: {
                    ...process.env,
                    CHADGI_DIR: dirname(configPath),
                    CONFIG_FILE: configPath
                }
            });
            results.push({
                name: 'webhooks',
                status: 'ok',
                message: 'connectivity test passed'
            });
        }
        catch {
            results.push({
                name: 'webhooks',
                status: 'warning',
                message: 'connectivity test failed or no webhooks configured'
            });
            if (!quiet) {
                console.log('\x1b[33m!\x1b[0m Webhook test failed or no webhooks configured');
            }
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