import type { BaseCommandOptions } from './types/index.js';
interface BenchmarkOptions extends BaseCommandOptions {
    quick?: boolean;
    full?: boolean;
    model?: string;
    tasks?: string;
    output?: string;
    compare?: string;
    list?: boolean;
    iterations?: number;
    timeout?: number;
    dryRun?: boolean;
}
export declare function benchmark(options?: BenchmarkOptions): Promise<void>;
export declare function initBenchmarks(chadgiDir: string): void;
export {};
//# sourceMappingURL=benchmark.d.ts.map