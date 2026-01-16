interface QueueOptions {
    config?: string;
    json?: boolean;
    limit?: number;
}
interface QueueSkipOptions extends QueueOptions {
    issueNumber: number;
}
interface QueuePromoteOptions extends QueueOptions {
    issueNumber: number;
}
export declare function queue(options?: QueueOptions): Promise<void>;
export declare function queueSkip(options: QueueSkipOptions): Promise<void>;
export declare function queuePromote(options: QueuePromoteOptions): Promise<void>;
export {};
//# sourceMappingURL=queue.d.ts.map