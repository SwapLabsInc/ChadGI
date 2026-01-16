interface PhaseMetrics {
    phase1_duration_secs: number;
    phase2_duration_secs: number;
    verification_duration_secs: number;
    git_operations_duration_secs: number;
}
interface TokenMetrics {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
}
interface TaskMetrics {
    issue_number: number;
    started_at: string;
    completed_at?: string;
    duration_secs: number;
    status: 'completed' | 'failed';
    iterations: number;
    cost_usd: number;
    phases?: PhaseMetrics;
    tokens?: TokenMetrics;
    failure_reason?: string;
    failure_phase?: 'phase1' | 'phase2' | 'verification';
    error_recovery_time_secs?: number;
    files_modified?: number;
    lines_changed?: number;
    retry_count?: number;
    category?: string;
}
interface InsightsOptions {
    config?: string;
    json?: boolean;
    export?: string;
    days?: number;
    category?: string;
}
export declare function insights(options?: InsightsOptions): Promise<void>;
export declare function initMetricsFile(chadgiDir: string): void;
export declare function addTaskMetric(chadgiDir: string, metric: TaskMetrics): void;
export {};
//# sourceMappingURL=insights.d.ts.map