/**
 * History command implementation using the middleware system.
 *
 * This is a refactored version of history.ts that demonstrates the middleware
 * pattern for reducing boilerplate.
 */
import type { BaseCommandOptions } from './types/index.js';
/**
 * History command options.
 */
interface HistoryOptions extends BaseCommandOptions {
    limit?: number;
    since?: string;
    status?: string;
    jsonUnified?: boolean;
}
/**
 * History command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 * 5. withDirectoryValidation - ensures .chadgi directory exists
 */
export declare const historyMiddleware: (options?: HistoryOptions | undefined) => Promise<void>;
export {};
//# sourceMappingURL=history-middleware.d.ts.map