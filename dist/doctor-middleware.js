/**
 * Doctor command implementation using the middleware system.
 *
 * This is a refactored version of doctor.ts that demonstrates the middleware
 * pattern for reducing boilerplate.
 */
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { validateTemplateVariables } from './validate.js';
import { maskObject, setMaskingDisabled } from './utils/secrets.js';
import { colors } from './utils/colors.js';
import { parseYamlValue, parseYamlNested } from './utils/config.js';
import { listTaskLocks, findStaleLocks, cleanupStaleLocks, DEFAULT_LOCK_TIMEOUT_MINUTES, } from './utils/locks.js';
import { checkMigrations, CURRENT_CONFIG_VERSION, DEFAULT_CONFIG_VERSION } from './migrations/index.js';
import { checkTelemetryHealth, getPrometheusEndpoint, } from './utils/telemetry.js';
// Import middleware utilities
import { withCommand, withDirectory, withDirectoryValidation, } from './utils/index.js';
/**
 * Check OpenTelemetry configuration and connectivity
 */
async function checkTelemetryConfig(configContent) {
    const checks = [];
    // Parse telemetry config from YAML
    const telemetryEnabled = parseYamlNested(configContent, 'telemetry', 'enabled');
    const traceExporter = parseYamlNested(configContent, 'telemetry', 'trace_exporter');
    const metricsExporter = parseYamlNested(configContent, 'telemetry', 'metrics_exporter');
    if (!telemetryEnabled || telemetryEnabled !== 'true') {
        checks.push({
            name: 'Telemetry Configuration',
            category: 'telemetry',
            status: 'ok',
            message: 'Telemetry is disabled (not configured or enabled: false)',
        });
        return checks;
    }
    // Check if telemetry is initialized
    const health = await checkTelemetryHealth();
    if (!health.enabled) {
        checks.push({
            name: 'Telemetry Configuration',
            category: 'telemetry',
            status: 'warning',
            message: 'Telemetry is configured but not initialized. Will be enabled when ChadGI starts.',
        });
        return checks;
    }
    // Check trace exporter
    if (traceExporter && traceExporter !== 'none') {
        if (health.trace_exporter_status === 'ok') {
            const endpoint = health.endpoints?.otlp || 'console';
            checks.push({
                name: 'Trace Exporter',
                category: 'telemetry',
                status: 'ok',
                message: `${traceExporter} exporter configured (endpoint: ${endpoint})`,
            });
        }
        else if (health.trace_exporter_status === 'error') {
            checks.push({
                name: 'Trace Exporter',
                category: 'telemetry',
                status: 'error',
                message: `${traceExporter} exporter failed: ${health.errors?.join(', ') || 'unknown error'}`,
            });
        }
    }
    // Check metrics exporter
    if (metricsExporter && metricsExporter !== 'none') {
        if (health.metrics_exporter_status === 'ok') {
            let endpoint = 'console';
            if (metricsExporter === 'prometheus') {
                endpoint = health.endpoints?.prometheus || getPrometheusEndpoint() || 'unknown';
            }
            else if (metricsExporter === 'otlp') {
                endpoint = health.endpoints?.otlp || 'unknown';
            }
            checks.push({
                name: 'Metrics Exporter',
                category: 'telemetry',
                status: 'ok',
                message: `${metricsExporter} exporter configured (endpoint: ${endpoint})`,
            });
        }
        else if (health.metrics_exporter_status === 'error') {
            checks.push({
                name: 'Metrics Exporter',
                category: 'telemetry',
                status: 'error',
                message: `${metricsExporter} exporter failed: ${health.errors?.join(', ') || 'unknown error'}`,
            });
        }
    }
    // If both exporters are none, show a warning
    if ((!traceExporter || traceExporter === 'none') && (!metricsExporter || metricsExporter === 'none')) {
        checks.push({
            name: 'Telemetry Exporters',
            category: 'telemetry',
            status: 'warning',
            message: 'Telemetry is enabled but no exporters are configured. Set trace_exporter or metrics_exporter.',
        });
    }
    return checks;
}
/**
 * Check GitHub API rate limit status
 */
