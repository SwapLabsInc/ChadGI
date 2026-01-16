/**
 * Mock utilities for the child_process module.
 *
 * Provides mock implementations for execSync to simulate GitHub CLI
 * and other command-line tool responses without actual system calls.
 */
export interface CommandMock {
    pattern: RegExp;
    response: string | (() => string);
    shouldThrow?: boolean;
}
/**
 * Set up command mocks for execSync.
 */
export declare function setupCommandMocks(mocks: CommandMock[]): void;
/**
 * Add a single command mock.
 */
export declare function addCommandMock(mock: CommandMock): void;
/**
 * Clear all command mocks.
 */
export declare function clearCommandMocks(): void;
/**
 * Mock implementation of execSync.
 */
export declare function mockExecSync(command: string, _options?: {
    encoding?: string;
    stdio?: string | string[];
}): string;
/**
 * Create Jest mock functions for the child_process module.
 */
export declare function createChildProcessMocks(): {
    execSync: jest.Mock<string, [command: string, options?: {
        encoding?: string;
        stdio?: string | string[];
    } | undefined], any>;
};
export declare const ghMockResponses: {
    /**
     * Mock response for `gh auth status`.
     */
    authStatusAuthenticated: string;
    /**
     * Mock response for `gh issue view` with labels.
     */
    issueLabels: (labels: string[]) => string;
    /**
     * Mock response for `gh issue view` with body.
     */
    issueBody: (body: string) => string;
    /**
     * Mock response for `gh project item-list`.
     */
    projectItemList: (items: Array<{
        id: string;
        status: string;
        content: {
            type: string;
            number: number;
            title: string;
            url: string;
        };
    }>) => string;
    /**
     * Mock response for `gh project list`.
     */
    projectList: (projects: Array<{
        number: number;
        id: string;
        title: string;
    }>) => string;
    /**
     * Mock response for `gh project field-list`.
     */
    projectFieldList: (fields: Array<{
        name: string;
        id: string;
        options?: Array<{
            name: string;
            id: string;
        }>;
    }>) => string;
};
//# sourceMappingURL=child_process.d.ts.map