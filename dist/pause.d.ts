import type { BaseCommandOptions } from './types/index.js';
interface PauseOptions extends BaseCommandOptions {
    for?: string;
    reason?: string;
}
export declare function pause(options?: PauseOptions): Promise<void>;
export {};
//# sourceMappingURL=pause.d.ts.map