interface ApproveOptions {
    config?: string;
    issueNumber?: number;
    message?: string;
    json?: boolean;
}
interface RejectOptions {
    config?: string;
    issueNumber?: number;
    message?: string;
    json?: boolean;
    skip?: boolean;
}
interface ApprovalLockData {
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    issue_number: number;
    issue_title?: string;
    branch?: string;
    phase: 'pre_task' | 'phase1' | 'phase2';
    files_changed?: number;
    insertions?: number;
    deletions?: number;
    approver?: string;
    approved_at?: string;
    rejected_at?: string;
    comment?: string;
    feedback?: string;
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