export interface DiffOptions {
    config?: string;
    json?: boolean;
    stat?: boolean;
    files?: boolean;
    pr?: number;
    output?: string;
}
export declare function diff(issueNumber?: number, options?: DiffOptions): Promise<void>;
export declare function diffPr(prNumber: number, options?: DiffOptions): Promise<void>;
//# sourceMappingURL=diff.d.ts.map