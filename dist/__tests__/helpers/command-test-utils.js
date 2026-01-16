/**
 * Test utilities for command handler unit tests.
 *
 * Provides factory functions for creating mock contexts, configs,
 * and progress states for testing command handlers.
 */
// ============================================================================
// Default Test Values
// ============================================================================
/**
 * Default GitHub configuration for tests
 */
export const DEFAULT_GITHUB_CONFIG = {
    repo: 'test-owner/test-repo',
    project_number: '42',
    ready_column: 'Ready',
    in_progress_column: 'In Progress',
    review_column: 'In Review',
    done_column: 'Done',
};
/**
 * Default branch configuration for tests
 */
export const DEFAULT_BRANCH_CONFIG = {
    base: 'main',
    prefix: 'feature/issue-',
};
/**
 * Default test options
 */
export const DEFAULT_TEST_OPTIONS = {
    config: undefined,
    json: false,
    debug: false,
};
/**
 * Create a core context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A CoreContext suitable for testing
 */
export function createTestCoreContext(overrides = {}) {
    return {
        options: {
            ...DEFAULT_TEST_OPTIONS,
            ...overrides.options,
        },
        cwd: overrides.cwd || '/test/project',
    };
}
/**
 * Create a directory context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A DirectoryContext suitable for testing
 */
export function createTestDirectoryContext(overrides = {}) {
    const cwd = overrides.cwd || '/test/project';
    const chadgiDir = overrides.chadgiDir || `${cwd}/.chadgi`;
    const configPath = overrides.configPath || `${chadgiDir}/chadgi-config.yaml`;
    return {
        options: {
            ...DEFAULT_TEST_OPTIONS,
            ...overrides.options,
        },
        cwd,
        chadgiDir,
        configPath,
    };
}
/**
 * Create a config context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A ConfigContext suitable for testing
 */
export function createTestConfigContext(overrides = {}) {
    const directoryCtx = createTestDirectoryContext(overrides);
    const github = {
        ...DEFAULT_GITHUB_CONFIG,
        ...overrides.github,
    };
    const branch = {
        ...DEFAULT_BRANCH_CONFIG,
        ...overrides.branch,
    };
    return {
        ...directoryCtx,
        configContent: overrides.configContent || createMockConfigYaml(github, branch),
        github,
        branch,
        configExists: overrides.configExists ?? true,
    };
}
/**
 * Create a timed context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A TimedContext suitable for testing
 */
export function createTestTimedContext(overrides = {}) {
    const startTime = overrides.startTime || Date.now();
    return {
        options: {
            ...DEFAULT_TEST_OPTIONS,
            ...overrides.options,
        },
        cwd: overrides.cwd || '/test/project',
        startTime,
        getElapsedMs: () => Date.now() - startTime,
    };
}
/**
 * Create a full command context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A CommandContext suitable for testing
 */
export function createTestContext(overrides = {}) {
    const configCtx = createTestConfigContext(overrides);
    const timedCtx = createTestTimedContext(overrides);
    return {
        ...configCtx,
        ...timedCtx,
    };
}
/**
 * Create a mock ChadGI configuration object.
 *
 * @param overrides - Options to override defaults
 * @returns A ChadGIConfig object
 */
export function createMockConfig(overrides = {}) {
    return {
        config_version: '1.1',
        task_source: 'github-issues',
        prompt_template: './chadgi-task.md',
        generate_template: './chadgi-generate-task.md',
        progress_file: './chadgi-progress.json',
        github: {
            ...DEFAULT_GITHUB_CONFIG,
            ...overrides.github,
        },
        branch: {
            ...DEFAULT_BRANCH_CONFIG,
            ...overrides.branch,
        },
        poll_interval: 10,
        consecutive_empty_threshold: 2,
        on_empty_queue: 'generate',
        iteration: {
            max_iterations: overrides.iteration?.max_iterations ?? 5,
            completion_promise: 'COMPLETE',
            ready_promise: 'READY_FOR_PR',
            test_command: 'npm test',
            build_command: 'npm run build',
            on_max_iterations: 'skip',
            gigachad_mode: overrides.iteration?.gigachad_mode ?? false,
        },
        budget: overrides.budget ? {
            per_task_limit: overrides.budget.per_task_limit,
            per_session_limit: overrides.budget.per_session_limit,
            on_task_budget_exceeded: 'skip',
            on_session_budget_exceeded: 'stop',
            warning_threshold: 80,
        } : undefined,
    };
}
/**
 * Create mock YAML config content.
 *
 * @param github - GitHub config
 * @param branch - Branch config
 * @returns YAML string
 */
export function createMockConfigYaml(github = DEFAULT_GITHUB_CONFIG, branch = DEFAULT_BRANCH_CONFIG) {
    return `
github:
  repo: ${github.repo}
  project_number: ${github.project_number}
  ready_column: ${github.ready_column}
  in_progress_column: ${github.in_progress_column}
  review_column: ${github.review_column}
  done_column: ${github.done_column || 'Done'}
branch:
  base: ${branch.base}
  prefix: ${branch.prefix}
iteration:
  max_iterations: 5
  gigachad_mode: false
`;
}
/**
 * Create mock progress data.
 *
 * @param overrides - Options to override defaults
 * @returns ProgressData object
 */
