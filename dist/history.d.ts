import type { BaseCommandOptions } from './types/index.js';
interface HistoryOptions extends BaseCommandOptions {
    limit?: number;
    since?: string;
    status?: string;
}
export declare function history(options?: HistoryOptions): Promise<void>;
export {};
//# sourceMappingURL=history.d.ts.map