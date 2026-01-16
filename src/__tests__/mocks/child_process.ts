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

let commandMocks: CommandMock[] = [];

/**
 * Set up command mocks for execSync.
 */
export function setupCommandMocks(mocks: CommandMock[]): void {
  commandMocks = [...mocks];
}

/**
 * Add a single command mock.
 */
export function addCommandMock(mock: CommandMock): void {
  commandMocks.push(mock);
}

/**
 * Clear all command mocks.
 */
export function clearCommandMocks(): void {
  commandMocks = [];
}

/**
 * Mock implementation of execSync.
 */
export function mockExecSync(
  command: string,
  _options?: { encoding?: string; stdio?: string | string[] }
): string {
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
    execSync: jest.fn(
      (command: string, options?: { encoding?: string; stdio?: string | string[] }) =>
        mockExecSync(command, options)
    ),
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
  issueLabels: (labels: string[]) => labels.join('\n'),

  /**
   * Mock response for `gh issue view` with body.
   */
  issueBody: (body: string) => body,

  /**
   * Mock response for `gh project item-list`.
   */
  projectItemList: (items: Array<{
    id: string;
    status: string;
    content: { type: string; number: number; title: string; url: string };
  }>) =>
    JSON.stringify({ items }),

  /**
   * Mock response for `gh project list`.
   */
  projectList: (projects: Array<{ number: number; id: string; title: string }>) =>
    JSON.stringify({ projects }),

  /**
   * Mock response for `gh project field-list`.
   */
  projectFieldList: (fields: Array<{
    name: string;
    id: string;
    options?: Array<{ name: string; id: string }>;
  }>) =>
    JSON.stringify({ fields }),
};