async function checkRateLimit() {
    const checks = [];
    try {
        const output = execSync('gh api rate_limit', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const rateData = JSON.parse(output);
        // Check core API rate limit
        const core = rateData.resources.core;
        const corePercentRemaining = (core.remaining / core.limit) * 100;
        if (corePercentRemaining > 20) {
            checks.push({
                name: 'GitHub API Rate Limit (Core)',
                category: 'api',
                status: 'ok',
                message: `${core.remaining}/${core.limit} requests remaining (${corePercentRemaining.toFixed(0)}%)`,
            });
        }
        else if (corePercentRemaining > 5) {
            checks.push({
                name: 'GitHub API Rate Limit (Core)',
                category: 'api',
                status: 'warning',
                message: `Low: ${core.remaining}/${core.limit} requests remaining (${corePercentRemaining.toFixed(0)}%). Consider waiting before heavy operations.`,
            });
        }
        else {
            const resetTime = new Date(core.reset * 1000).toLocaleTimeString();
            checks.push({
                name: 'GitHub API Rate Limit (Core)',
                category: 'api',
                status: 'error',
                message: `Critical: Only ${core.remaining}/${core.limit} requests remaining. Resets at ${resetTime}`,
            });
        }
        // Check GraphQL API rate limit
        const graphql = rateData.resources.graphql;
        const graphqlPercentRemaining = (graphql.remaining / graphql.limit) * 100;
        if (graphqlPercentRemaining > 20) {
            checks.push({
                name: 'GitHub API Rate Limit (GraphQL)',
                category: 'api',
                status: 'ok',
                message: `${graphql.remaining}/${graphql.limit} points remaining (${graphqlPercentRemaining.toFixed(0)}%)`,
            });
        }
        else if (graphqlPercentRemaining > 5) {
            checks.push({
                name: 'GitHub API Rate Limit (GraphQL)',
                category: 'api',
                status: 'warning',
                message: `Low: ${graphql.remaining}/${graphql.limit} points remaining (${graphqlPercentRemaining.toFixed(0)}%)`,
            });
        }
        else {
            const resetTime = new Date(graphql.reset * 1000).toLocaleTimeString();
            checks.push({
                name: 'GitHub API Rate Limit (GraphQL)',
                category: 'api',
                status: 'error',
                message: `Critical: Only ${graphql.remaining}/${graphql.limit} points remaining. Resets at ${resetTime}`,
            });
        }
    }
    catch (error) {
        checks.push({
            name: 'GitHub API Rate Limit',
            category: 'api',
            status: 'error',
            message: `Could not check rate limit: ${error.message}`,
        });
    }
    return checks;
}
/**
 * Check for stale task locks (issue-*.lock files)
 */
function checkStaleTaskLocks(chadgiDir, fix, timeoutMinutes = DEFAULT_LOCK_TIMEOUT_MINUTES) {
    const checks = [];
    try {
        const allLocks = listTaskLocks(chadgiDir, timeoutMinutes);
        const staleLocks = findStaleLocks(chadgiDir, timeoutMinutes);
        if (allLocks.length === 0) {
            checks.push({
                name: 'Task Locks Check',
                category: 'locks',
                status: 'ok',
                message: 'No task locks present',
            });
            return checks;
        }
        const activeLocks = allLocks.filter((l) => !l.isStale);
        if (staleLocks.length === 0) {
            checks.push({
                name: 'Task Locks Check',
                category: 'locks',
                status: 'ok',
                message: `${allLocks.length} active task lock(s) found`,
            });
            return checks;
        }
        if (fix) {
            const removedCount = cleanupStaleLocks(chadgiDir, timeoutMinutes);
            checks.push({
                name: 'Task Locks Check',
                category: 'locks',
                status: 'warning',
                message: `Removed ${removedCount} stale task lock(s). ${activeLocks.length} active lock(s) remain.`,
                fixable: true,
                fixed: true,
            });
        }
        else {
            const issueNumbers = staleLocks.map((l) => `#${l.issueNumber}`).join(', ');
            checks.push({
                name: 'Task Locks Check',
                category: 'locks',
                status: 'warning',
                message: `${staleLocks.length} stale task lock(s) found (issues: ${issueNumbers}). Use --fix to remove.`,
                fixable: true,
                fixed: false,
            });
        }
    }
    catch (error) {
        checks.push({
            name: 'Task Locks Check',
            category: 'locks',
            status: 'error',
            message: `Error checking task locks: ${error.message}`,
        });
    }
    return checks;
}
/**
 * Check for stale pause.lock files (older than 24 hours)
 */
function checkStaleLockFiles(chadgiDir, fix) {
    const checks = [];
    const pauseLockFile = join(chadgiDir, 'pause.lock');
    if (!existsSync(pauseLockFile)) {
        checks.push({
            name: 'Stale Lock File Check',
            category: 'files',
            status: 'ok',
            message: 'No pause.lock file present',
        });
        return checks;
    }
    try {
        const stats = statSync(pauseLockFile);
        const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        if (ageHours > 24) {
            if (fix) {
                unlinkSync(pauseLockFile);
                checks.push({
                    name: 'Stale Lock File Check',
                    category: 'files',
                    status: 'warning',
                    message: `Removed stale pause.lock (was ${ageHours.toFixed(1)} hours old)`,
                    fixable: true,
                    fixed: true,
                });
            }
            else {
                checks.push({
                    name: 'Stale Lock File Check',
                    category: 'files',
                    status: 'warning',
                    message: `Stale pause.lock file found (${ageHours.toFixed(1)} hours old). Use --fix to remove.`,
                    fixable: true,
                    fixed: false,
                });
            }
        }
        else {
            // Read lock file to get reason
            let reason = '';
            try {
                const lockContent = JSON.parse(readFileSync(pauseLockFile, 'utf-8'));
                reason = lockContent.reason ? ` Reason: ${lockContent.reason}` : '';
            }
            catch {
                // ignore parse errors
            }
            checks.push({
                name: 'Stale Lock File Check',
                category: 'files',
                status: 'ok',
                message: `Active pause.lock (${ageHours.toFixed(1)} hours old).${reason}`,
            });
        }
    }
    catch (error) {
        checks.push({
            name: 'Stale Lock File Check',
            category: 'files',
            status: 'error',
            message: `Error reading pause.lock: ${error.message}`,
        });
    }
    return checks;
}
/**
 * Check for orphaned branches (feature branches with no open PR)
 */
async function checkOrphanedBranches(repo, branchPrefix) {
    const checks = [];
    try {
        // Get remote branches matching the prefix
        const remoteBranchesOutput = execSync('git branch -r', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const remoteBranches = remoteBranchesOutput
            .split('\n')
            .map(b => b.trim())
            .filter(b => b.includes(branchPrefix))
            .map(b => b.replace(/^origin\//, ''));
        if (remoteBranches.length === 0) {
            checks.push({
                name: 'Orphaned Branches Check',
                category: 'git',
                status: 'ok',
                message: 'No feature branches found',
            });
            return checks;
        }
        // Get open PRs for this repo
        let openPRBranches = [];
        try {
            const prsOutput = execSync(`gh pr list --repo ${repo} --state open --json headRefName`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            const prs = JSON.parse(prsOutput);
            openPRBranches = prs.map((pr) => pr.headRefName);
        }
        catch {
            // If we can't check PRs, we can't determine orphaned branches
            checks.push({
                name: 'Orphaned Branches Check',
                category: 'git',
                status: 'warning',
                message: `Could not fetch open PRs. Found ${remoteBranches.length} feature branches.`,
            });
            return checks;
        }
        // Find branches without PRs
        const orphanedBranches = remoteBranches.filter(b => !openPRBranches.includes(b));
        if (orphanedBranches.length === 0) {
            checks.push({
                name: 'Orphaned Branches Check',
                category: 'git',
                status: 'ok',
                message: `All ${remoteBranches.length} feature branches have open PRs`,
            });
        }
        else if (orphanedBranches.length <= 3) {
            checks.push({
                name: 'Orphaned Branches Check',
                category: 'git',
                status: 'warning',
                message: `${orphanedBranches.length} orphaned branch(es): ${orphanedBranches.join(', ')}`,
            });
        }
        else {
            checks.push({
                name: 'Orphaned Branches Check',
                category: 'git',
                status: 'warning',
                message: `${orphanedBranches.length} orphaned branches found. First 3: ${orphanedBranches.slice(0, 3).join(', ')}...`,
            });
        }
    }
    catch (error) {
        checks.push({
            name: 'Orphaned Branches Check',
            category: 'git',
            status: 'error',
            message: `Could not check branches: ${error.message}`,
        });
    }
    return checks;
}
/**
 * Verify project board connectivity and column existence
 */
async function checkProjectBoard(repo, projectNumber, columns) {
    const checks = [];
    const repoOwner = repo.split('/')[0];
    try {
        // Query the project to verify it exists and get field info
        const query = `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            id
            title
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  name
                  options {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;
        const result = execSync(`gh api graphql -f query='${query}' -F owner='${repoOwner}' -F number=${projectNumber}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const data = JSON.parse(result);
        const project = data.data?.user?.projectV2;
        if (!project) {
            // Try organization
            const orgQuery = `
        query($owner: String!, $number: Int!) {
          organization(login: $owner) {
            projectV2(number: $number) {
              id
              title
              fields(first: 20) {
                nodes {
                  ... on ProjectV2SingleSelectField {
                    name
                    options {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `;
            try {
                const orgResult = execSync(`gh api graphql -f query='${orgQuery}' -F owner='${repoOwner}' -F number=${projectNumber}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
                const orgData = JSON.parse(orgResult);
                const orgProject = orgData.data?.organization?.projectV2;
                if (!orgProject) {
                    checks.push({
                        name: 'Project Board Connectivity',
                        category: 'github',
                        status: 'error',
                        message: `Could not find project #${projectNumber} for ${repoOwner}`,
                    });
                    return checks;
                }
                // Use org project data
                checks.push({
                    name: 'Project Board Connectivity',
                    category: 'github',
                    status: 'ok',
                    message: `Connected to project: "${orgProject.title}" (#${projectNumber})`,
                });
                // Check for Status field and columns
                const statusField = orgProject.fields.nodes.find((f) => f.name === 'Status');
                if (!statusField) {
                    checks.push({
                        name: 'Project Board Status Field',
                        category: 'github',
                        status: 'error',
                        message: 'Status field not found in project',
                    });
                    return checks;
                }
                const existingOptions = statusField.options?.map((o) => o.name) || [];
                const missingColumns = columns.filter(c => !existingOptions.includes(c));
                if (missingColumns.length === 0) {
                    checks.push({
                        name: 'Project Board Columns',
                        category: 'github',
                        status: 'ok',
                        message: `All required columns found: ${columns.join(', ')}`,
                    });
                }
                else {
                    checks.push({
                        name: 'Project Board Columns',
                        category: 'github',
                        status: 'warning',
                        message: `Missing columns: ${missingColumns.join(', ')}. Available: ${existingOptions.join(', ')}`,
                    });
                }
                return checks;
            }
            catch {
                checks.push({
                    name: 'Project Board Connectivity',
                    category: 'github',
                    status: 'error',
                    message: `Could not find project #${projectNumber} for ${repoOwner}`,
                });
                return checks;
            }
        }
        checks.push({
            name: 'Project Board Connectivity',
            category: 'github',
            status: 'ok',
            message: `Connected to project: "${project.title}" (#${projectNumber})`,
        });
        // Check for Status field and columns
        const statusField = project.fields.nodes.find((f) => f.name === 'Status');
        if (!statusField) {
            checks.push({
                name: 'Project Board Status Field',
                category: 'github',
                status: 'error',
                message: 'Status field not found in project',
            });
            return checks;
        }
        const existingOptions = statusField.options?.map((o) => o.name) || [];
        const missingColumns = columns.filter(c => !existingOptions.includes(c));
        if (missingColumns.length === 0) {
            checks.push({
                name: 'Project Board Columns',
                category: 'github',
                status: 'ok',
                message: `All required columns found: ${columns.join(', ')}`,
            });
        }
        else {
            checks.push({
                name: 'Project Board Columns',
                category: 'github',
                status: 'warning',
                message: `Missing columns: ${missingColumns.join(', ')}. Available: ${existingOptions.join(', ')}`,
            });
        }
    }
    catch (error) {
        checks.push({
            name: 'Project Board Connectivity',
            category: 'github',
            status: 'error',
            message: `Could not verify project board: ${error.message}`,
        });
    }
    return checks;
}
/**
 * Test-render templates with mock data to catch syntax errors
 */
function checkTemplates(chadgiDir, configContent) {
    const checks = [];
    const promptTemplate = parseYamlValue(configContent, 'prompt_template') || './chadgi-task.md';
    const generateTemplate = parseYamlValue(configContent, 'generate_template') || './chadgi-generate-task.md';
    const templatePath = promptTemplate.startsWith('/') ? promptTemplate : join(chadgiDir, promptTemplate);
    const generateTemplatePath = generateTemplate.startsWith('/') ? generateTemplate : join(chadgiDir, generateTemplate);
    const templates = [
        { path: templatePath, name: 'Task Template' },
        { path: generateTemplatePath, name: 'Generate Template' },
    ];
    for (const { path, name } of templates) {
        if (!existsSync(path)) {
            checks.push({
                name: `${name} Syntax`,
                category: 'templates',
                status: 'error',
                message: `Template not found: ${path}`,
            });
            continue;
        }
        // Use the existing validateTemplateVariables function from validate.ts
        const validation = validateTemplateVariables(path, []);
        if (validation.unknownVariables.length === 0) {
            checks.push({
                name: `${name} Syntax`,
                category: 'templates',
                status: 'ok',
                message: 'All template variables valid',
            });
        }
        else {
            const unknownVars = validation.unknownVariables
                .slice(0, 3)
                .map(v => `{{${v.variable}}}`)
                .join(', ');
            const moreCount = validation.unknownVariables.length - 3;
            const more = moreCount > 0 ? ` and ${moreCount} more` : '';
            checks.push({
                name: `${name} Syntax`,
                category: 'templates',
                status: 'warning',
                message: `Unknown variables: ${unknownVars}${more}`,
            });
        }
    }
    return checks;
}
/**
 * Check for pending/interrupted tasks in progress.json
 */
function checkProgressFile(chadgiDir) {
    const checks = [];
    const progressFile = join(chadgiDir, 'chadgi-progress.json');
    if (!existsSync(progressFile)) {
        checks.push({
            name: 'Progress File Check',
            category: 'state',
            status: 'ok',
            message: 'No progress file found (clean state)',
        });
        return checks;
    }
    try {
        const progress = JSON.parse(readFileSync(progressFile, 'utf-8'));
        if (progress.status === 'in_progress' && progress.current_task) {
            const startedAt = new Date(progress.current_task.started_at);
            const hoursAgo = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);
            if (hoursAgo > 2) {
                checks.push({
                    name: 'Progress File Check',
                    category: 'state',
                    status: 'warning',
                    message: `Potentially interrupted task #${progress.current_task.id} started ${hoursAgo.toFixed(1)} hours ago`,
                });
            }
            else {
                checks.push({
                    name: 'Progress File Check',
                    category: 'state',
                    status: 'ok',
                    message: `Task #${progress.current_task.id} in progress (${hoursAgo.toFixed(1)} hours)`,
                });
            }
        }
        else if (progress.status === 'paused') {
            checks.push({
                name: 'Progress File Check',
                category: 'state',
                status: 'ok',
                message: 'ChadGI is paused',
            });
        }
        else if (progress.status === 'error') {
            checks.push({
                name: 'Progress File Check',
                category: 'state',
                status: 'warning',
                message: 'Last session ended with an error',
            });
        }
        else {
            checks.push({
                name: 'Progress File Check',
                category: 'state',
                status: 'ok',
                message: `Status: ${progress.status}`,
            });
        }
    }
    catch (error) {
        checks.push({
            name: 'Progress File Check',
            category: 'state',
            status: 'warning',
            message: `Could not parse progress file: ${error.message}`,
        });
    }
    return checks;
}
/**
 * Report disk space available in repo directory
 */
function checkDiskSpace() {
    const checks = [];
    try {
        // Use df command to get disk space
        const output = execSync('df -h .', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/);
            // Format: Filesystem Size Used Avail Use% Mounted
            const available = parts[3];
            const usePercent = parseInt(parts[4]);
            if (usePercent >= 95) {
                checks.push({
                    name: 'Disk Space',
                    category: 'environment',
                    status: 'error',
                    message: `Critical: Only ${available} available (${usePercent}% used)`,
                });
            }
            else if (usePercent >= 85) {
                checks.push({
                    name: 'Disk Space',
                    category: 'environment',
                    status: 'warning',
                    message: `Low disk space: ${available} available (${usePercent}% used)`,
                });
            }
            else {
                checks.push({
                    name: 'Disk Space',
                    category: 'environment',
                    status: 'ok',
                    message: `${available} available (${usePercent}% used)`,
                });
            }
        }
    }
    catch (error) {
        checks.push({
            name: 'Disk Space',
            category: 'environment',
            status: 'warning',
            message: `Could not check disk space: ${error.message}`,
        });
    }
    return checks;
}
/**
 * Summarize recent errors from diagnostics folder
 */
function checkDiagnosticsFolder(chadgiDir) {
    const checks = [];
    const diagnosticsDir = join(chadgiDir, 'diagnostics');
    if (!existsSync(diagnosticsDir)) {
        checks.push({
            name: 'Recent Errors',
            category: 'diagnostics',
            status: 'ok',
            message: 'No diagnostics folder found (no recent errors)',
        });
        return checks;
    }
    try {
        const entries = readdirSync(diagnosticsDir)
            .filter(name => {
            const entryPath = join(diagnosticsDir, name);
            return statSync(entryPath).isDirectory();
        })
            .sort()
            .reverse();
        if (entries.length === 0) {
            checks.push({
                name: 'Recent Errors',
                category: 'diagnostics',
                status: 'ok',
                message: 'No diagnostic entries found',
            });
            return checks;
        }
        // Filter to last 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentEntries = entries.filter(name => {
            const entryPath = join(diagnosticsDir, name);
            const stats = statSync(entryPath);
            return stats.mtime.getTime() > sevenDaysAgo;
        });
        if (recentEntries.length === 0) {
            checks.push({
                name: 'Recent Errors',
                category: 'diagnostics',
                status: 'ok',
                message: `No errors in last 7 days (${entries.length} historical entries)`,
            });
        }
        else if (recentEntries.length <= 2) {
            checks.push({
                name: 'Recent Errors',
                category: 'diagnostics',
                status: 'ok',
                message: `${recentEntries.length} error(s) in last 7 days`,
            });
        }
        else if (recentEntries.length <= 5) {
            checks.push({
                name: 'Recent Errors',
                category: 'diagnostics',
                status: 'warning',
                message: `${recentEntries.length} errors in last 7 days. Check diagnostics folder.`,
            });
        }
        else {
            checks.push({
                name: 'Recent Errors',
                category: 'diagnostics',
                status: 'error',
                message: `High error rate: ${recentEntries.length} errors in last 7 days`,
            });
        }
    }
    catch (error) {
        checks.push({
            name: 'Recent Errors',
            category: 'diagnostics',
            status: 'warning',
            message: `Could not read diagnostics folder: ${error.message}`,
        });
    }
    return checks;
}
/**
 * Calculate health score based on check results
 */
