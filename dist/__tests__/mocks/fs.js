/**
 * Mock utilities for the fs module.
 *
 * Provides a virtual file system for testing file operations without
 * touching the real file system.
 */
let mockFiles = {};
/**
 * Set up the virtual file system with the given files.
 */
export function setupMockFs(files) {
    mockFiles = { ...files };
}
/**
 * Clear the virtual file system.
 */
export function clearMockFs() {
    mockFiles = {};
}
/**
 * Get the current mock file system state.
 */
export function getMockFs() {
    return { ...mockFiles };
}
/**
 * Mock implementation of existsSync.
 */
export function mockExistsSync(path) {
    return path in mockFiles;
}
/**
 * Mock implementation of readFileSync.
 */
export function mockReadFileSync(path, _encoding) {
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
export function mockReaddirSync(dir) {
    const normalizedDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
    const entries = new Set();
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
        existsSync: jest.fn((path) => mockExistsSync(path)),
        readFileSync: jest.fn((path, encoding) => mockReadFileSync(path, encoding)),
        readdirSync: jest.fn((dir) => mockReaddirSync(dir)),
    };
}
//# sourceMappingURL=fs.js.map