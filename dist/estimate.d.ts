import type { BaseCommandOptions } from './types/index.js';
interface EstimateOptions extends BaseCommandOptions {
    budget?: number;
    days?: number;
    category?: string;
}
export declare function estimate(options?: EstimateOptions): Promise<void>;
export {};
//# sourceMappingURL=estimate.d.ts.map