export function createMockProgress(overrides = {}) {
    const now = new Date().toISOString();
    const result = {
        status: overrides.status ?? 'idle',
        last_updated: overrides.lastUpdated ?? now,
    };
    if (overrides.currentTask) {
        result.current_task = {
            id: overrides.currentTask.id ?? '42',
            title: overrides.currentTask.title ?? 'Test task',
            branch: overrides.currentTask.branch ?? 'feature/issue-42-test-task',
            started_at: overrides.currentTask.started_at ?? now,
        };
    }
    if (overrides.session) {
        result.session = {
            started_at: overrides.session.started_at ?? now,
            tasks_completed: overrides.session.tasks_completed ?? 0,
            total_cost_usd: overrides.session.total_cost_usd ?? 0,
        };
    }
    if (overrides.phase) {
        result.phase = overrides.phase;
    }
    return result;
}
/**
 * Create mock pause lock data.
 *
 * @param overrides - Options to override defaults
 * @returns PauseLockData object
 */
export function createMockPauseLock(overrides = {}) {
    return {
        paused_at: overrides.paused_at ?? new Date().toISOString(),
        reason: overrides.reason,
        resume_at: overrides.resume_at,
    };
}
/**
 * Create mock approval lock data.
 *
 * @param overrides - Options to override defaults
 * @returns ApprovalLockData object
 */
export function createMockApprovalLock(overrides = {}) {
    return {
        status: overrides.status ?? 'pending',
        created_at: overrides.created_at ?? new Date().toISOString(),
        issue_number: overrides.issue_number ?? 42,
        issue_title: overrides.issue_title ?? 'Test issue',
        branch: overrides.branch ?? 'feature/issue-42-test',
        phase: overrides.phase ?? 'phase1',
        files_changed: overrides.files_changed ?? 5,
        insertions: overrides.insertions ?? 100,
        deletions: overrides.deletions ?? 10,
    };
}
/**
 * Create mock task lock info.
 *
 * @param overrides - Options to override defaults
 * @returns TaskLockInfo object
 */
export function createMockTaskLockInfo(overrides = {}) {
    return {
        issueNumber: overrides.issueNumber ?? 42,
        sessionId: overrides.sessionId ?? 'test-session-123',
        pid: overrides.pid ?? 12345,
        hostname: overrides.hostname ?? 'test-host',
        lockedAt: overrides.lockedAt ?? new Date().toISOString(),
        lockedSeconds: overrides.lockedSeconds ?? 300,
        heartbeatAgeSeconds: overrides.heartbeatAgeSeconds ?? 10,
        isStale: overrides.isStale ?? false,
        workerId: overrides.workerId,
        repoName: overrides.repoName,
    };
}
/**
 * Create mock GitHub project items response.
 *
 * @param tasks - Array of task definitions
 * @returns JSON string suitable for mocking gh project item-list output
 */
export function createMockProjectItemsResponse(tasks) {
    return JSON.stringify({
        items: tasks.map((task) => ({
            id: task.itemId,
            status: task.status,
            content: {
                type: 'Issue',
                number: task.number,
                title: task.title,
                url: task.url,
            },
        })),
    });
}
/**
 * Create mock GitHub issue labels response.
 *
 * @param labels - Array of label names
 * @returns String suitable for mocking gh issue view --json labels output
 */
export function createMockIssueLabelsResponse(labels) {
    return labels.join('\n');
}
/**
 * Create mock GitHub issue body response.
 *
 * @param body - Issue body text
 * @returns String suitable for mocking gh issue view --json body output
 */
export function createMockIssueBodyResponse(body) {
    return body;
}
// ============================================================================
// Test Assertion Helpers
// ============================================================================
/**
 * Assert that a command result contains expected data.
 *
 * @param result - The command result
 * @param expectedKeys - Keys expected to be present in result.data
 */
export function assertResultHasData(result, expectedKeys) {
    if (!result) {
        throw new Error('Expected command result, got void');
    }
    if (result.data === undefined) {
        throw new Error('Expected command result.data, got undefined');
    }
    for (const key of expectedKeys) {
        if (!(key in result.data)) {
            throw new Error(`Expected result.data to have key "${key}"`);
        }
    }
}
/**
 * Assert that a command result indicates success.
 *
 * @param result - The command result
 */
export function assertResultSuccess(result) {
    if (!result) {
        throw new Error('Expected command result, got void');
    }
    if (result.success === false) {
        throw new Error(`Expected success, got failure: ${result.message}`);
    }
}
// ============================================================================
// File System Test Helpers
// ============================================================================
/**
 * Create a mock file system structure for testing.
 *
 * @param vol - memfs volume instance
 * @param chadgiDir - Path to .chadgi directory
 * @param files - Object mapping filenames to content
 */
export function setupMockFileSystem(vol, chadgiDir, files) {
    const fsStructure = {};
    for (const [filename, content] of Object.entries(files)) {
        const fullPath = filename.startsWith('/')
            ? filename
            : `${chadgiDir}/${filename}`;
        fsStructure[fullPath] = typeof content === 'string'
            ? content
            : JSON.stringify(content, null, 2);
    }
    vol.fromJSON(fsStructure);
}
/**
 * Create standard test file system with config and optional progress.
 *
 * @param vol - memfs volume instance
 * @param options - Options for the test setup
 */
export function setupStandardTestFileSystem(vol, options = {}) {
    const chadgiDir = options.chadgiDir || '/test/project/.chadgi';
    const github = { ...DEFAULT_GITHUB_CONFIG, ...options.github };
    const branch = { ...DEFAULT_BRANCH_CONFIG, ...options.branch };
    const files = {
        'chadgi-config.yaml': createMockConfigYaml(github, branch),
    };
    if (options.progress) {
        files['chadgi-progress.json'] = options.progress;
    }
    if (options.pauseLock) {
        files['pause.lock'] = options.pauseLock;
    }
    if (options.approvalLock) {
        files[`approval-${options.approvalLock.issue_number}.lock`] = options.approvalLock;
    }
    setupMockFileSystem(vol, chadgiDir, files);
}
//# sourceMappingURL=command-test-utils.js.map