/**
 * Unlock command for ChadGI.
 *
 * Manually releases task locks to allow re-processing of issues.
 */
import type { BaseCommandOptions } from './types/index.js';
interface UnlockOptions extends BaseCommandOptions {
    all?: boolean;
    stale?: boolean;
    force?: boolean;
}
/**
 * Main unlock command
 */
export declare function unlock(issueNumber?: number, options?: UnlockOptions): Promise<void>;
export {};
//# sourceMappingURL=unlock.d.ts.map