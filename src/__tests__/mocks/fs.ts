/**
 * Mock utilities for the fs module.
 *
 * Provides a virtual file system for testing file operations without
 * touching the real file system.
 */

export interface MockFileSystem {
  [path: string]: string | null; // null means directory, string means file content
}

let mockFiles: MockFileSystem = {};

/**
 * Set up the virtual file system with the given files.
 */
export function setupMockFs(files: MockFileSystem): void {
  mockFiles = { ...files };
}

/**
 * Clear the virtual file system.
 */
export function clearMockFs(): void {
  mockFiles = {};
}

/**
 * Get the current mock file system state.
 */
export function getMockFs(): MockFileSystem {
  return { ...mockFiles };
}

/**
 * Mock implementation of existsSync.
 */
export function mockExistsSync(path: string): boolean {
  return path in mockFiles;
}

/**
 * Mock implementation of readFileSync.
 */
export function mockReadFileSync(path: string, _encoding?: string): string {
  if (!(path in mockFiles)) {
    throw new Error(`ENOENT: no such file or directory, open '${path}'`);
  }
  const content = mockFiles[path];
  if (content === null) {
    throw new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
  }
  return content;
}

/**
 * Mock implementation of readdirSync.
 */
export function mockReaddirSync(dir: string): string[] {
  const normalizedDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
  const entries: Set<string> = new Set();

  for (const path of Object.keys(mockFiles)) {
    if (path.startsWith(normalizedDir + '/')) {
      const relativePath = path.slice(normalizedDir.length + 1);
      const firstPart = relativePath.split('/')[0];
      if (firstPart) {
        entries.add(firstPart);
      }
    }
  }

  return Array.from(entries);
}

/**
 * Create Jest mock functions for the fs module.
 */
export function createFsMocks() {
  return {
    existsSync: jest.fn((path: string) => mockExistsSync(path)),
    readFileSync: jest.fn((path: string, encoding?: string) => mockReadFileSync(path, encoding)),
    readdirSync: jest.fn((dir: string) => mockReaddirSync(dir)),
  };
}
