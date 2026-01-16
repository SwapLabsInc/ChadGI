/**
 * Insights command implementation using the middleware system.
 *
 * This is a refactored version of insights.ts that demonstrates the middleware
 * pattern for reducing boilerplate.
 */
import type { BaseCommandOptions } from './types/index.js';
/**
 * Insights command options.
 */
interface InsightsOptions extends BaseCommandOptions {
    export?: string;
    days?: number;
    category?: string;
}
/**
 * Insights command with middleware applied.
 *
 * The middleware chain:
 * 1. withTiming - tracks execution time (added automatically)
 * 2. withErrorHandler - catches and formats errors (added automatically)
 * 3. withJsonOutput - handles JSON serialization (added automatically)
 * 4. withDirectory - resolves chadgiDir and configPath
 * 5. withDirectoryValidation - ensures .chadgi directory exists
 */
export declare const insightsMiddleware: (options?: InsightsOptions | undefined) => Promise<void>;
export {};
//# sourceMappingURL=insights-middleware.d.ts.map