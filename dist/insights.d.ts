import type { BaseCommandOptions, TaskMetrics } from './types/index.js';
interface InsightsOptions extends BaseCommandOptions {
    export?: string;
    days?: number;
    category?: string;
}
export declare function insights(options?: InsightsOptions): Promise<void>;
export declare function initMetricsFile(chadgiDir: string): void;
export declare function addTaskMetric(chadgiDir: string, metric: TaskMetrics): void;
export {};
//# sourceMappingURL=insights.d.ts.map