/**
 * Test utilities for command handler unit tests.
 *
 * Provides factory functions for creating mock contexts, configs,
 * and progress states for testing command handlers.
 */
import type { BaseCommandOptions, GitHubConfig, BranchConfig, ProgressData, PauseLockData, ApprovalLockData, TaskLockInfo, ChadGIConfig, CurrentTask, SessionProgress } from '../../types/index.js';
import type { CoreContext, DirectoryContext, ConfigContext, TimedContext, CommandContext, CommandResult } from '../../utils/context.js';
/**
 * Default GitHub configuration for tests
 */
export declare const DEFAULT_GITHUB_CONFIG: GitHubConfig;
/**
 * Default branch configuration for tests
 */
export declare const DEFAULT_BRANCH_CONFIG: BranchConfig;
/**
 * Default test options
 */
export declare const DEFAULT_TEST_OPTIONS: BaseCommandOptions;
/**
 * Options for creating a test context
 */
export interface CreateTestContextOptions<T extends BaseCommandOptions = BaseCommandOptions> {
    /** Command options to merge with defaults */
    options?: Partial<T>;
    /** Current working directory */
    cwd?: string;
    /** Path to .chadgi directory */
    chadgiDir?: string;
    /** Path to config file */
    configPath?: string;
    /** Raw config YAML content */
    configContent?: string;
    /** GitHub configuration */
    github?: Partial<GitHubConfig>;
    /** Branch configuration */
    branch?: Partial<BranchConfig>;
    /** Whether config file exists */
    configExists?: boolean;
    /** Start time for timing context */
    startTime?: number;
}
/**
 * Create a core context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A CoreContext suitable for testing
 */
export declare function createTestCoreContext<T extends BaseCommandOptions = BaseCommandOptions>(overrides?: CreateTestContextOptions<T>): CoreContext<T>;
/**
 * Create a directory context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A DirectoryContext suitable for testing
 */
export declare function createTestDirectoryContext<T extends BaseCommandOptions = BaseCommandOptions>(overrides?: CreateTestContextOptions<T>): DirectoryContext<T>;
/**
 * Create a config context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A ConfigContext suitable for testing
 */
export declare function createTestConfigContext<T extends BaseCommandOptions = BaseCommandOptions>(overrides?: CreateTestContextOptions<T>): ConfigContext<T>;
/**
 * Create a timed context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A TimedContext suitable for testing
 */
export declare function createTestTimedContext<T extends BaseCommandOptions = BaseCommandOptions>(overrides?: CreateTestContextOptions<T>): TimedContext<T>;
/**
 * Create a full command context for testing.
 *
 * @param overrides - Options to override defaults
 * @returns A CommandContext suitable for testing
 */
export declare function createTestContext<T extends BaseCommandOptions = BaseCommandOptions>(overrides?: CreateTestContextOptions<T>): CommandContext<T>;
/**
 * Options for creating a mock config
 */
export interface CreateMockConfigOptions {
    github?: Partial<GitHubConfig>;
    branch?: Partial<BranchConfig>;
    iteration?: {
        max_iterations?: number;
        gigachad_mode?: boolean;
    };
    budget?: {
        per_task_limit?: number;
        per_session_limit?: number;
    };
}
/**
 * Create a mock ChadGI configuration object.
 *
 * @param overrides - Options to override defaults
 * @returns A ChadGIConfig object
 */
export declare function createMockConfig(overrides?: CreateMockConfigOptions): ChadGIConfig;
/**
 * Create mock YAML config content.
 *
 * @param github - GitHub config
 * @param branch - Branch config
 * @returns YAML string
 */
export declare function createMockConfigYaml(github?: GitHubConfig, branch?: BranchConfig): string;
/**
 * Options for creating mock progress data
 */
export interface CreateMockProgressOptions {
    status?: ProgressData['status'];
    currentTask?: Partial<CurrentTask>;
    session?: Partial<SessionProgress>;
    phase?: string;
    lastUpdated?: string;
}
/**
 * Create mock progress data.
 *
 * @param overrides - Options to override defaults
 * @returns ProgressData object
 */
export declare function createMockProgress(overrides?: CreateMockProgressOptions): ProgressData;
/**
 * Create mock pause lock data.
 *
 * @param overrides - Options to override defaults
 * @returns PauseLockData object
 */
export declare function createMockPauseLock(overrides?: Partial<PauseLockData>): PauseLockData;
/**
 * Create mock approval lock data.
 *
 * @param overrides - Options to override defaults
 * @returns ApprovalLockData object
 */
export declare function createMockApprovalLock(overrides?: Partial<ApprovalLockData>): ApprovalLockData;
/**
 * Create mock task lock info.
 *
 * @param overrides - Options to override defaults
 * @returns TaskLockInfo object
 */
export declare function createMockTaskLockInfo(overrides?: Partial<TaskLockInfo>): TaskLockInfo;
/**
 * Mock GitHub response for queue tasks
 */
export interface MockQueueTask {
    number: number;
    title: string;
    url: string;
    itemId: string;
    status: string;
    labels?: string[];
}
/**
 * Create mock GitHub project items response.
 *
 * @param tasks - Array of task definitions
 * @returns JSON string suitable for mocking gh project item-list output
 */
export declare function createMockProjectItemsResponse(tasks: MockQueueTask[]): string;
/**
 * Create mock GitHub issue labels response.
 *
 * @param labels - Array of label names
 * @returns String suitable for mocking gh issue view --json labels output
 */
export declare function createMockIssueLabelsResponse(labels: string[]): string;
/**
 * Create mock GitHub issue body response.
 *
 * @param body - Issue body text
 * @returns String suitable for mocking gh issue view --json body output
 */
export declare function createMockIssueBodyResponse(body: string): string;
/**
 * Assert that a command result contains expected data.
 *
 * @param result - The command result
 * @param expectedKeys - Keys expected to be present in result.data
 */
export declare function assertResultHasData(result: CommandResult | void, expectedKeys: string[]): asserts result is CommandResult & {
    data: Record<string, unknown>;
};
/**
 * Assert that a command result indicates success.
 *
 * @param result - The command result
 */
export declare function assertResultSuccess(result: CommandResult | void): asserts result is CommandResult;
/**
 * Create a mock file system structure for testing.
 *
 * @param vol - memfs volume instance
 * @param chadgiDir - Path to .chadgi directory
 * @param files - Object mapping filenames to content
 */
export declare function setupMockFileSystem(vol: {
    fromJSON: (files: Record<string, string>) => void;
}, chadgiDir: string, files: Record<string, unknown>): void;
/**
 * Create standard test file system with config and optional progress.
 *
 * @param vol - memfs volume instance
 * @param options - Options for the test setup
 */
export declare function setupStandardTestFileSystem(vol: {
    fromJSON: (files: Record<string, string>) => void;
}, options?: {
    chadgiDir?: string;
    progress?: ProgressData | null;
    pauseLock?: PauseLockData | null;
    approvalLock?: ApprovalLockData | null;
    github?: Partial<GitHubConfig>;
    branch?: Partial<BranchConfig>;
}): void;
//# sourceMappingURL=command-test-utils.d.ts.map