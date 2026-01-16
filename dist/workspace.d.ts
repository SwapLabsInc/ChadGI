export declare const WORKSPACE_CONFIG_FILENAME = "workspace.yaml";
export declare const WORKSPACE_DIR = ".chadgi";
export interface WorkspaceRepoConfig {
    path: string;
    remote?: string;
    branch_prefix?: string;
    test_command?: string;
    build_command?: string;
    enabled?: boolean;
    priority?: number;
}
export interface WorkspaceConfig {
    version: string;
    name?: string;
    description?: string;
    strategy: 'round-robin' | 'priority' | 'sequential';
    base_config?: string;
    repos: Record<string, WorkspaceRepoConfig>;
    settings?: {
        auto_clone?: boolean;
        parallel_validation?: boolean;
        aggregate_stats?: boolean;
    };
    created_at: string;
    updated_at: string;
}
export interface WorkspaceInitOptions {
    config?: string;
    force?: boolean;
    name?: string;
}
export interface WorkspaceAddOptions {
    config?: string;
    path?: string;
    remote?: string;
    priority?: number;
    enabled?: boolean;
}
export interface WorkspaceRemoveOptions {
    config?: string;
    force?: boolean;
}
export interface WorkspaceListOptions {
    config?: string;
    json?: boolean;
}
export interface WorkspaceStatusOptions {
    config?: string;
    json?: boolean;
    limit?: number;
}
export declare function getWorkspaceConfigPath(options?: {
    config?: string;
}): string;
export declare function loadWorkspaceConfig(configPath: string): WorkspaceConfig | null;
export declare function saveWorkspaceConfig(configPath: string, config: WorkspaceConfig): void;
export declare function validateRepoPath(repoPath: string): {
    valid: boolean;
    error?: string;
};
export declare function workspaceInit(options?: WorkspaceInitOptions): Promise<void>;
export declare function workspaceAdd(repo: string, options?: WorkspaceAddOptions): Promise<void>;
export declare function workspaceRemove(repo: string, options?: WorkspaceRemoveOptions): Promise<void>;
export declare function workspaceList(options?: WorkspaceListOptions): Promise<void>;
export declare function workspaceStatus(options?: WorkspaceStatusOptions): Promise<void>;
//# sourceMappingURL=workspace.d.ts.map