import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};
// Patterns for detecting secrets/sensitive data in config
const SECRET_PATTERNS = [
    /webhook_url/i,
    /api_key/i,
    /api_secret/i,
    /token/i,
    /password/i,
    /secret/i,
    /credential/i,
    /auth/i,
];
// Keys that commonly contain sensitive data
const SECRET_KEYS = [
    'webhook_url',
    'api_key',
    'api_secret',
    'token',
    'password',
    'secret',
    'authorization',
];
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
                // Find the closing quote
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
function isSecretKey(key) {
    const lowerKey = key.toLowerCase();
    return SECRET_KEYS.some(pattern => lowerKey.includes(pattern));
}
function stripSecrets(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (isSecretKey(key)) {
            // Replace secret with placeholder
            result[key] = '';
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            result[key] = stripSecrets(value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
function findSecretPlaceholders(obj, path = '') {
    const secrets = [];
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (isSecretKey(key) && (value === '' || value === null || value === undefined)) {
            secrets.push(currentPath);
        }
        else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            secrets.push(...findSecretPlaceholders(value, currentPath));
        }
    }
    return secrets;
}
function deepMerge(target, source) {
    const result = { ...target };
    for (const [key, sourceValue] of Object.entries(source)) {
        if (sourceValue !== null && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
            if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                result[key] = deepMerge(target[key], sourceValue);
            }
            else {
                result[key] = { ...sourceValue };
            }
        }
        else {
            result[key] = sourceValue;
        }
    }
    return result;
}
function setNestedValue(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
}
function createReadlineInterface() {
    return createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}
