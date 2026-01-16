export interface SnapshotSaveOptions {
    config?: string;
    description?: string;
    alias?: string;
}
export interface SnapshotRestoreOptions {
    config?: string;
    force?: boolean;
}
export interface SnapshotListOptions {
    config?: string;
    json?: boolean;
}
export interface SnapshotDiffOptions {
    config?: string;
    json?: boolean;
}
export interface SnapshotDeleteOptions {
    config?: string;
    force?: boolean;
}
/**
 * Save current configuration as a snapshot
 */
export declare function snapshotSave(name: string, options?: SnapshotSaveOptions): Promise<void>;
/**
 * Restore configuration from a snapshot
 */
export declare function snapshotRestore(name: string, options?: SnapshotRestoreOptions): Promise<void>;
/**
 * List all saved snapshots
 */
export declare function snapshotList(options?: SnapshotListOptions): Promise<void>;
/**
 * Show diff between current config and a snapshot
 */
export declare function snapshotDiff(name: string, options?: SnapshotDiffOptions): Promise<void>;
/**
 * Delete a snapshot
 */
export declare function snapshotDelete(name: string, options?: SnapshotDeleteOptions): Promise<void>;
//# sourceMappingURL=snapshot.d.ts.map