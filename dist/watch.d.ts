import type { BaseCommandOptions } from './types/index.js';
interface WatchOptions extends BaseCommandOptions {
    once?: boolean;
    interval?: number;
}
export declare function watch(options?: WatchOptions): Promise<void>;
export {};
//# sourceMappingURL=watch.d.ts.map