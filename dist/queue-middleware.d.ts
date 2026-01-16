/**
 * Queue command implementation using the middleware system.
 *
 * This is a refactored version of queue.ts that demonstrates the middleware
 * pattern for commands that need configuration loading.
 */
import type { BaseCommandOptions } from './types/index.js';
/**
 * Queue command options.
 */
interface QueueOptions extends BaseCommandOptions {
    config?: string;
    json?: boolean;
    jsonUnified?: boolean;
    limit?: number;
}
/**
 * Queue command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 * 5. withDirectoryValidation - ensures .chadgi directory exists
 * 6. withConfig - loads configuration from file
 */
export declare const queueMiddleware: (options?: QueueOptions | undefined) => Promise<void>;
export {};
//# sourceMappingURL=queue-middleware.d.ts.map