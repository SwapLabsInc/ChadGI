/**
 * Command context types and factory for ChadGI middleware system.
 *
 * The context object provides a typed interface for commands to access
 * common resources like configuration, paths, and options without
 * needing to resolve them manually.
 */
/**
 * Create a new core context with minimal setup.
 *
 * @param createOptions - Options for creating the context
 * @returns A new CoreContext instance
 */
export function createCoreContext(createOptions = {}) {
    return {
        options: (createOptions.options || {}),
        cwd: createOptions.cwd || process.cwd(),
    };
}
/**
 * Type guard to check if context has directory information.
 */
export function hasDirectoryContext(ctx) {
    return 'chadgiDir' in ctx && 'configPath' in ctx;
}
/**
 * Type guard to check if context has config information.
 */
export function hasConfigContext(ctx) {
    return (hasDirectoryContext(ctx) &&
        'configContent' in ctx &&
        'github' in ctx &&
        'branch' in ctx);
}
/**
 * Type guard to check if context has timing information.
 */
export function hasTimingContext(ctx) {
    return 'startTime' in ctx && 'getElapsedMs' in ctx;
}
/**
 * Type guard to check if context has full command context.
 */
export function hasFullContext(ctx) {
    return hasConfigContext(ctx) && hasTimingContext(ctx);
}
//# sourceMappingURL=context.js.map