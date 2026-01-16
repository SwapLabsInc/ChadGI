import type { BaseCommandOptions } from './types/index.js';
interface ResumeOptions extends BaseCommandOptions {
    restart?: boolean;
}
export declare function resume(options?: ResumeOptions): Promise<void>;
export {};
//# sourceMappingURL=resume.d.ts.map