function calculateHealthScore(checks) {
    if (checks.length === 0)
        return 100;
    let score = 100;
    // Weights by category
    const categoryWeights = {
        api: 15,
        github: 20,
        state: 15,
        files: 10,
        git: 10,
        templates: 15,
        environment: 10,
        diagnostics: 5,
        locks: 10,
        telemetry: 5,
    };
    // Penalty multipliers by status
    const statusPenalties = {
        error: 1.0,
        warning: 0.5,
        ok: 0,
    };
    for (const check of checks) {
        const weight = categoryWeights[check.category] || 10;
        const penalty = statusPenalties[check.status] || 0;
        score -= weight * penalty;
    }
    // Normalize score
    return Math.max(0, Math.min(100, Math.round(score)));
}
/**
 * Generate recommendations based on check results
 */
function generateRecommendations(checks) {
    const recommendations = [];
    for (const check of checks) {
        if (check.status === 'error') {
            switch (check.category) {
                case 'api':
                    recommendations.push('Wait for GitHub API rate limit to reset before running tasks');
                    break;
                case 'github':
                    if (check.name.includes('Project Board')) {
                        recommendations.push('Run `chadgi setup-project` to configure your project board');
                    }
                    break;
                case 'templates':
                    recommendations.push('Fix template errors to ensure proper task generation');
                    break;
                case 'environment':
                    if (check.name === 'Disk Space') {
                        recommendations.push('Free up disk space before running ChadGI');
                    }
                    break;
                case 'diagnostics':
                    recommendations.push('Review recent failures in .chadgi/diagnostics/ folder');
                    break;
            }
        }
        else if (check.status === 'warning') {
            if (check.fixable && !check.fixed) {
                recommendations.push(`Run \`chadgi doctor --fix\` to auto-fix: ${check.name}`);
            }
            if (check.name === 'Orphaned Branches Check') {
                recommendations.push('Consider cleaning up orphaned feature branches');
            }
            if (check.name.includes('Progress File') && check.message.includes('interrupted')) {
                recommendations.push('Check if an interrupted task needs manual resolution');
            }
            if (check.name === 'Task Locks Check' && check.message.includes('stale')) {
                recommendations.push('Run `chadgi unlock --stale` to clean up stale task locks');
            }
            if (check.name === 'Config Version Migration') {
                recommendations.push('Run `chadgi config migrate` to update your configuration schema');
            }
        }
    }
    // Remove duplicates
    return [...new Set(recommendations)];
}
/**
 * Print health report to console
 */
