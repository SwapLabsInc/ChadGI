import type { BaseCommandOptions } from './types/index.js';
interface LogsOptions extends BaseCommandOptions {
    limit?: number;
    since?: string;
    follow?: boolean;
    level?: string;
    task?: number;
    grep?: string;
}
interface LogsListOptions extends BaseCommandOptions {
}
interface LogsClearOptions extends BaseCommandOptions {
    yes?: boolean;
    keepLast?: number;
}
/**
 * Main logs command - view execution logs
 */
export declare function logs(options?: LogsOptions): Promise<void>;
/**
 * List available log files
 */
export declare function logsList(options?: LogsListOptions): Promise<void>;
/**
 * Clear old log files
 */
export declare function logsClear(options?: LogsClearOptions): Promise<void>;
export {};
//# sourceMappingURL=logs.d.ts.map