async function prompt(rl, question) {
    return new Promise((resolve) => {
        rl.question(`${question}: `, (answer) => {
            resolve(answer.trim());
        });
    });
}
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2)
            return 1;
        if (p1 < p2)
            return -1;
    }
    return 0;
}
function getMajorVersion(version) {
    return parseInt(version.split('.')[0], 10) || 0;
}
function getMinorVersion(version) {
    return parseInt(version.split('.')[1], 10) || 0;
}
export async function configExport(options = {}) {
    const cwd = process.cwd();
    const chadgiDir = options.config
        ? dirname(resolve(options.config))
        : join(cwd, '.chadgi');
    const configPath = options.config
        ? resolve(options.config)
        : join(chadgiDir, 'chadgi-config.yaml');
    // Check if config file exists
    if (!existsSync(configPath)) {
        console.error(`${colors.red}Error:${colors.reset} Configuration file not found at ${configPath}`);
        console.log('Run "chadgi init" first to create the configuration directory.\n');
        process.exit(1);
    }
    // Read and parse config
    const configContent = readFileSync(configPath, 'utf-8');
    let configObj = parseYamlToObject(configContent);
    // Read templates
    const templates = {};
    const templateFiles = ['chadgi-task.md', 'chadgi-generate-task.md'];
    for (const templateFile of templateFiles) {
        const templatePath = join(chadgiDir, templateFile);
        if (existsSync(templatePath)) {
            templates[templateFile] = readFileSync(templatePath, 'utf-8');
        }
    }
    // Strip secrets if requested
    if (options.excludeSecrets) {
        configObj = stripSecrets(configObj);
    }
    // Build export bundle
    const bundle = {
        _meta: {
            chadgi_version: CHADGI_VERSION,
            exported_at: new Date().toISOString(),
            source_repo: detectRepository(),
        },
        config: configObj,
        templates,
    };
    // Format output
    const format = options.format || 'json';
    let output;
    if (format === 'yaml') {
        // YAML output
        const lines = [];
        lines.push('# ChadGI Configuration Export');
        lines.push(`# Exported at: ${bundle._meta.exported_at}`);
        lines.push(`# ChadGI version: ${bundle._meta.chadgi_version}`);
        if (bundle._meta.source_repo) {
            lines.push(`# Source repository: ${bundle._meta.source_repo}`);
        }
        lines.push('');
        lines.push('_meta:');
        lines.push(`  chadgi_version: "${bundle._meta.chadgi_version}"`);
        lines.push(`  exported_at: "${bundle._meta.exported_at}"`);
        lines.push(`  source_repo: ${bundle._meta.source_repo ? `"${bundle._meta.source_repo}"` : 'null'}`);
        lines.push('');
        lines.push('config:');
        lines.push(objectToYaml(bundle.config, 1));
        lines.push('');
        lines.push('templates:');
        for (const [name, content] of Object.entries(bundle.templates)) {
            // Use YAML multiline string format
            lines.push(`  ${name}: |`);
            for (const line of content.split('\n')) {
                lines.push(`    ${line}`);
            }
        }
        output = lines.join('\n');
    }
    else {
        // JSON output
        output = JSON.stringify(bundle, null, 2);
    }
    // Write output
    if (options.output) {
        const outputPath = resolve(options.output);
        writeFileSync(outputPath, output);
        console.log(`${colors.green}Configuration exported to:${colors.reset} ${outputPath}`);
        if (options.excludeSecrets) {
            console.log(`${colors.dim}Secrets were excluded from the export.${colors.reset}`);
        }
    }
    else {
        // Write to stdout
        console.log(output);
    }
}
export async function configImport(options) {
    const cwd = process.cwd();
    const chadgiDir = options.config
        ? dirname(resolve(options.config))
        : join(cwd, '.chadgi');
    const configPath = options.config
        ? resolve(options.config)
        : join(chadgiDir, 'chadgi-config.yaml');
    // Read import file
    const importPath = resolve(options.file);
    if (!existsSync(importPath)) {
        console.error(`${colors.red}Error:${colors.reset} Import file not found: ${importPath}`);
        process.exit(1);
    }
    let bundle;
    const importContent = readFileSync(importPath, 'utf-8');
    // Detect format and parse
    try {
        if (importContent.trim().startsWith('{')) {
            // JSON format
            bundle = JSON.parse(importContent);
        }
        else {
            // YAML format - parse it
            const yamlObj = parseYamlToObject(importContent);
            // Reconstruct bundle from YAML structure
            bundle = {
                _meta: {
                    chadgi_version: yamlObj._meta?.chadgi_version || '0.0.0',
                    exported_at: yamlObj._meta?.exported_at || new Date().toISOString(),
                    source_repo: yamlObj._meta?.source_repo || null,
                },
                config: yamlObj.config || {},
                templates: {},
            };
            // Handle templates - they may be stored differently in YAML
            if (yamlObj.templates && typeof yamlObj.templates === 'object') {
                for (const [key, value] of Object.entries(yamlObj.templates)) {
                    if (typeof value === 'string') {
                        bundle.templates[key] = value;
                    }
                }
            }
        }
    }
    catch (err) {
        console.error(`${colors.red}Error:${colors.reset} Failed to parse import file: ${err.message}`);
        process.exit(1);
    }
    // Validate bundle structure
    if (!bundle._meta || !bundle.config) {
        console.error(`${colors.red}Error:${colors.reset} Invalid export bundle format - missing _meta or config section`);
        process.exit(1);
    }
    console.log(`\n${colors.bold}${colors.magenta}ChadGI Config Import${colors.reset}\n`);
    // Version compatibility check
    const exportedVersion = bundle._meta.chadgi_version;
    const exportedMajor = getMajorVersion(exportedVersion);
    const currentMajor = getMajorVersion(CHADGI_VERSION);
    if (exportedMajor !== currentMajor) {
        console.log(`${colors.red}Warning:${colors.reset} Major version mismatch!`);
        console.log(`  Export version: ${exportedVersion}`);
        console.log(`  Current version: ${CHADGI_VERSION}`);
        console.log(`  This configuration may not be compatible.`);
        console.log('');
    }
    else if (compareVersions(exportedVersion, CHADGI_VERSION) !== 0) {
        console.log(`${colors.yellow}Note:${colors.reset} Version difference detected`);
        console.log(`  Export version: ${exportedVersion}`);
        console.log(`  Current version: ${CHADGI_VERSION}`);
        console.log('');
    }
    // Show metadata
    console.log(`${colors.cyan}Import Details:${colors.reset}`);
    console.log(`  Source: ${basename(importPath)}`);
    console.log(`  Exported: ${bundle._meta.exported_at}`);
    if (bundle._meta.source_repo) {
        console.log(`  From repo: ${bundle._meta.source_repo}`);
    }
    console.log('');
    // Check for missing secrets
    const missingSecrets = findSecretPlaceholders(bundle.config);
    let configToWrite = bundle.config;
    if (missingSecrets.length > 0 && !options.dryRun) {
        console.log(`${colors.yellow}Missing secrets detected:${colors.reset}`);
        for (const secret of missingSecrets) {
            console.log(`  - ${secret}`);
        }
        console.log('');
        // Prompt for secrets
        const rl = createReadlineInterface();
        try {
            for (const secretPath of missingSecrets) {
                const value = await prompt(rl, `Enter value for ${secretPath} (leave blank to skip)`);
                if (value) {
                    setNestedValue(configToWrite, secretPath, value);
                }
            }
        }
        finally {
            rl.close();
        }
        console.log('');
    }
    // Merge or replace
    let finalConfig;
    if (options.merge && existsSync(configPath)) {
        const existingContent = readFileSync(configPath, 'utf-8');
        const existingConfig = parseYamlToObject(existingContent);
        finalConfig = deepMerge(existingConfig, configToWrite);
        console.log(`${colors.cyan}Mode:${colors.reset} Merging with existing configuration`);
    }
    else {
        finalConfig = configToWrite;
        console.log(`${colors.cyan}Mode:${colors.reset} Replacing existing configuration`);
    }
    console.log('');
    // Preview changes
    console.log(`${colors.bold}Configuration to write:${colors.reset}`);
    console.log('');
    console.log(objectToYaml(finalConfig));
    console.log('');
    // Templates
    if (Object.keys(bundle.templates).length > 0) {
        console.log(`${colors.bold}Templates to write:${colors.reset}`);
        for (const name of Object.keys(bundle.templates)) {
            const templatePath = join(chadgiDir, name);
            const exists = existsSync(templatePath);
            console.log(`  - ${name} ${exists ? '(will overwrite)' : '(new file)'}`);
        }
        console.log('');
    }
    // Dry run mode - just show what would happen
    if (options.dryRun) {
        console.log(`${colors.yellow}Dry run mode:${colors.reset} No changes were made.`);
        console.log(`Run without ${colors.cyan}--dry-run${colors.reset} to apply these changes.`);
        return;
    }
    // Create .chadgi directory if needed
    if (!existsSync(chadgiDir)) {
        mkdirSync(chadgiDir, { recursive: true });
        console.log(`${colors.green}Created:${colors.reset} ${chadgiDir}`);
    }
    // Write config file
    const yamlOutput = objectToYaml(finalConfig);
    writeFileSync(configPath, yamlOutput);
    console.log(`${colors.green}Wrote:${colors.reset} ${configPath}`);
    // Write templates
    for (const [name, content] of Object.entries(bundle.templates)) {
        const templatePath = join(chadgiDir, name);
        writeFileSync(templatePath, content);
        console.log(`${colors.green}Wrote:${colors.reset} ${templatePath}`);
    }
    console.log('');
    console.log(`${colors.green}Configuration imported successfully!${colors.reset}`);
    console.log(`Run '${colors.cyan}chadgi validate${colors.reset}' to verify your setup.`);
}
//# sourceMappingURL=config-export-import.js.map