function printReport(report) {
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('                    CHADGI DOCTOR                          ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
    // Health score with color coding
    let scoreColor = colors.green;
    if (report.healthScore < 70) {
        scoreColor = colors.red;
    }
    else if (report.healthScore < 85) {
        scoreColor = colors.yellow;
    }
    console.log(`${colors.cyan}${colors.bold}Health Score:${colors.reset} ${scoreColor}${colors.bold}${report.healthScore}/100${colors.reset}`);
    console.log('');
    // Summary
    console.log(`${colors.dim}Summary: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.errors} errors${colors.reset}`);
    console.log('');
    // Group checks by category
    const categories = [...new Set(report.checks.map(c => c.category))];
    for (const category of categories) {
        const categoryChecks = report.checks.filter(c => c.category === category);
        const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
        console.log(`${colors.cyan}${colors.bold}${categoryTitle}${colors.reset}`);
        for (const check of categoryChecks) {
            let icon;
            let color;
            switch (check.status) {
                case 'ok':
                    icon = '+';
                    color = colors.green;
                    break;
                case 'warning':
                    icon = '!';
                    color = colors.yellow;
                    break;
                case 'error':
                    icon = 'x';
                    color = colors.red;
                    break;
                default:
                    icon = '?';
                    color = colors.dim;
            }
            const fixedIndicator = check.fixed ? ` ${colors.green}(fixed)${colors.reset}` : '';
            console.log(`  ${color}${icon}${colors.reset} ${check.name}: ${check.message}${fixedIndicator}`);
        }
        console.log('');
    }
    // Recommendations
    if (report.recommendations.length > 0) {
        console.log(`${colors.yellow}${colors.bold}Recommendations:${colors.reset}`);
        for (const rec of report.recommendations) {
            console.log(`  ${colors.yellow}*${colors.reset} ${rec}`);
        }
        console.log('');
    }
    // Footer
    if (report.healthScore >= 85) {
        console.log(`${colors.green}${colors.bold}ChadGI is healthy and ready to work!${colors.reset}`);
    }
    else if (report.healthScore >= 70) {
        console.log(`${colors.yellow}${colors.bold}ChadGI can run but some issues should be addressed.${colors.reset}`);
    }
    else {
        console.log(`${colors.red}${colors.bold}ChadGI has issues that should be fixed before running.${colors.reset}`);
    }
    console.log('');
    console.log(`${colors.purple}${colors.bold}==========================================================`);
    console.log('               Chad does what Chad wants.');
    console.log(`==========================================================${colors.reset}`);
}
/**
 * Doctor command handler using middleware pattern.
 *
 * Note how the handler is now focused purely on business logic:
 * - No try/catch needed (handled by withErrorHandler)
 * - No config path resolution (handled by withDirectory)
 * - No directory validation (handled by withDirectoryValidation)
 * - JSON output is handled automatically when result.data is returned
 */
async function doctorHandler(ctx) {
    const { chadgiDir, configPath, options } = ctx;
    const fix = options.fix || false;
    // Handle --no-mask flag (Commander sets mask=false when --no-mask is used)
    const noMask = options.mask === false;
    if (noMask) {
        setMaskingDisabled(true);
        if (!options.json) {
            console.log(`${colors.yellow}WARNING: Secret masking is DISABLED. Sensitive data may be exposed in output.${colors.reset}\n`);
        }
    }
    if (!options.json) {
        console.log('Running ChadGI health checks...\n');
    }
    const checks = [];
    // Load config for project-specific checks
    let configContent = '';
    let repo = 'owner/repo';
    let projectNumber = '1';
    let branchPrefix = 'feature/issue-';
    let readyColumn = 'Ready';
    let inProgressColumn = 'In Progress';
    let reviewColumn = 'In Review';
    if (existsSync(configPath)) {
        configContent = readFileSync(configPath, 'utf-8');
        repo = parseYamlNested(configContent, 'github', 'repo') || repo;
        projectNumber = parseYamlNested(configContent, 'github', 'project_number') || projectNumber;
        branchPrefix = parseYamlNested(configContent, 'branch', 'prefix') || branchPrefix;
        readyColumn = parseYamlNested(configContent, 'github', 'ready_column') || readyColumn;
        inProgressColumn = parseYamlNested(configContent, 'github', 'in_progress_column') || inProgressColumn;
        reviewColumn = parseYamlNested(configContent, 'github', 'review_column') || reviewColumn;
        checks.push({
            name: 'Configuration File',
            category: 'files',
            status: 'ok',
            message: `Loaded from ${configPath}`,
        });
        // Check for pending migrations
        const migrationCheck = checkMigrations(configPath);
        if (migrationCheck.needsMigration) {
            const currentVer = migrationCheck.currentVersion || DEFAULT_CONFIG_VERSION;
            checks.push({
                name: 'Config Version Migration',
                category: 'files',
                status: 'warning',
                message: `Migration available: ${currentVer} -> ${CURRENT_CONFIG_VERSION}. Run 'chadgi config migrate'`,
                fixable: true,
                fixed: false,
            });
        }
        else {
            checks.push({
                name: 'Config Version',
                category: 'files',
                status: 'ok',
                message: `Version ${CURRENT_CONFIG_VERSION} (current)`,
            });
        }
    }
    else {
        checks.push({
            name: 'Configuration File',
            category: 'files',
            status: 'error',
            message: `Not found: ${configPath}`,
        });
    }
    // Run all health checks
    const requiredColumns = [readyColumn, inProgressColumn, reviewColumn];
    // API checks
    checks.push(...(await checkRateLimit()));
    // File checks
    checks.push(...checkStaleLockFiles(chadgiDir, fix));
    // Task locks checks
    checks.push(...checkStaleTaskLocks(chadgiDir, fix));
    // Git checks (only if repo is configured)
    if (repo !== 'owner/repo') {
        checks.push(...(await checkOrphanedBranches(repo, branchPrefix)));
        // Project board checks
        checks.push(...(await checkProjectBoard(repo, projectNumber, requiredColumns)));
    }
    else {
        checks.push({
            name: 'Repository Configuration',
            category: 'github',
            status: 'warning',
            message: 'Repository not configured (using default owner/repo)',
        });
    }
    // Template checks
    if (configContent) {
        checks.push(...checkTemplates(chadgiDir, configContent));
    }
    // State checks
    checks.push(...checkProgressFile(chadgiDir));
    // Environment checks
    checks.push(...checkDiskSpace());
    // Diagnostics checks
    checks.push(...checkDiagnosticsFolder(chadgiDir));
    // Telemetry checks
    if (configContent) {
        checks.push(...(await checkTelemetryConfig(configContent)));
    }
    // Build report
    const healthScore = calculateHealthScore(checks);
    const recommendations = generateRecommendations(checks);
    const report = {
        timestamp: new Date().toISOString(),
        healthScore,
        checks,
        recommendations,
        summary: {
            total: checks.length,
            passed: checks.filter(c => c.status === 'ok').length,
            warnings: checks.filter(c => c.status === 'warning').length,
            errors: checks.filter(c => c.status === 'error').length,
        },
    };
    // Output (apply secret masking to report messages)
    const maskedReport = maskObject(report);
    if (options.json) {
        return { data: maskedReport };
    }
    printReport(maskedReport);
    // Exit with error code if health score is critical
    if (healthScore < 50) {
        process.exit(1);
    }
    return { success: true };
}
/**
 * Doctor command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 * 5. withDirectoryValidation - ensures .chadgi directory exists
 */
export const doctorMiddleware = withCommand([withDirectory, withDirectoryValidation], doctorHandler);
//# sourceMappingURL=doctor-middleware.js.map