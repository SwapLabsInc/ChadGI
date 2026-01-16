interface StartOptions {
    config?: string;
    dryRun?: boolean;
    timeout?: number;
    debug?: boolean;
    ignoreDeps?: boolean;
    workspace?: boolean;
    repo?: string;
    parallel?: number;
    interactive?: boolean;
    mask?: boolean;
    forceClaim?: boolean;
    resume?: boolean;
}
export declare function start(options?: StartOptions): Promise<void>;
export {};
//# sourceMappingURL=start.d.ts.map