/**
 * Mock utilities for the fs module.
 *
 * Provides a virtual file system for testing file operations without
 * touching the real file system.
 */
export interface MockFileSystem {
    [path: string]: string | null;
}
/**
 * Set up the virtual file system with the given files.
 */
export declare function setupMockFs(files: MockFileSystem): void;
/**
 * Clear the virtual file system.
 */
export declare function clearMockFs(): void;
/**
 * Get the current mock file system state.
 */
export declare function getMockFs(): MockFileSystem;
/**
 * Mock implementation of existsSync.
 */
export declare function mockExistsSync(path: string): boolean;
/**
 * Mock implementation of readFileSync.
 */
export declare function mockReadFileSync(path: string, _encoding?: string): string;
/**
 * Mock implementation of readdirSync.
 */
export declare function mockReaddirSync(dir: string): string[];
/**
 * Create Jest mock functions for the fs module.
 */
export declare function createFsMocks(): {
    existsSync: jest.Mock<boolean, [path: string], any>;
    readFileSync: jest.Mock<string, [path: string, encoding?: string | undefined], any>;
    readdirSync: jest.Mock<string[], [dir: string], any>;
};
//# sourceMappingURL=fs.d.ts.map