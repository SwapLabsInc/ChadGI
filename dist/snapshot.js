import { existsSync, readFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { colors } from './utils/colors.js';
import { atomicWriteJson, atomicWriteFile } from './utils/fileOps.js';
import { resolveChadgiDir } from './utils/config.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Read version from package.json
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const CHADGI_VERSION = packageJson.version;
// Get git commit hash
function getGitCommit() {
    try {
        return execSync('git rev-parse HEAD', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    }
    catch {
        return undefined;
    }
}
// Get git branch
function getGitBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    }
    catch {
        return undefined;
    }
}
// Parse YAML to object (simplified parser)
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
// Convert object to YAML
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
            const arrayStr = JSON.stringify(value);
            lines.push(`${prefix}${key}: ${arrayStr}`);
        }
        else if (typeof value === 'string') {
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
// Get snapshots directory path
function getSnapshotsDir(chadgiDir) {
    return join(chadgiDir, 'snapshots');
}
// Ensure snapshots directory exists
function ensureSnapshotsDir(chadgiDir) {
    const snapshotsDir = getSnapshotsDir(chadgiDir);
    if (!existsSync(snapshotsDir)) {
        mkdirSync(snapshotsDir, { recursive: true });
    }
    return snapshotsDir;
}
// Sanitize snapshot name for filesystem
function sanitizeSnapshotName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
// Get snapshot file path
function getSnapshotPath(snapshotsDir, name) {
    const sanitized = sanitizeSnapshotName(name);
    return join(snapshotsDir, `${sanitized}.json`);
}
// Load all snapshots
function loadAllSnapshots(snapshotsDir) {
    if (!existsSync(snapshotsDir)) {
        return [];
    }
    const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json'));
    const snapshots = [];
    for (const file of files) {
        try {
            const content = readFileSync(join(snapshotsDir, file), 'utf-8');
            const snapshot = JSON.parse(content);
            snapshots.push(snapshot);
        }
        catch {
            // Ignore invalid snapshot files
        }
    }
    // Sort by creation date, newest first
    snapshots.sort((a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime());
    return snapshots;
}
// Find snapshot by name or alias
function findSnapshot(snapshotsDir, nameOrAlias) {
    const snapshots = loadAllSnapshots(snapshotsDir);
    // First try exact name match
    let snapshot = snapshots.find(s => s.metadata.name === nameOrAlias);
    if (snapshot)
        return snapshot;
    // Try alias match
    snapshot = snapshots.find(s => s.metadata.alias === nameOrAlias);
    if (snapshot)
        return snapshot;
    // Try sanitized name match
    const sanitized = sanitizeSnapshotName(nameOrAlias);
    snapshot = snapshots.find(s => sanitizeSnapshotName(s.metadata.name) === sanitized);
    if (snapshot)
        return snapshot;
    return null;
}
function deepDiff(obj1, obj2, prefix = '') {
    const result = { added: [], removed: [], modified: [] };
    const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
    for (const key of allKeys) {
        const path = prefix ? `${prefix}.${key}` : key;
        const val1 = obj1[key];
        const val2 = obj2[key];
        if (!(key in obj1)) {
            result.added.push(path);
        }
        else if (!(key in obj2)) {
            result.removed.push(path);
        }
        else if (typeof val1 === 'object' && typeof val2 === 'object' &&
            val1 !== null && val2 !== null &&
            !Array.isArray(val1) && !Array.isArray(val2)) {
            const nestedDiff = deepDiff(val1, val2, path);
            result.added.push(...nestedDiff.added);
            result.removed.push(...nestedDiff.removed);
            result.modified.push(...nestedDiff.modified);
        }
        else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
            result.modified.push({ path, oldValue: val1, newValue: val2 });
        }
    }
    return result;
}
// Create readline interface for prompts
function createReadlineInterface() {
    return createInterface({
        input: process.stdin,
        output: process.stdout,
    });
}
// Prompt for confirmation
async function confirm(message) {
    const rl = createReadlineInterface();
    return new Promise((resolve) => {
        rl.question(`${message} [y/N]: `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}
// Format relative time
function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 30) {
        return date.toLocaleDateString();
    }
    else if (diffDays > 0) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
    else if (diffHours > 0) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }
    else if (diffMins > 0) {
        return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    }
    else {
        return 'just now';
    }
}
/**
 * Save current configuration as a snapshot
 */
export async function snapshotSave(name, options = {}) {
    const chadgiDir = resolveChadgiDir(options);
    const configPath = options.config
        ? resolve(options.config)
        : join(chadgiDir, 'chadgi-config.yaml');
    // Check if config file exists
    if (!existsSync(configPath)) {
        console.error(`${colors.red}Error:${colors.reset} Configuration file not found at ${configPath}`);
        console.log('Run "chadgi init" first to create the configuration directory.\n');
        process.exit(1);
    }
    // Validate snapshot name
    if (!name || name.trim() === '') {
        console.error(`${colors.red}Error:${colors.reset} Snapshot name is required`);
        process.exit(1);
    }
    const snapshotsDir = ensureSnapshotsDir(chadgiDir);
    const snapshotPath = getSnapshotPath(snapshotsDir, name);
    // Check if snapshot already exists
    if (existsSync(snapshotPath)) {
        console.error(`${colors.red}Error:${colors.reset} Snapshot '${name}' already exists`);
        console.log(`Use a different name or delete the existing snapshot with: chadgi snapshot delete ${name}`);
        process.exit(1);
    }
    // Check for alias conflicts
    if (options.alias) {
        const existing = findSnapshot(snapshotsDir, options.alias);
        if (existing) {
            console.error(`${colors.red}Error:${colors.reset} Alias '${options.alias}' is already in use by snapshot '${existing.metadata.name}'`);
            process.exit(1);
        }
    }
    // Read and parse config
    const configContent = readFileSync(configPath, 'utf-8');
    const configObj = parseYamlToObject(configContent);
    // Read templates
    const templates = {};
    const templateFiles = ['chadgi-task.md', 'chadgi-generate-task.md'];
    for (const templateFile of templateFiles) {
        const templatePath = join(chadgiDir, templateFile);
        if (existsSync(templatePath)) {
            templates[templateFile] = readFileSync(templatePath, 'utf-8');
        }
    }
    // Build snapshot
    const snapshot = {
        metadata: {
            name,
            alias: options.alias,
            description: options.description,
            createdAt: new Date().toISOString(),
            chadgiVersion: CHADGI_VERSION,
            gitCommit: getGitCommit(),
            gitBranch: getGitBranch(),
        },
        config: configObj,
        templates,
    };
    // Save snapshot (using atomic write for crash safety)
    atomicWriteJson(snapshotPath, snapshot);
    console.log(`${colors.green}Snapshot saved:${colors.reset} ${name}`);
    console.log(`  ${colors.dim}Path: ${snapshotPath}${colors.reset}`);
    if (options.alias) {
        console.log(`  ${colors.dim}Alias: ${options.alias}${colors.reset}`);
    }
    if (options.description) {
        console.log(`  ${colors.dim}Description: ${options.description}${colors.reset}`);
    }
    if (snapshot.metadata.gitCommit) {
        console.log(`  ${colors.dim}Git commit: ${snapshot.metadata.gitCommit.substring(0, 8)}${colors.reset}`);
    }
}
/**
 * Restore configuration from a snapshot
 */
export async function snapshotRestore(name, options = {}) {
    const chadgiDir = resolveChadgiDir(options);
    const configPath = options.config
        ? resolve(options.config)
        : join(chadgiDir, 'chadgi-config.yaml');
    const snapshotsDir = getSnapshotsDir(chadgiDir);
    // Find snapshot
    const snapshot = findSnapshot(snapshotsDir, name);
    if (!snapshot) {
        console.error(`${colors.red}Error:${colors.reset} Snapshot '${name}' not found`);
        console.log('Use "chadgi snapshot list" to see available snapshots.');
        process.exit(1);
    }
    // Show what will be restored
    console.log(`${colors.cyan}${colors.bold}Restore Snapshot: ${snapshot.metadata.name}${colors.reset}`);
    console.log(`  Created: ${new Date(snapshot.metadata.createdAt).toLocaleString()}`);
    if (snapshot.metadata.description) {
        console.log(`  Description: ${snapshot.metadata.description}`);
    }
    if (snapshot.metadata.gitCommit) {
        console.log(`  Git commit: ${snapshot.metadata.gitCommit.substring(0, 8)}`);
    }
    console.log('');
    // Confirm unless --force
    if (!options.force) {
        const confirmed = await confirm(`Restore this snapshot? This will overwrite your current configuration`);
        if (!confirmed) {
            console.log('Restore cancelled.');
            return;
        }
    }
    // Ensure .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        mkdirSync(chadgiDir, { recursive: true });
    }
    // Write config file (using atomic write for crash safety)
    const yamlOutput = objectToYaml(snapshot.config);
    atomicWriteFile(configPath, yamlOutput);
    console.log(`${colors.green}Restored:${colors.reset} ${configPath}`);
    // Write templates (using atomic write for crash safety)
    for (const [templateName, content] of Object.entries(snapshot.templates)) {
        const templatePath = join(chadgiDir, templateName);
        atomicWriteFile(templatePath, content);
        console.log(`${colors.green}Restored:${colors.reset} ${templatePath}`);
    }
    console.log('');
    console.log(`${colors.green}Configuration restored from snapshot '${snapshot.metadata.name}'${colors.reset}`);
    console.log(`Run '${colors.cyan}chadgi validate${colors.reset}' to verify your setup.`);
}
/**
 * List all saved snapshots
 */
