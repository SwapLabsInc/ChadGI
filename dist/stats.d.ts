import type { BaseCommandOptions } from './types/index.js';
interface StatsOptions extends BaseCommandOptions {
    last?: number;
}
export declare function stats(options?: StatsOptions): Promise<void>;
export {};
//# sourceMappingURL=stats.d.ts.map