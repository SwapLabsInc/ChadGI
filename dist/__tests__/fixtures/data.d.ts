/**
 * Test fixtures for session stats, metrics, and other data files.
 */
import type { SessionStats, TaskMetrics, MetricsData, ProgressData } from '../../types/index.js';
export declare const sampleSessionStats: SessionStats[];
export declare const sampleTaskMetrics: TaskMetrics[];
export declare const sampleMetricsData: MetricsData;
export declare const sampleProgressData: ProgressData;
export declare const sampleProgressDataIdle: ProgressData;
export declare const sampleProgressDataPaused: ProgressData;
export declare const samplePauseLock: {
    paused_at: string;
    reason: string;
};
export declare const sampleApprovalLock: {
    status: "pending";
    created_at: string;
    issue_number: number;
    issue_title: string;
    branch: string;
    phase: "phase1";
    files_changed: number;
    insertions: number;
    deletions: number;
};
//# sourceMappingURL=data.d.ts.map