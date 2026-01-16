import type { BaseCommandOptions, ApprovalLockData } from './types/index.js';
interface ApproveOptions extends BaseCommandOptions {
    issueNumber?: number;
    message?: string;
}
interface RejectOptions extends BaseCommandOptions {
    issueNumber?: number;
    message?: string;
    skip?: boolean;
}
/**
 * Approve a pending task in interactive mode
 */
export declare function approve(options?: ApproveOptions): Promise<void>;
/**
 * Reject a pending task in interactive mode
 */
export declare function reject(options?: RejectOptions): Promise<void>;
/**
 * Check if there are pending approvals (for use by other modules)
 */
export declare function hasPendingApprovals(chadgiDir: string): boolean;
/**
 * Get pending approval info (for use by status command)
 */
export declare function getPendingApprovalInfo(chadgiDir: string): ApprovalLockData | null;
/**
 * Create an approval lock file (for use by bash script via node)
 */
export declare function createApprovalLock(chadgiDir: string, phase: 'pre_task' | 'phase1' | 'phase2', issueNumber: number, issueTitle?: string, branch?: string, diffStats?: {
    filesChanged: number;
    insertions: number;
    deletions: number;
}): string;
/**
 * Remove an approval lock file
 */
export declare function removeApprovalLock(chadgiDir: string, phase: string, issueNumber: number): void;
export {};
//# sourceMappingURL=approve.d.ts.map