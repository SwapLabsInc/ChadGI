interface StartOptions {
    config?: string;
    dryRun?: boolean;
    timeout?: number;
    debug?: boolean;
    ignoreDeps?: boolean;
    workspace?: boolean;
    repo?: string;
}
export declare function start(options?: StartOptions): Promise<void>;
export {};
//# sourceMappingURL=start.d.ts.map