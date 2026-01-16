export interface CleanupOptions {
    config?: string;
    branches?: boolean;
    diagnostics?: boolean;
    logs?: boolean;
    all?: boolean;
    dryRun?: boolean;
    yes?: boolean;
    days?: number;
    json?: boolean;
}
/**
 * Main cleanup command
 */
export declare function cleanup(options?: CleanupOptions): Promise<void>;
//# sourceMappingURL=cleanup.d.ts.map