export async function snapshotList(options = {}) {
    const chadgiDir = resolveChadgiDir(options);
    const snapshotsDir = getSnapshotsDir(chadgiDir);
    const snapshots = loadAllSnapshots(snapshotsDir);
    if (options.json) {
        const output = snapshots.map(s => ({
            name: s.metadata.name,
            alias: s.metadata.alias,
            description: s.metadata.description,
            createdAt: s.metadata.createdAt,
            chadgiVersion: s.metadata.chadgiVersion,
            gitCommit: s.metadata.gitCommit,
            gitBranch: s.metadata.gitBranch,
        }));
        console.log(JSON.stringify(output, null, 2));
        return;
    }
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('               CHADGI SNAPSHOTS                           ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
    if (snapshots.length === 0) {
        console.log(`${colors.dim}No snapshots found.${colors.reset}`);
        console.log(`\nCreate a snapshot with: ${colors.cyan}chadgi snapshot save <name>${colors.reset}`);
        return;
    }
    console.log(`${colors.dim}Found ${snapshots.length} snapshot${snapshots.length === 1 ? '' : 's'}${colors.reset}\n`);
    for (const snapshot of snapshots) {
        const createdDate = new Date(snapshot.metadata.createdAt);
        const relativeTime = formatRelativeTime(createdDate);
        console.log(`${colors.cyan}${colors.bold}${snapshot.metadata.name}${colors.reset}`);
        if (snapshot.metadata.alias) {
            console.log(`  ${colors.yellow}Alias: ${snapshot.metadata.alias}${colors.reset}`);
        }
        if (snapshot.metadata.description) {
            console.log(`  ${snapshot.metadata.description}`);
        }
        console.log(`  ${colors.dim}Created: ${relativeTime} (${createdDate.toLocaleString()})${colors.reset}`);
        console.log(`  ${colors.dim}Version: ${snapshot.metadata.chadgiVersion}${colors.reset}`);
        if (snapshot.metadata.gitCommit) {
            console.log(`  ${colors.dim}Git: ${snapshot.metadata.gitCommit.substring(0, 8)}${snapshot.metadata.gitBranch ? ` (${snapshot.metadata.gitBranch})` : ''}${colors.reset}`);
        }
        console.log('');
    }
    console.log(`${colors.dim}Commands:${colors.reset}`);
    console.log(`  ${colors.cyan}chadgi snapshot restore <name>${colors.reset}  Restore a snapshot`);
    console.log(`  ${colors.cyan}chadgi snapshot diff <name>${colors.reset}     Compare with current config`);
    console.log(`  ${colors.cyan}chadgi snapshot delete <name>${colors.reset}   Delete a snapshot`);
}
/**
 * Show diff between current config and a snapshot
 */
export async function snapshotDiff(name, options = {}) {
    const chadgiDir = resolveChadgiDir(options);
    const configPath = options.config
        ? resolve(options.config)
        : join(chadgiDir, 'chadgi-config.yaml');
    // Check if current config exists
    if (!existsSync(configPath)) {
        console.error(`${colors.red}Error:${colors.reset} Configuration file not found at ${configPath}`);
        console.log('Run "chadgi init" first to create the configuration directory.\n');
        process.exit(1);
    }
    const snapshotsDir = getSnapshotsDir(chadgiDir);
    // Find snapshot
    const snapshot = findSnapshot(snapshotsDir, name);
    if (!snapshot) {
        console.error(`${colors.red}Error:${colors.reset} Snapshot '${name}' not found`);
        console.log('Use "chadgi snapshot list" to see available snapshots.');
        process.exit(1);
    }
    // Read current config
    const configContent = readFileSync(configPath, 'utf-8');
    const currentConfig = parseYamlToObject(configContent);
    // Compare configs
    const configDiff = deepDiff(snapshot.config, currentConfig);
    // Compare templates
    const templateDiffs = [];
    const templateFiles = ['chadgi-task.md', 'chadgi-generate-task.md'];
    for (const templateFile of templateFiles) {
        const templatePath = join(chadgiDir, templateFile);
        const snapshotTemplate = snapshot.templates[templateFile];
        const currentTemplate = existsSync(templatePath) ? readFileSync(templatePath, 'utf-8') : undefined;
        if (!snapshotTemplate && currentTemplate) {
            templateDiffs.push({ name: templateFile, status: 'added' });
        }
        else if (snapshotTemplate && !currentTemplate) {
            templateDiffs.push({ name: templateFile, status: 'removed' });
        }
        else if (snapshotTemplate && currentTemplate && snapshotTemplate !== currentTemplate) {
            templateDiffs.push({ name: templateFile, status: 'modified' });
        }
        else if (snapshotTemplate && currentTemplate) {
            templateDiffs.push({ name: templateFile, status: 'unchanged' });
        }
    }
    if (options.json) {
        const output = {
            snapshot: {
                name: snapshot.metadata.name,
                createdAt: snapshot.metadata.createdAt,
            },
            config: configDiff,
            templates: templateDiffs,
            hasChanges: configDiff.added.length > 0 ||
                configDiff.removed.length > 0 ||
                configDiff.modified.length > 0 ||
                templateDiffs.some(t => t.status !== 'unchanged'),
        };
        console.log(JSON.stringify(output, null, 2));
        return;
    }
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('               CHADGI SNAPSHOT DIFF                       ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
    console.log(`Comparing: ${colors.cyan}${snapshot.metadata.name}${colors.reset} -> current config\n`);
    const hasConfigChanges = configDiff.added.length > 0 ||
        configDiff.removed.length > 0 ||
        configDiff.modified.length > 0;
    const hasTemplateChanges = templateDiffs.some(t => t.status !== 'unchanged');
    if (!hasConfigChanges && !hasTemplateChanges) {
        console.log(`${colors.green}No differences found.${colors.reset} Current configuration matches the snapshot.`);
        return;
    }
    // Config differences
    console.log(`${colors.cyan}${colors.bold}Configuration Changes${colors.reset}`);
    if (configDiff.added.length > 0) {
        console.log(`\n  ${colors.green}Added (in current, not in snapshot):${colors.reset}`);
        for (const path of configDiff.added) {
            console.log(`    ${colors.green}+ ${path}${colors.reset}`);
        }
    }
    if (configDiff.removed.length > 0) {
        console.log(`\n  ${colors.red}Removed (in snapshot, not in current):${colors.reset}`);
        for (const path of configDiff.removed) {
            console.log(`    ${colors.red}- ${path}${colors.reset}`);
        }
    }
    if (configDiff.modified.length > 0) {
        console.log(`\n  ${colors.yellow}Modified:${colors.reset}`);
        for (const mod of configDiff.modified) {
            console.log(`    ${colors.yellow}~ ${mod.path}${colors.reset}`);
            console.log(`      ${colors.red}- ${JSON.stringify(mod.oldValue)}${colors.reset}`);
            console.log(`      ${colors.green}+ ${JSON.stringify(mod.newValue)}${colors.reset}`);
        }
    }
    if (!hasConfigChanges) {
        console.log(`  ${colors.dim}No configuration changes${colors.reset}`);
    }
    // Template differences
    console.log(`\n${colors.cyan}${colors.bold}Template Changes${colors.reset}`);
    if (!hasTemplateChanges) {
        console.log(`  ${colors.dim}No template changes${colors.reset}`);
    }
    else {
        for (const diff of templateDiffs) {
            if (diff.status === 'added') {
                console.log(`  ${colors.green}+ ${diff.name} (added)${colors.reset}`);
            }
            else if (diff.status === 'removed') {
                console.log(`  ${colors.red}- ${diff.name} (removed)${colors.reset}`);
            }
            else if (diff.status === 'modified') {
                console.log(`  ${colors.yellow}~ ${diff.name} (modified)${colors.reset}`);
            }
        }
    }
    console.log('');
    console.log(`${colors.dim}To restore the snapshot: chadgi snapshot restore ${snapshot.metadata.name}${colors.reset}`);
}
/**
 * Delete a snapshot
 */
export async function snapshotDelete(name, options = {}) {
    const chadgiDir = resolveChadgiDir(options);
    const snapshotsDir = getSnapshotsDir(chadgiDir);
    // Find snapshot
    const snapshot = findSnapshot(snapshotsDir, name);
    if (!snapshot) {
        console.error(`${colors.red}Error:${colors.reset} Snapshot '${name}' not found`);
        console.log('Use "chadgi snapshot list" to see available snapshots.');
        process.exit(1);
    }
    // Get actual file path
    const snapshotPath = getSnapshotPath(snapshotsDir, snapshot.metadata.name);
    // Show snapshot info
    console.log(`${colors.cyan}Snapshot to delete:${colors.reset} ${snapshot.metadata.name}`);
    if (snapshot.metadata.description) {
        console.log(`  ${snapshot.metadata.description}`);
    }
    console.log(`  Created: ${new Date(snapshot.metadata.createdAt).toLocaleString()}`);
    console.log('');
    // Confirm unless --force
    if (!options.force) {
        const confirmed = await confirm(`Delete this snapshot? This action cannot be undone`);
        if (!confirmed) {
            console.log('Delete cancelled.');
            return;
        }
    }
    // Delete the file
    rmSync(snapshotPath);
    console.log(`${colors.green}Snapshot '${snapshot.metadata.name}' deleted.${colors.reset}`);
}
//# sourceMappingURL=snapshot.js.map