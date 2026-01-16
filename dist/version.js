/**
 * Version command for ChadGI.
 *
 * Displays version information for ChadGI and key dependencies,
 * and optionally checks for available updates on npm.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { colors } from './utils/colors.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Get the path to the update check cache file
 */
function getCachePath() {
    const cwd = process.cwd();
    return join(cwd, '.chadgi', 'update-check.json');
}
/**
 * Read update check cache if it exists and is still valid (less than 24 hours old)
 */
function readCache() {
    const cachePath = getCachePath();
    if (!existsSync(cachePath)) {
        return null;
    }
    try {
        const cacheContent = readFileSync(cachePath, 'utf-8');
        const cache = JSON.parse(cacheContent);
        // Check if cache is less than 24 hours old
        const checkedAt = new Date(cache.checked_at);
        const now = new Date();
        const hoursSinceCheck = (now.getTime() - checkedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceCheck < 24) {
            return cache;
        }
    }
    catch {
        // Ignore cache read errors
    }
    return null;
}
/**
 * Write update check cache
 */
function writeCache(latestVersion, currentVersion) {
    const cachePath = getCachePath();
    const cacheDir = dirname(cachePath);
    try {
        // Ensure .chadgi directory exists
        if (!existsSync(cacheDir)) {
            mkdirSync(cacheDir, { recursive: true });
        }
        const cache = {
            checked_at: new Date().toISOString(),
            latest_version: latestVersion,
            current_version: currentVersion,
        };
        writeFileSync(cachePath, JSON.stringify(cache, null, 2));
    }
    catch {
        // Ignore cache write errors
    }
}
/**
 * Get the current ChadGI version from package.json
 */
function getChadGIVersion() {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
}
/**
 * Get a command's version by running it with --version flag
 */
function getCommandVersion(command, versionArg = '--version') {
    try {
        // Check if command exists
        execSync(`which ${command}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        // Get version
        const output = execSync(`${command} ${versionArg}`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        return {
            name: command,
            version: output,
            available: true,
        };
    }
    catch {
        return {
            name: command,
            version: null,
            available: false,
        };
    }
}
/**
 * Get Node.js version
 */
function getNodeVersion() {
    return process.version;
}
/**
 * Get Claude CLI version
 */
function getClaudeVersion() {
    const info = getCommandVersion('claude', '--version');
    if (info.version) {
        // Extract just the version number from output like "claude-code 1.0.3"
        const match = info.version.match(/[\d.]+/);
        if (match) {
            info.version = match[0];
        }
    }
    return info;
}
/**
 * Get GitHub CLI version
 */
function getGhVersion() {
    const info = getCommandVersion('gh', '--version');
    if (info.version) {
        // Extract version from output like "gh version 2.45.0 (2024-01-15)"
        const match = info.version.match(/gh version ([\d.]+)/);
        if (match) {
            info.version = match[1];
        }
    }
    return info;
}
/**
 * Get jq version
 */
function getJqVersion() {
    const info = getCommandVersion('jq', '--version');
    // jq outputs version like "jq-1.7" directly
    return info;
}
/**
 * Compare two semantic version strings
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2)
            return -1;
        if (p1 > p2)
            return 1;
    }
    return 0;
}
/**
 * Check npm registry for latest version
 */
async function checkForUpdate(currentVersion, useCache) {
    // Check cache first
    if (useCache) {
        const cache = readCache();
        if (cache && cache.current_version === currentVersion) {
            return {
                available: compareVersions(currentVersion, cache.latest_version) < 0,
                latest: cache.latest_version,
                cached: true,
            };
        }
    }
    try {
        // Fetch from npm registry
        const response = execSync('curl -s https://registry.npmjs.org/chadgi/latest', {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const data = JSON.parse(response);
        const latestVersion = data.version;
        // Cache the result
        writeCache(latestVersion, currentVersion);
        return {
            available: compareVersions(currentVersion, latestVersion) < 0,
            latest: latestVersion,
            cached: false,
        };
    }
    catch {
        // Network error or parse error - silently fail
        return null;
    }
}
/**
 * Print version information to console
 */
function printVersion(currentVersion, nodeVersion, claude, gh, jq, updateInfo) {
    console.log(`${colors.cyan}${colors.bold}ChadGI${colors.reset} v${currentVersion}`);
    console.log('');
    console.log(`${colors.cyan}Dependencies:${colors.reset}`);
    console.log(`  Node.js:    ${nodeVersion}`);
    if (claude.available) {
        console.log(`  Claude CLI: ${claude.version}`);
    }
    else {
        console.log(`  Claude CLI: ${colors.dim}not installed${colors.reset}`);
    }
    if (gh.available) {
        console.log(`  GitHub CLI: ${gh.version}`);
    }
    else {
        console.log(`  GitHub CLI: ${colors.dim}not installed${colors.reset}`);
    }
    if (jq.available) {
        console.log(`  jq:         ${jq.version}`);
    }
    else {
        console.log(`  jq:         ${colors.dim}not installed${colors.reset}`);
    }
    if (updateInfo) {
        console.log('');
        if (updateInfo.available) {
            console.log(`${colors.yellow}Update available:${colors.reset} ${updateInfo.latest} (current: ${currentVersion})`);
            console.log(`${colors.green}Run:${colors.reset} npm install -g chadgi@latest`);
        }
        else {
            console.log(`${colors.green}You are using the latest version.${colors.reset}`);
        }
    }
}
/**
 * Main version command handler
 */
export async function version(options = {}) {
    const currentVersion = getChadGIVersion();
    const nodeVersion = getNodeVersion();
    const claude = getClaudeVersion();
    const gh = getGhVersion();
    const jq = getJqVersion();
    // Check for updates if --check flag is provided
    let updateInfo = null;
    if (options.check) {
        updateInfo = await checkForUpdate(currentVersion, true);
    }
    // Build version info object for JSON output
    const versionInfo = {
        chadgi: currentVersion,
        dependencies: {
            node: nodeVersion,
            claude_cli: claude.version,
            github_cli: gh.version,
            jq: jq.version,
        },
    };
    if (updateInfo) {
        versionInfo.update = {
            available: updateInfo.available,
            current: currentVersion,
            latest: updateInfo.latest,
            cached: updateInfo.cached,
        };
    }
    // Output as JSON if requested
    if (options.json) {
        console.log(JSON.stringify(versionInfo, null, 2));
        return;
    }
    // Print formatted output
    printVersion(currentVersion, nodeVersion, claude, gh, jq, updateInfo);
}
//# sourceMappingURL=version.js.map