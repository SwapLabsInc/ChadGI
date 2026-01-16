import type { BaseCommandOptions } from './types/index.js';
export interface ReplayOptions extends BaseCommandOptions {
    fresh?: boolean;
    continue?: boolean;
    yes?: boolean;
    dryRun?: boolean;
    timeout?: number;
}
export declare function replay(issueNumberArg?: number, options?: ReplayOptions): Promise<void>;
export declare function replayLast(options?: ReplayOptions): Promise<void>;
export declare function replayAllFailed(options?: ReplayOptions): Promise<void>;
//# sourceMappingURL=replay.d.ts.map