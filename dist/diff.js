import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync, spawnSync } from 'child_process';
// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    purple: '\x1b[35m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
};
// Parse nested YAML value
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
// Get current git branch
function getCurrentBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
    }
    catch {
        return null;
    }
}
// Extract issue number from branch name using prefix
function extractIssueNumber(branch, branchPrefix) {
    // Handle full prefix like "feature/issue-" and extract number after it
    if (branch.startsWith(branchPrefix)) {
        const afterPrefix = branch.substring(branchPrefix.length);
        // Extract the number at the beginning (before any other text like -description)
        const match = afterPrefix.match(/^(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    return null;
}
// Find branch for a specific issue number
function findBranchForIssue(issueNumber, branchPrefix) {
    try {
        const output = execSync('git branch -a', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const branches = output.split('\n').map(b => b.trim().replace(/^\*?\s*/, '').replace(/^remotes\/origin\//, ''));
        // Look for branches matching the pattern
        const pattern = `${branchPrefix}${issueNumber}`;
        for (const branch of branches) {
            if (branch.startsWith(pattern)) {
                return branch;
            }
        }
    }
    catch {
        return null;
    }
    return null;
}
// Check if branch exists
function branchExists(branch) {
    try {
        execSync(`git rev-parse --verify "${branch}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return true;
    }
    catch {
        return false;
    }
}
// Get diff statistics using git diff --stat
function getDiffStats(baseBranch, targetBranch) {
    try {
        const output = execSync(`git diff --stat "${baseBranch}...${targetBranch}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Parse the summary line like: " 5 files changed, 100 insertions(+), 20 deletions(-)"
        const summaryMatch = output.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
        if (summaryMatch) {
            return {
                filesChanged: parseInt(summaryMatch[1], 10) || 0,
                insertions: parseInt(summaryMatch[2], 10) || 0,
                deletions: parseInt(summaryMatch[3], 10) || 0,
            };
        }
    }
    catch {
        // Ignore errors
    }
    return { filesChanged: 0, insertions: 0, deletions: 0 };
}
// Get list of changed files with their status
function getChangedFiles(baseBranch, targetBranch) {
    const files = [];
    try {
        // Get list of files with status and stats
        const output = execSync(`git diff --numstat --diff-filter=AMDRT "${baseBranch}...${targetBranch}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Get file status separately
        const statusOutput = execSync(`git diff --name-status "${baseBranch}...${targetBranch}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // Parse status output to get file status
        const statusMap = new Map();
        for (const line of statusOutput.split('\n')) {
            if (!line.trim())
                continue;
            const parts = line.split('\t');
            const statusCode = parts[0];
            const file = parts.length > 2 ? parts[2] : parts[1]; // For renames, new name is second
            let status = 'modified';
            let oldPath;
            if (statusCode.startsWith('A')) {
                status = 'added';
            }
            else if (statusCode.startsWith('D')) {
                status = 'deleted';
            }
            else if (statusCode.startsWith('R')) {
                status = 'renamed';
                oldPath = parts[1];
            }
            else if (statusCode.startsWith('M')) {
                status = 'modified';
            }
            statusMap.set(file, { status, oldPath });
        }
        // Parse numstat output for insertions/deletions
        for (const line of output.split('\n')) {
            if (!line.trim())
                continue;
            const parts = line.split('\t');
            if (parts.length >= 3) {
                const insertions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
                const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
                const file = parts[2];
                const statusInfo = statusMap.get(file) || { status: 'modified' };
                files.push({
                    file,
                    status: statusInfo.status,
                    insertions,
                    deletions,
                    oldPath: statusInfo.oldPath,
                });
            }
        }
    }
    catch {
        // Ignore errors
    }
    return files;
}
// Get commit messages between branches
function getCommits(baseBranch, targetBranch) {
    const commits = [];
    try {
        const output = execSync(`git log --format="%H|%h|%s|%an|%aI" "${baseBranch}..${targetBranch}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        for (const line of output.split('\n')) {
            if (!line.trim())
                continue;
            const [sha, shortSha, message, author, date] = line.split('|');
            commits.push({ sha, shortSha, message, author, date });
        }
    }
    catch {
        // Ignore errors
    }
    return commits;
}
// Get full diff output
function getFullDiff(baseBranch, targetBranch) {
    try {
        return execSync(`git diff "${baseBranch}...${targetBranch}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large diffs
        });
    }
    catch {
        return '';
    }
}
// Get PR diff from GitHub
function getPrDiff(repo, prNumber) {
    try {
        const prInfo = execSync(`gh pr view ${prNumber} --repo "${repo}" --json baseRefName,headRefName`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const { baseRefName, headRefName } = JSON.parse(prInfo);
        const diff = execSync(`gh pr diff ${prNumber} --repo "${repo}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 50 * 1024 * 1024,
        });
        return { diff, baseBranch: baseRefName, headBranch: headRefName };
    }
    catch {
        return null;
    }
}
// Check if an external diff tool is available
function findDiffTool() {
    const tools = ['delta', 'diff-so-fancy', 'colordiff'];
    for (const tool of tools) {
        try {
            execSync(`which ${tool}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
            return tool;
        }
        catch {
            // Tool not found, continue
        }
    }
    return null;
}
// Apply syntax highlighting to diff output
function highlightDiff(diff, useExternalTool = true) {
    if (!diff)
        return '';
    // Try external tool first
    if (useExternalTool) {
        const tool = findDiffTool();
        if (tool) {
            try {
                const result = spawnSync(tool, [], {
                    input: diff,
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    maxBuffer: 50 * 1024 * 1024,
                });
                if (result.stdout) {
                    return result.stdout;
                }
            }
            catch {
                // Fall through to basic highlighting
            }
        }
    }
    // Basic syntax highlighting
    const lines = diff.split('\n');
    const highlighted = [];
    for (const line of lines) {
        if (line.startsWith('+++') || line.startsWith('---')) {
            highlighted.push(`${colors.bold}${line}${colors.reset}`);
        }
        else if (line.startsWith('@@')) {
            highlighted.push(`${colors.cyan}${line}${colors.reset}`);
        }
        else if (line.startsWith('+')) {
            highlighted.push(`${colors.green}${line}${colors.reset}`);
        }
        else if (line.startsWith('-')) {
            highlighted.push(`${colors.red}${line}${colors.reset}`);
        }
        else if (line.startsWith('diff --git')) {
            highlighted.push(`${colors.bold}${colors.blue}${line}${colors.reset}`);
        }
        else if (line.startsWith('index ')) {
            highlighted.push(`${colors.dim}${line}${colors.reset}`);
        }
        else {
            highlighted.push(line);
        }
    }
    return highlighted.join('\n');
}
// Format date for display
function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
// Print stat view (condensed statistics)
function printStatView(result) {
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('                    CHADGI DIFF                           ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
    if (result.issueNumber) {
        console.log(`${colors.cyan}Issue:${colors.reset}   #${result.issueNumber}`);
    }
    if (result.prNumber) {
        console.log(`${colors.cyan}PR:${colors.reset}      #${result.prNumber}`);
    }
    console.log(`${colors.cyan}Branch:${colors.reset}  ${result.branch}`);
    console.log(`${colors.cyan}Base:${colors.reset}    ${result.baseBranch}`);
    console.log('');
    // Commits
    if (result.commits.length > 0) {
        console.log(`${colors.cyan}${colors.bold}Commits (${result.commits.length})${colors.reset}`);
        for (const commit of result.commits) {
            console.log(`  ${colors.yellow}${commit.shortSha}${colors.reset} ${commit.message}`);
        }
        console.log('');
    }
    // Summary
    console.log(`${colors.cyan}${colors.bold}Summary${colors.reset}`);
    console.log(`  ${colors.white}${result.filesChanged}${colors.reset} files changed`);
    console.log(`  ${colors.green}+${result.insertions}${colors.reset} insertions`);
    console.log(`  ${colors.red}-${result.deletions}${colors.reset} deletions`);
    console.log('');
    // Files with stats
    console.log(`${colors.cyan}${colors.bold}Changes${colors.reset}`);
    for (const file of result.files) {
        const statusColor = file.status === 'added' ? colors.green :
            file.status === 'deleted' ? colors.red :
                file.status === 'renamed' ? colors.yellow : colors.white;
        const statusIcon = file.status === 'added' ? '+' :
            file.status === 'deleted' ? '-' :
                file.status === 'renamed' ? 'R' : 'M';
        const stats = `${colors.green}+${file.insertions}${colors.reset} ${colors.red}-${file.deletions}${colors.reset}`;
        let displayPath = file.file;
        if (file.status === 'renamed' && file.oldPath) {
            displayPath = `${file.oldPath} -> ${file.file}`;
        }
        console.log(`  ${statusColor}${statusIcon}${colors.reset} ${displayPath.padEnd(50)} ${stats}`);
    }
    console.log('');
    console.log(`${colors.purple}${colors.bold}==========================================================`);
    console.log('               Chad does what Chad wants.');
    console.log(`==========================================================${colors.reset}`);
}
// Print files-only view
function printFilesView(result) {
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('                 CHADGI DIFF - FILES                      ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
    if (result.issueNumber) {
        console.log(`${colors.cyan}Issue:${colors.reset}   #${result.issueNumber}`);
    }
    if (result.prNumber) {
        console.log(`${colors.cyan}PR:${colors.reset}      #${result.prNumber}`);
    }
    console.log(`${colors.cyan}Branch:${colors.reset}  ${result.branch}`);
    console.log(`${colors.cyan}Base:${colors.reset}    ${result.baseBranch}`);
    console.log('');
    console.log(`${colors.cyan}${colors.bold}Modified Files (${result.filesChanged})${colors.reset}`);
    console.log('');
    for (const file of result.files) {
        const statusColor = file.status === 'added' ? colors.green :
            file.status === 'deleted' ? colors.red :
                file.status === 'renamed' ? colors.yellow : colors.white;
        const statusLabel = file.status === 'added' ? '[A]' :
            file.status === 'deleted' ? '[D]' :
                file.status === 'renamed' ? '[R]' : '[M]';
        let displayPath = file.file;
        if (file.status === 'renamed' && file.oldPath) {
            displayPath = `${file.oldPath} -> ${file.file}`;
        }
        console.log(`  ${statusColor}${statusLabel}${colors.reset} ${displayPath}`);
    }
    console.log('');
    console.log(`${colors.purple}${colors.bold}==========================================================`);
    console.log('               Chad does what Chad wants.');
    console.log(`==========================================================${colors.reset}`);
}
// Print full diff view with commits and syntax highlighting
function printFullDiff(result, diff) {
    console.log(`${colors.purple}${colors.bold}`);
    console.log('==========================================================');
    console.log('                    CHADGI DIFF                           ');
    console.log('==========================================================');
    console.log(`${colors.reset}`);
    if (result.issueNumber) {
        console.log(`${colors.cyan}Issue:${colors.reset}   #${result.issueNumber}`);
    }
    if (result.prNumber) {
        console.log(`${colors.cyan}PR:${colors.reset}      #${result.prNumber}`);
    }
    console.log(`${colors.cyan}Branch:${colors.reset}  ${result.branch}`);
    console.log(`${colors.cyan}Base:${colors.reset}    ${result.baseBranch}`);
    console.log(`${colors.cyan}Changes:${colors.reset} ${result.filesChanged} files, ${colors.green}+${result.insertions}${colors.reset} / ${colors.red}-${result.deletions}${colors.reset}`);
    console.log('');
    // Commits
    if (result.commits.length > 0) {
        console.log(`${colors.cyan}${colors.bold}Commits (${result.commits.length})${colors.reset}`);
        for (const commit of result.commits) {
            console.log(`  ${colors.yellow}${commit.shortSha}${colors.reset} ${commit.message}`);
            console.log(`    ${colors.dim}${commit.author} - ${formatDate(commit.date)}${colors.reset}`);
        }
        console.log('');
    }
    // Diff output
    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
    console.log('');
    const highlightedDiff = highlightDiff(diff);
    console.log(highlightedDiff);
    console.log('');
    console.log(`${colors.purple}${colors.bold}==========================================================`);
    console.log('               Chad does what Chad wants.');
    console.log(`==========================================================${colors.reset}`);
}
// Main diff function
export async function diff(issueNumber, options = {}) {
    const cwd = process.cwd();
    const defaultConfigPath = join(cwd, '.chadgi', 'chadgi-config.yaml');
    const configPath = options.config ? resolve(options.config) : defaultConfigPath;
    const chadgiDir = dirname(configPath);
    // Check if .chadgi directory exists
    if (!existsSync(chadgiDir)) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: '.chadgi directory not found' }, null, 2));
        }
        else {
            console.error(`${colors.red}Error: .chadgi directory not found.${colors.reset}`);
            console.error(`Run ${colors.cyan}chadgi init${colors.reset} to initialize ChadGI.`);
        }
        process.exit(1);
    }
    // Load config
    let baseBranch = 'main';
    let branchPrefix = 'feature/issue-';
    let repo = 'owner/repo';
    if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf-8');
        baseBranch = parseYamlNested(configContent, 'branch', 'base') || baseBranch;
        branchPrefix = parseYamlNested(configContent, 'branch', 'prefix') || branchPrefix;
        repo = parseYamlNested(configContent, 'github', 'repo') || repo;
    }
    // Handle --pr option
    if (options.pr !== undefined) {
        const prData = getPrDiff(repo, options.pr);
        if (!prData) {
            if (options.json) {
                console.log(JSON.stringify({ success: false, error: `Could not fetch PR #${options.pr}` }, null, 2));
            }
            else {
                console.error(`${colors.red}Error: Could not fetch PR #${options.pr}.${colors.reset}`);
                console.error('Make sure the PR exists and you have access to it.');
            }
            process.exit(1);
        }
        // Parse stats from diff output
        const fileChanges = parseFilesFromDiff(prData.diff);
        const stats = computeStatsFromFiles(fileChanges);
        const result = {
            success: true,
            branch: prData.headBranch,
            baseBranch: prData.baseBranch,
            prNumber: options.pr,
            filesChanged: stats.filesChanged,
            insertions: stats.insertions,
            deletions: stats.deletions,
            files: fileChanges,
            commits: [], // PR diff doesn't include commits
        };
        if (options.output) {
            writeFileSync(options.output, prData.diff);
            if (!options.json) {
                console.log(`${colors.green}Diff saved to ${options.output}${colors.reset}`);
            }
        }
        if (options.json) {
            result.diff = prData.diff;
            console.log(JSON.stringify(result, null, 2));
        }
        else if (options.stat) {
            printStatView(result);
        }
        else if (options.files) {
            printFilesView(result);
        }
        else if (!options.output) {
            printFullDiff(result, prData.diff);
        }
        return;
    }
    // Determine target branch
    let targetBranch = null;
    let resolvedIssueNumber;
    if (issueNumber !== undefined) {
        // Find branch for specific issue
        targetBranch = findBranchForIssue(issueNumber, branchPrefix);
        resolvedIssueNumber = issueNumber;
        if (!targetBranch) {
            if (options.json) {
                console.log(JSON.stringify({ success: false, error: `No branch found for issue #${issueNumber}` }, null, 2));
            }
            else {
                console.error(`${colors.red}Error: No branch found for issue #${issueNumber}.${colors.reset}`);
                console.error(`Expected branch pattern: ${branchPrefix}${issueNumber}*`);
            }
            process.exit(1);
        }
    }
    else {
        // Use current branch
        targetBranch = getCurrentBranch();
        if (!targetBranch) {
            if (options.json) {
                console.log(JSON.stringify({ success: false, error: 'Could not determine current branch' }, null, 2));
            }
            else {
                console.error(`${colors.red}Error: Could not determine current branch.${colors.reset}`);
            }
            process.exit(1);
        }
        // Try to extract issue number from current branch
        resolvedIssueNumber = extractIssueNumber(targetBranch, branchPrefix) ?? undefined;
    }
    // Check if target branch exists
    if (!branchExists(targetBranch)) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: `Branch '${targetBranch}' does not exist` }, null, 2));
        }
        else {
            console.error(`${colors.red}Error: Branch '${targetBranch}' does not exist.${colors.reset}`);
        }
        process.exit(1);
    }
    // Check if base branch exists
    if (!branchExists(baseBranch)) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: `Base branch '${baseBranch}' does not exist` }, null, 2));
        }
        else {
            console.error(`${colors.red}Error: Base branch '${baseBranch}' does not exist.${colors.reset}`);
        }
        process.exit(1);
    }
    // Get diff data
    const stats = getDiffStats(baseBranch, targetBranch);
    const files = getChangedFiles(baseBranch, targetBranch);
    const commits = getCommits(baseBranch, targetBranch);
    const fullDiff = getFullDiff(baseBranch, targetBranch);
    const result = {
        success: true,
        branch: targetBranch,
        baseBranch,
        issueNumber: resolvedIssueNumber,
        filesChanged: stats.filesChanged,
        insertions: stats.insertions,
        deletions: stats.deletions,
        files,
        commits,
    };
    // Handle output file
    if (options.output) {
        writeFileSync(options.output, fullDiff);
        if (!options.json) {
            console.log(`${colors.green}Diff saved to ${options.output}${colors.reset}`);
        }
    }
    // Output based on mode
    if (options.json) {
        result.diff = fullDiff;
        console.log(JSON.stringify(result, null, 2));
    }
    else if (options.stat) {
        printStatView(result);
    }
    else if (options.files) {
        printFilesView(result);
    }
    else if (!options.output) {
        printFullDiff(result, fullDiff);
    }
}
// Parse files from raw diff output (for PR diffs)
function parseFilesFromDiff(diff) {
    const files = [];
    const fileMatches = diff.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm);
    for (const match of fileMatches) {
        const oldPath = match[1];
        const newPath = match[2];
        // Find the chunk for this file and count insertions/deletions
        const fileIndex = match.index || 0;
        const nextFileMatch = diff.indexOf('diff --git', fileIndex + 1);
        const fileContent = nextFileMatch === -1
            ? diff.substring(fileIndex)
            : diff.substring(fileIndex, nextFileMatch);
        let insertions = 0;
        let deletions = 0;
        for (const line of fileContent.split('\n')) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                insertions++;
            }
            else if (line.startsWith('-') && !line.startsWith('---')) {
                deletions++;
            }
        }
        // Determine status
        let status = 'modified';
        if (fileContent.includes('new file mode')) {
            status = 'added';
        }
        else if (fileContent.includes('deleted file mode')) {
            status = 'deleted';
        }
        else if (oldPath !== newPath) {
            status = 'renamed';
        }
        files.push({
            file: newPath,
            status,
            insertions,
            deletions,
            oldPath: status === 'renamed' ? oldPath : undefined,
        });
    }
    return files;
}
// Compute stats from file changes
function computeStatsFromFiles(files) {
    return {
        filesChanged: files.length,
        insertions: files.reduce((sum, f) => sum + f.insertions, 0),
        deletions: files.reduce((sum, f) => sum + f.deletions, 0),
    };
}
// Diff for a specific PR number
export async function diffPr(prNumber, options = {}) {
    return diff(undefined, { ...options, pr: prNumber });
}
//# sourceMappingURL=diff.js.map