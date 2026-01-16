/**
 * Mock utilities for the child_process module.
 *
 * Provides mock implementations for execSync to simulate GitHub CLI
 * and other command-line tool responses without actual system calls.
 */
let commandMocks = [];
/**
 * Set up command mocks for execSync.
 */
export function setupCommandMocks(mocks) {
    commandMocks = [...mocks];
}
/**
 * Add a single command mock.
 */
export function addCommandMock(mock) {
    commandMocks.push(mock);
}
/**
 * Clear all command mocks.
 */
export function clearCommandMocks() {
    commandMocks = [];
}
/**
 * Mock implementation of execSync.
 */
export function mockExecSync(command, _options) {
    for (const mock of commandMocks) {
        if (mock.pattern.test(command)) {
            if (mock.shouldThrow) {
                const response = typeof mock.response === 'function' ? mock.response() : mock.response;
                throw new Error(response);
            }
            return typeof mock.response === 'function' ? mock.response() : mock.response;
        }
    }
    // Default: throw error for unmocked commands
    throw new Error(`Command not mocked: ${command}`);
}
/**
 * Create Jest mock functions for the child_process module.
 */
export function createChildProcessMocks() {
    return {
        execSync: jest.fn((command, options) => mockExecSync(command, options)),
    };
}
// Common GitHub CLI mock responses
export const ghMockResponses = {
    /**
     * Mock response for `gh auth status`.
     */
    authStatusAuthenticated: '',
    /**
     * Mock response for `gh issue view` with labels.
     */
    issueLabels: (labels) => labels.join('\n'),
    /**
     * Mock response for `gh issue view` with body.
     */
    issueBody: (body) => body,
    /**
     * Mock response for `gh project item-list`.
     */
    projectItemList: (items) => JSON.stringify({ items }),
    /**
     * Mock response for `gh project list`.
     */
    projectList: (projects) => JSON.stringify({ projects }),
    /**
     * Mock response for `gh project field-list`.
     */
    projectFieldList: (fields) => JSON.stringify({ fields }),
};
//# sourceMappingURL=child_process.js.map