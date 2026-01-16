export interface ReplayOptions {
    config?: string;
    json?: boolean;
    fresh?: boolean;
    continue?: boolean;
    yes?: boolean;
    dryRun?: boolean;
    timeout?: number;
    debug?: boolean;
}
export declare function replay(issueNumberArg?: number, options?: ReplayOptions): Promise<void>;
export declare function replayLast(options?: ReplayOptions): Promise<void>;
export declare function replayAllFailed(options?: ReplayOptions): Promise<void>;
//# sourceMappingURL=replay.d.ts.map